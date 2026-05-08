const path = require('path');
const http = require('http');
const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

const GameEngine = require('./gameEngine');
const db = require('./database');

const PORT = 3000;
const TURN_DURATION_SECONDS = 30;
const TURN_BROADCAST_MARKS = new Set([25, 20, 15, 10, 5]);
const UNO_WINDOW_MS = 5000;
const ROOM_CLEANUP_MS = 60000;
const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
	res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/game', (req, res) => {
	res.sendFile(path.join(__dirname, 'public', 'game.html'));
});

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// roomId -> RoomState
const rooms = new Map();
// socketId -> { roomId, playerId }
const socketIndex = new Map();

function toPlainHandSizes(handSizesMap) {
	const out = {};
	for (const [playerId, size] of handSizesMap.entries()) {
		out[playerId] = size;
	}
	return out;
}

function send(ws, type, payload = {}) {
	if (!ws || ws.readyState !== WebSocket.OPEN) {
		return;
	}
	ws.send(JSON.stringify({ type, payload }));
}

function sendError(ws, message) {
	send(ws, 'ERROR', { message });
}

function broadcastRoom(room, type, payload, excludeSocketId = null) {
	for (const [socketId, player] of room.players.entries()) {
		if (excludeSocketId && socketId === excludeSocketId) {
			continue;
		}
		send(player.ws, type, payload);
	}
}

function getPlayerBySocketId(room, socketId) {
	return room.players.get(socketId) || null;
}

function getPlayerById(room, playerId) {
	for (const player of room.players.values()) {
		if (player.id === playerId) {
			return player;
		}
	}
	return null;
}

function listPlayers(room) {
	return [...room.players.values()]
		.sort((a, b) => a.seat - b.seat)
		.map((player) => ({
			id: player.id,
			name: player.name,
			seat: player.seat,
			isHost: player.isHost,
		}));
}

function validateName(name) {
	return typeof name === 'string' && /^[A-Za-z0-9 ]{2,20}$/.test(name.trim());
}

function validatePassword(password) {
	return password == null || (typeof password === 'string' && password.length <= 20);
}

function validateMaxPlayers(maxPlayers) {
	return Number.isInteger(maxPlayers) && maxPlayers >= 2 && maxPlayers <= 4;
}

function generateRoomCode() {
	const length = 6;
	let roomCode = '';
	do {
		roomCode = '';
		for (let i = 0; i < length; i += 1) {
			roomCode += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
		}
	} while (rooms.has(roomCode));

	return roomCode;
}

function nextAvailableSeat(room) {
	const used = new Set([...room.players.values()].map((player) => player.seat));
	for (let i = 0; i < room.maxPlayers; i += 1) {
		if (!used.has(i)) {
			return i;
		}
	}
	return null;
}

function clearTurnTimer(room) {
	if (room.turnTimer) {
		clearInterval(room.turnTimer);
		room.turnTimer = null;
	}
	room.turnStartTime = null;
}

function clearCleanupTimer(room) {
	if (room.cleanupTimer) {
		clearTimeout(room.cleanupTimer);
		room.cleanupTimer = null;
	}
}

function scheduleRoomCleanup(room) {
	const connectedCount = [...room.players.values()].filter((player) => player.connected).length;
	if (connectedCount > 0 || room.cleanupTimer) {
		return;
	}

	room.cleanupTimer = setTimeout(() => {
		clearTurnTimer(room);
		for (const timeout of room.unoWindowTimers.values()) {
			clearTimeout(timeout);
		}
		room.unoWindowTimers.clear();
		rooms.delete(room.id);
	}, ROOM_CLEANUP_MS);
}

