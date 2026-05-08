const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, 'uno_game.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS rooms (
	id TEXT PRIMARY KEY,
	password TEXT,
	mode TEXT DEFAULT 'ffa',
	max_players INTEGER DEFAULT 4,
	status TEXT DEFAULT 'waiting',
	created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS players (
	id TEXT PRIMARY KEY,
	room_id TEXT REFERENCES rooms(id) ON DELETE CASCADE,
	name TEXT NOT NULL,
	socket_id TEXT,
	seat INTEGER,
	is_host INTEGER DEFAULT 0,
	connected INTEGER DEFAULT 1,
	joined_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS game_sessions (
	id TEXT PRIMARY KEY,
	room_id TEXT REFERENCES rooms(id) ON DELETE CASCADE,
	started_at DATETIME,
	ended_at DATETIME,
	winner_id TEXT REFERENCES players(id),
	ranking TEXT
);

CREATE TABLE IF NOT EXISTS game_events (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	session_id TEXT,
	event_type TEXT,
	player_id TEXT,
	data TEXT,
	created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`);

const statements = {
	createRoom: db.prepare(
		`INSERT INTO rooms (id, password, mode, max_players)
		 VALUES (@id, @password, @mode, @maxPlayers)`
	),
	getRoom: db.prepare('SELECT * FROM rooms WHERE id = ?'),
	updateRoomStatus: db.prepare('UPDATE rooms SET status = ? WHERE id = ?'),

	addPlayer: db.prepare(
		`INSERT INTO players (id, room_id, name, socket_id, seat, is_host)
		 VALUES (@id, @roomId, @name, @socketId, @seat, @isHost)`
	),
	getPlayer: db.prepare('SELECT * FROM players WHERE id = ?'),
	getPlayersByRoom: db.prepare('SELECT * FROM players WHERE room_id = ? ORDER BY seat ASC'),
	updatePlayerSocket: db.prepare('UPDATE players SET socket_id = ? WHERE id = ?'),
	updatePlayerConnected: db.prepare('UPDATE players SET connected = ? WHERE id = ?'),
	removePlayer: db.prepare('DELETE FROM players WHERE id = ?'),

	createSession: db.prepare(
		`INSERT INTO game_sessions (id, room_id, started_at)
		 VALUES (?, ?, CURRENT_TIMESTAMP)`
	),
	endSession: db.prepare(
		`UPDATE game_sessions
		 SET ended_at = CURRENT_TIMESTAMP, winner_id = @winnerId, ranking = @ranking
		 WHERE id = @sessionId`
	),
	getSession: db.prepare('SELECT * FROM game_sessions WHERE id = ?'),

	logEvent: db.prepare(
		`INSERT INTO game_events (session_id, event_type, player_id, data)
		 VALUES (@sessionId, @eventType, @playerId, @data)`
	),
};

function createRoom(id, password = null, mode = 'ffa', maxPlayers = 4) {
	statements.createRoom.run({ id, password, mode, maxPlayers });
	return getRoom(id);
}

function getRoom(id) {
	return statements.getRoom.get(id) || null;
}

function updateRoomStatus(id, status) {
	statements.updateRoomStatus.run(status, id);
	return getRoom(id);
}

function addPlayer(id, roomId, name, socketId, seat, isHost = 0) {
	statements.addPlayer.run({
		id,
		roomId,
		name,
		socketId,
		seat,
		isHost: isHost ? 1 : 0,
	});
	return getPlayer(id);
}

function getPlayer(id) {
	return statements.getPlayer.get(id) || null;
}

function getPlayersByRoom(roomId) {
	return statements.getPlayersByRoom.all(roomId);
}

function updatePlayerSocket(playerId, socketId) {
	statements.updatePlayerSocket.run(socketId, playerId);
	return getPlayer(playerId);
}

function updatePlayerConnected(playerId, connected) {
	statements.updatePlayerConnected.run(connected ? 1 : 0, playerId);
	return getPlayer(playerId);
}

function removePlayer(playerId) {
	statements.removePlayer.run(playerId);
}

function createSession(id, roomId) {
	statements.createSession.run(id, roomId);
	return getSession(id);
}

function endSession(sessionId, winnerId, ranking) {
	const serializedRanking = Array.isArray(ranking) ? JSON.stringify(ranking) : ranking;
	statements.endSession.run({ sessionId, winnerId, ranking: serializedRanking });
	return getSession(sessionId);
}

function getSession(id) {
	return statements.getSession.get(id) || null;
}

function logEvent(sessionId, eventType, playerId, data) {
	const serializedData = JSON.stringify(data ?? {});
	const result = statements.logEvent.run({ sessionId, eventType, playerId, data: serializedData });
	return result.lastInsertRowid;
}

module.exports = {
	createRoom,
	getRoom,
	updateRoomStatus,
	addPlayer,
	getPlayer,
	getPlayersByRoom,
	updatePlayerSocket,
	updatePlayerConnected,
	removePlayer,
	createSession,
	endSession,
	getSession,
	logEvent,
};