function maybeAutoTurnForDisconnected(room) {
	const state = room.engine?.getCurrentState();
	if (!state || room.status !== 'playing') {
		return false;
	}

	const currentPlayerId = state.currentPlayerId;
	const currentPlayer = getPlayerById(room, currentPlayerId);
	if (!currentPlayer || currentPlayer.connected) {
		return false;
	}

	const timeoutResult = room.engine.skipTurnTimeout(currentPlayerId);
	db.logEvent(room.sessionId, 'turn_skip', currentPlayerId, {
		reason: 'disconnected_auto_skip',
		drawnCards: timeoutResult.drawnCards,
	});

	const payload = {
		playerId: currentPlayerId,
		count: timeoutResult.drawnCards.length,
		nextPlayerId: timeoutResult.nextPlayerId,
		handSizes: toPlainHandSizes(timeoutResult.handSizes),
	};
	broadcastRoom(room, 'CARDS_DRAWN', payload);

	handleGameOverIfNeeded(room);
	return true;
}

function startTurnTimer(room) {
	clearTurnTimer(room);
	if (!room.engine || room.status !== 'playing') {
		return;
	}

	if (maybeAutoTurnForDisconnected(room)) {
		if (room.status === 'playing') {
			setImmediate(() => startTurnTimer(room));
		}
		return;
	}

	const state = room.engine.getCurrentState();
	const currentPlayerId = state.currentPlayerId;
	room.turnStartTime = Date.now();
	let previousSecond = TURN_DURATION_SECONDS;

	room.turnTimer = setInterval(() => {
		const elapsedSeconds = Math.floor((Date.now() - room.turnStartTime) / 1000);
		const remaining = Math.max(0, TURN_DURATION_SECONDS - elapsedSeconds);

		if (remaining !== previousSecond && TURN_BROADCAST_MARKS.has(remaining)) {
			broadcastRoom(room, 'TURN_TIMER', { playerId: currentPlayerId, secondsLeft: remaining });
		}
		previousSecond = remaining;

		if (remaining <= 0) {
			clearTurnTimer(room);
			if (room.status !== 'playing' || !room.engine) {
				return;
			}

			const nowState = room.engine.getCurrentState();
			if (nowState.currentPlayerId !== currentPlayerId) {
				return;
			}

			const timeoutResult = room.engine.skipTurnTimeout(currentPlayerId);
			db.logEvent(room.sessionId, 'turn_skip', currentPlayerId, {
				reason: 'turn_timeout',
				drawnCards: timeoutResult.drawnCards,
			});

			const payload = {
				playerId: currentPlayerId,
				count: timeoutResult.drawnCards.length,
				nextPlayerId: timeoutResult.nextPlayerId,
				handSizes: toPlainHandSizes(timeoutResult.handSizes),
			};
			broadcastRoom(room, 'CARDS_DRAWN', payload);

			if (!handleGameOverIfNeeded(room)) {
				startTurnTimer(room);
			}
		}
	}, 1000);
}

function clearUnoWindow(room, playerId) {
	const timeout = room.unoWindowTimers.get(playerId);
	if (timeout) {
		clearTimeout(timeout);
		room.unoWindowTimers.delete(playerId);
	}
}

function openUnoWindow(room, playerId) {
	clearUnoWindow(room, playerId);
	const timeout = setTimeout(() => {
		room.unoWindowTimers.delete(playerId);
	}, UNO_WINDOW_MS);
	room.unoWindowTimers.set(playerId, timeout);
}

function handleGameOverIfNeeded(room) {
	const state = room.engine?.getCurrentState();
	if (!state || state.phase !== 'finished') {
		return false;
	}

	room.status = 'finished';
	db.updateRoomStatus(room.id, 'finished');
	clearTurnTimer(room);

	const ranking = state.ranking.map((playerId, index) => {
		const player = getPlayerById(room, playerId);
		return {
			place: index + 1,
			playerId,
			name: player ? player.name : 'Unknown',
		};
	});

	const winnerId = ranking[0]?.playerId || null;
	db.endSession(room.sessionId, winnerId, state.ranking);

	broadcastRoom(room, 'GAME_OVER', { ranking });
	return true;
}

function ensureRoom(roomId) {
	const room = rooms.get(roomId);
	if (!room) {
		throw new Error('Room not found.');
	}
	return room;
}

wss.on('connection', (ws) => {
	const socketId = uuidv4();
	ws.socketId = socketId;

	ws.on('message', (rawData) => {
		let message;
		try {
			message = JSON.parse(rawData.toString());
		} catch (err) {
			sendError(ws, 'Invalid JSON payload.');
			return;
		}

		const { type, payload = {} } = message;

		try {
			if (type === 'PING') {
				send(ws, 'PONG', {});
				return;
			}

			if (type === 'CREATE_ROOM') {
				const name = String(payload.name || '').trim();
				const password = payload.password == null ? null : String(payload.password);
				const mode = payload.mode || 'ffa';
				const maxPlayers = Number(payload.maxPlayers || 4);

				if (!validateName(name)) {
					throw new Error('Name must be 2-20 chars (letters, numbers, spaces).');
				}
				if (!validatePassword(password)) {
					throw new Error('Password must be 20 chars or less.');
				}
				if (!validateMaxPlayers(maxPlayers)) {
					throw new Error('maxPlayers must be between 2 and 4.');
				}

				const roomId = generateRoomCode();
				const playerId = uuidv4();
				const seat = 0;

				const room = {
					id: roomId,
					password,
					mode,
					maxPlayers,
					status: 'waiting',
					players: new Map(),
					engine: null,
					sessionId: null,
					turnTimer: null,
					turnStartTime: null,
					unoWindowTimers: new Map(),
					cleanupTimer: null,
				};

				room.players.set(socketId, {
					id: playerId,
					name,
					seat,
					isHost: 1,
					ws,
					connected: true,
					socketId,
				});

				rooms.set(roomId, room);
				socketIndex.set(socketId, { roomId, playerId });

				db.createRoom(roomId, password, mode, maxPlayers);
				db.addPlayer(playerId, roomId, name, socketId, seat, 1);

				send(ws, 'ROOM_CREATED', { roomId, playerId, seat });
				return;
			}

			if (type === 'JOIN_ROOM') {
				const roomId = String(payload.roomId || '').toUpperCase();
				const password = payload.password == null ? null : String(payload.password);
				const name = String(payload.name || '').trim();

				if (!validateName(name)) {
					throw new Error('Name must be 2-20 chars (letters, numbers, spaces).');
				}

				const room = ensureRoom(roomId);
				clearCleanupTimer(room);

				if (room.password && room.password !== password) {
					throw new Error('Wrong room password.');
				}
				if (room.status !== 'waiting') {
					throw new Error('Game already started.');
				}
				if (room.players.size >= room.maxPlayers) {
					throw new Error('Room is full.');
				}

				const seat = nextAvailableSeat(room);
				if (seat == null) {
					throw new Error('No available seats in room.');
				}

				const playerId = uuidv4();
				const player = {
					id: playerId,
					name,
					seat,
					isHost: 0,
					ws,
					connected: true,
					socketId,
				};
				room.players.set(socketId, player);
				socketIndex.set(socketId, { roomId, playerId });

				db.addPlayer(playerId, roomId, name, socketId, seat, 0);

				send(ws, 'ROOM_JOINED', {
					roomId,
					playerId,
					seat,
					players: listPlayers(room),
				});

				broadcastRoom(
					room,
					'PLAYER_JOINED',
					{ player: { id: player.id, name: player.name, seat: player.seat, isHost: 0 } },
					socketId
				);
				return;
			}

			if (type === 'START_GAME') {
				const roomId = String(payload.roomId || '').toUpperCase();
				const room = ensureRoom(roomId);
				const actor = getPlayerBySocketId(room, socketId);

				if (!actor) {
					throw new Error('You are not in this room.');
				}
				if (!actor.isHost) {
					throw new Error('Only host can start the game.');
				}
				if (room.status !== 'waiting') {
					throw new Error('Game already started.');
				}
				if (room.players.size < 2) {
					throw new Error('At least 2 players are required to start.');
				}

				const orderedPlayers = [...room.players.values()]
					.sort((a, b) => a.seat - b.seat)
					.map((player) => ({ id: player.id, name: player.name, seat: player.seat }));

				room.engine = new GameEngine(orderedPlayers);
				const init = room.engine.initGame();

				room.status = 'playing';
				room.sessionId = uuidv4();
				db.updateRoomStatus(roomId, 'playing');
				db.createSession(room.sessionId, roomId);

				const seats = {};
				for (const player of orderedPlayers) {
					seats[player.id] = player.seat;
				}

				for (const player of room.players.values()) {
					send(player.ws, 'GAME_STARTED', {
						hand: init.hands.get(player.id) || [],
						topCard: init.topCard,
						currentColor: room.engine.currentColor,
						currentPlayerId: init.currentPlayerId,
						players: listPlayers(room),
						seats,
					});
				}

				startTurnTimer(room);
				return;
			}

			if (type === 'PLAY_CARD') {
				const roomId = String(payload.roomId || '').toUpperCase();
				const cardId = String(payload.cardId || '');
				const chosenColor = payload.chosenColor;

				const room = ensureRoom(roomId);
				const actor = getPlayerBySocketId(room, socketId);
				if (!actor) {
					throw new Error('You are not in this room.');
				}
				if (room.status !== 'playing' || !room.engine) {
					throw new Error('Game is not in progress.');
				}

				const state = room.engine.getCurrentState();
				if (state.currentPlayerId !== actor.id) {
					throw new Error('Not your turn.');
				}

				clearTurnTimer(room);
				const result = room.engine.playCard(actor.id, cardId, chosenColor);
				db.logEvent(room.sessionId, 'card_played', actor.id, {
					cardId,
					chosenColor,
					effect: result.effect,
					topCard: result.topCard,
				});

				const payloadOut = {
					playerId: actor.id,
					card: result.card,
					topCard: result.topCard,
					currentColor: result.currentColor,
					nextPlayerId: result.nextPlayerId,
					effect: result.effect,
					handSizes: toPlainHandSizes(room.engine.getCurrentState().handSizes),
				};

				if (result.handSize === 1) {
					openUnoWindow(room, actor.id);
					payloadOut.unoAlert = { playerId: actor.id, windowMs: UNO_WINDOW_MS };
				} else {
					clearUnoWindow(room, actor.id);
				}

				broadcastRoom(room, 'CARD_PLAYED', payloadOut);

				if (!handleGameOverIfNeeded(room)) {
					startTurnTimer(room);
				}
				return;
			}

			if (type === 'DRAW_CARD') {
				const roomId = String(payload.roomId || '').toUpperCase();
				const room = ensureRoom(roomId);
				const actor = getPlayerBySocketId(room, socketId);

				if (!actor) {
					throw new Error('You are not in this room.');
				}
				if (room.status !== 'playing' || !room.engine) {
					throw new Error('Game is not in progress.');
				}

				const state = room.engine.getCurrentState();
				if (state.currentPlayerId !== actor.id) {
					throw new Error('Not your turn.');
				}

				clearTurnTimer(room);
				const drawResult = room.engine.drawCard(actor.id);
				db.logEvent(room.sessionId, 'card_drawn', actor.id, {
					count: drawResult.drawnCards.length,
					canPlay: drawResult.canPlay,
				});

				const basePayload = {
					playerId: actor.id,
					count: drawResult.drawnCards.length,
					nextPlayerId: drawResult.nextPlayerId,
					handSizes: toPlainHandSizes(drawResult.handSizes),
				};

				for (const [targetSocketId, player] of room.players.entries()) {
					if (targetSocketId === socketId) {
						send(player.ws, 'CARDS_DRAWN', { ...basePayload, drawnCards: drawResult.drawnCards });
					} else {
						send(player.ws, 'CARDS_DRAWN', basePayload);
					}
				}

				if (!handleGameOverIfNeeded(room)) {
					startTurnTimer(room);
				}
				return;
			}

			if (type === 'CALL_UNO') {
				const roomId = String(payload.roomId || '').toUpperCase();
				const room = ensureRoom(roomId);
				const actor = getPlayerBySocketId(room, socketId);
				if (!actor) {
					throw new Error('You are not in this room.');
				}
				if (!room.engine || room.status !== 'playing') {
					throw new Error('Game is not in progress.');
				}

				room.engine.callUno(actor.id);
				db.logEvent(room.sessionId, 'uno_called', actor.id, {});
				broadcastRoom(room, 'UNO_CALLED', { playerId: actor.id });
				return;
			}

			if (type === 'PENALIZE_UNO') {
				const roomId = String(payload.roomId || '').toUpperCase();
				const targetPlayerId = String(payload.targetPlayerId || '');

				const room = ensureRoom(roomId);
				const actor = getPlayerBySocketId(room, socketId);
				if (!actor) {
					throw new Error('You are not in this room.');
				}
				if (!room.engine || room.status !== 'playing') {
					throw new Error('Game is not in progress.');
				}
				if (!room.unoWindowTimers.has(targetPlayerId)) {
					throw new Error('UNO penalty window closed for this player.');
				}

				const penalty = room.engine.penalizeUno(targetPlayerId, actor.id);
				if (!penalty.penalized) {
					throw new Error('Penalty is not applicable.');
				}

				clearUnoWindow(room, targetPlayerId);
				db.logEvent(room.sessionId, 'uno_called', actor.id, {
					action: 'penalize_uno',
					targetPlayerId,
				});

				broadcastRoom(room, 'UNO_PENALIZED', { targetPlayerId, count: penalty.drawnCards.length });
				return;
			}

			sendError(ws, `Unknown message type: ${type}`);
		} catch (err) {
			sendError(ws, err.message || 'Unexpected server error.');
		}
	});

	ws.on('close', () => {
		const index = socketIndex.get(socketId);
		if (!index) {
			return;
		}

		const room = rooms.get(index.roomId);
		socketIndex.delete(socketId);
		if (!room) {
			return;
		}

		const player = room.players.get(socketId);
		if (!player) {
			return;
		}

		db.updatePlayerConnected(player.id, 0);
		player.connected = false;
		player.ws = null;

		broadcastRoom(room, 'PLAYER_LEFT', { playerId: player.id }, socketId);

		if (room.status === 'waiting') {
			const wasHost = player.isHost === 1;
			room.players.delete(socketId);
			db.removePlayer(player.id);

			if (wasHost && room.players.size > 0) {
				const nextHost = [...room.players.values()].sort((a, b) => a.seat - b.seat)[0];
				if (nextHost) {
					nextHost.isHost = 1;
				}
			}

			if (room.players.size === 0) {
				rooms.delete(room.id);
			}
			return;
		}

		if (room.status === 'playing' && room.engine) {
			const state = room.engine.getCurrentState();
			if (state.currentPlayerId === player.id) {
				clearTurnTimer(room);
				const timeoutResult = room.engine.skipTurnTimeout(player.id);
				db.logEvent(room.sessionId, 'turn_skip', player.id, {
					reason: 'disconnect_on_turn',
					drawnCards: timeoutResult.drawnCards,
				});

				const payload = {
					playerId: player.id,
					count: timeoutResult.drawnCards.length,
					nextPlayerId: timeoutResult.nextPlayerId,
					handSizes: toPlainHandSizes(timeoutResult.handSizes),
				};
				broadcastRoom(room, 'CARDS_DRAWN', payload);

				if (!handleGameOverIfNeeded(room)) {
					startTurnTimer(room);
				}
			}
		}

		scheduleRoomCleanup(room);
	});
});

server.listen(PORT, () => {
	console.log('UNO Server running on http://localhost:3000');
});
