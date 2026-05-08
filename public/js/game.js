/* Game Client - Main game logic and WebSocket handler */

const GameClient = (() => {
	let ws = null;
	let state = {
		roomId: null,
		myPlayerId: null,
		myHand: [],
		players: [],
		currentPlayerId: null,
		currentColor: null,
		topCard: null,
		phase: 'waiting', // waiting|playing|finished
		ranking: [],
		handSizes: {},
		unoWindowOpen: null,
	};

	let reconnectAttempts = 0;
	const MAX_RECONNECT = 5;
	let reconnectTimer = null;

	function getUrlParams() {
		const params = new URLSearchParams(window.location.search);
		return {
			roomId: params.get('roomId'),
			playerId: params.get('playerId'),
		};
	}

	function loadFromSession() {
		return {
			roomId: sessionStorage.getItem('roomId'),
			playerId: sessionStorage.getItem('playerId'),
		};
	}

	function connectWebSocket() {
		const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
		const wsUrl = `${protocol}://${window.location.host}`;

		ws = new WebSocket(wsUrl);

		ws.addEventListener('open', () => {
			console.info('[Game] Connected to UNO server');
			reconnectAttempts = 0;
			if (reconnectTimer) {
				clearTimeout(reconnectTimer);
			}

			// Get room/player from URL or session
			const urlParams = getUrlParams();
			const sessionParams = loadFromSession();
			const roomId = urlParams.roomId || sessionParams.roomId;
			const playerId = urlParams.playerId || sessionParams.playerId;

			if (roomId && playerId) {
				state.roomId = roomId;
				state.myPlayerId = playerId;
				sessionStorage.setItem('roomId', roomId);
				sessionStorage.setItem('playerId', playerId);
			}
		});

		ws.addEventListener('message', (event) => {
			try {
				const { type, payload } = JSON.parse(event.data);
				handleMessage(type, payload);
			} catch (err) {
				console.error('[Game] Invalid message:', err);
			}
		});

		ws.addEventListener('close', () => {
			console.warn('[Game] Disconnected from server');
			attemptReconnect();
		});

		ws.addEventListener('error', (err) => {
			console.error('[Game] WebSocket error:', err);
		});
	}

	function attemptReconnect() {
		if (reconnectAttempts >= MAX_RECONNECT) {
			Toast.show('Connection lost. Please refresh the page.', 'error');
			return;
		}

		reconnectAttempts += 1;
		const delay = 3000;

		Toast.show(`Reconnecting... (attempt ${reconnectAttempts}/${MAX_RECONNECT})`, 'warning');
		reconnectTimer = setTimeout(() => {
			connectWebSocket();
		}, delay);
	}

	function send(type, payload = {}) {
		if (!ws || ws.readyState !== WebSocket.OPEN) {
			console.error('[Game] WebSocket not connected');
			return;
		}
		ws.send(JSON.stringify({ type, payload }));
	}

	function handleMessage(type, payload) {
		console.info(`[Game] Message: ${type}`, payload);

		switch (type) {
			case 'GAME_STARTED':
				handleGameStarted(payload);
				break;

			case 'CARD_PLAYED':
				handleCardPlayed(payload);
				break;

			case 'CARDS_DRAWN':
				handleCardsDrawn(payload);
				break;

			case 'UNO_CALLED':
				handleUnoCalled(payload);
				break;

			case 'UNO_PENALIZED':
				handleUnoPenalized(payload);
				break;

			case 'TURN_TIMER':
				handleTurnTimer(payload);
				break;

			case 'GAME_OVER':
				handleGameOver(payload);
				break;

			case 'PLAYER_LEFT':
				handlePlayerLeft(payload);
				break;

			case 'ERROR':
				Toast.show(payload.message || 'Error occurred', 'error');
				break;

			default:
				console.warn(`[Game] Unknown message: ${type}`);
		}
	}

	function handleGameStarted(payload) {
		const { hand, topCard, currentColor, currentPlayerId, players, seats } = payload;

		state.myHand = hand;
		state.topCard = topCard;
		state.currentColor = currentColor;
		state.currentPlayerId = currentPlayerId;
		state.phase = 'playing';

		// Store seat positions
		state.playerSeats = seats;
		state.players = players;

		// Calculate hand sizes
		state.handSizes = {};
		players.forEach((p) => {
			state.handSizes[p.id] = state.myPlayerId === p.id ? hand.length : 7;
		});

		console.info('[Game] Game started!', state);

		renderGameBoard();
		updatePlayerSeats();
		renderPlayerHand();
		updateTurnIndicator();

		Toast.show('Game started! Good luck!', 'success');
	}

	function handleCardPlayed(payload) {
		const { playerId, card, topCard, currentColor, nextPlayerId, effect, handSizes, unoAlert } = payload;

		state.topCard = topCard;
		state.currentColor = currentColor;
		state.currentPlayerId = nextPlayerId;
		state.handSizes = handSizes;

		// Update hand if it's my card
		if (playerId === state.myPlayerId) {
			state.myHand = state.myHand.filter((c) => c.id !== card.id);
		}

		// Show effect
		const effectText = {
			skip: '⊘ SKIP',
			reverse: '↺ REVERSE',
			draw2: '+2 DRAW',
			wild: `🌈 WILD (${currentColor})`,
			wild_draw4: '+4 DRAW WILD',
		}[effect] || 'PLAYED';

		Toast.show(`${state.players.find((p) => p.id === playerId)?.name || 'Player'} ${effectText}`, 'info');

		if (unoAlert) {
			Animations.unoAlert(document.querySelector(`[data-seat="${state.playerSeats[unoAlert.playerId]}"]`));
		}

		renderPlayerHand();
		updatePlayerSeats();
		updateTurnIndicator();
	}

	function handleCardsDrawn(payload) {
		const { playerId, count, nextPlayerId, handSizes, drawnCards } = payload;

		state.currentPlayerId = nextPlayerId;
		state.handSizes = handSizes;

		if (playerId === state.myPlayerId) {
			if (drawnCards) {
				state.myHand.push(...drawnCards);
			}
		}

		Toast.show(
			`${state.players.find((p) => p.id === playerId)?.name || 'Player'} drew ${count} card${count !== 1 ? 's' : ''}`,
			'info'
		);

		renderPlayerHand();
		updatePlayerSeats();
		updateTurnIndicator();
	}

	function handleUnoCalled(payload) {
		const { playerId } = payload;
		const player = state.players.find((p) => p.id === playerId);
		Toast.show(`${player?.name || 'Player'} called UNO!`, 'info');
		Animations.unoAlert(document.querySelector(`[data-seat="${state.playerSeats[playerId]}"]`));
	}

	function handleUnoPenalized(payload) {
		const { targetPlayerId, count } = payload;
		const player = state.players.find((p) => p.id === targetPlayerId);
		Toast.show(`${player?.name || 'Player'} missed UNO! +${count}`, 'warning');
		Animations.unoMissedPenalty(document.querySelector(`[data-seat="${state.playerSeats[targetPlayerId]}"]`));
	}

	function handleTurnTimer(payload) {
		const { playerId, secondsLeft } = payload;
		const timerEl = document.getElementById('timer-text');
		if (timerEl) {
			timerEl.textContent = secondsLeft;
			if (secondsLeft < 10) {
				timerEl.classList.add('warning');
				Animations.timerWarning(timerEl);
			}
		}
	}

	function handleGameOver(payload) {
		const { ranking } = payload;
		state.phase = 'finished';
		state.ranking = ranking;

		renderGameOver();
	}

	function handlePlayerLeft(payload) {
		const { playerId } = payload;
		const player = state.players.find((p) => p.id === playerId);
		if (player) {
			Toast.show(`${player.name} disconnected`, 'warning');
		}
	}

	function renderGameBoard() {
		const discardPile = document.querySelector('.discard-pile');
		if (discardPile && state.topCard) {
			const cardEl = CardRenderer.createCardElement(state.topCard, { size: 'large' });
			CardRenderer.renderDiscardPile(state.topCard, discardPile);
		}
	}

	function updatePlayerSeats() {
		const seatsContainer = document.querySelector('.seats-container');
		if (!seatsContainer) return;

		const seats = seatsContainer.querySelectorAll('.seat');
		seats.forEach((seatEl) => {
			seatEl.innerHTML = '';
			seatEl.classList.remove('visible', 'active');
		});

		state.players.forEach((player) => {
			const seatNum = player.seat;
			const seatEl = document.querySelector(`[data-seat="${seatNum}"]`);
			if (!seatEl) return;

			const seatInfo = document.createElement('div');
			seatInfo.className = 'seat-info';

			const nameEl = document.createElement('div');
			nameEl.className = 'seat-name';
			nameEl.textContent = player.name;

			const countEl = document.createElement('div');
			countEl.className = 'seat-card-count';
			countEl.textContent = `${state.handSizes[player.id] || 0} 🃏`;

			seatInfo.appendChild(nameEl);
			seatInfo.appendChild(countEl);

			if (seatNum !== 0) {
				// Opponent hand
				const handContainer = document.createElement('div');
				handContainer.className = 'opponent-hand';
				CardRenderer.renderOpponentHand(state.handSizes[player.id] || 7, handContainer, {
					direction: seatNum === 1 || seatNum === 3 ? 'vertical' : 'horizontal',
				});
				seatInfo.appendChild(handContainer);
			}

			seatEl.appendChild(seatInfo);
			seatEl.classList.add('visible');

			if (player.id === state.currentPlayerId) {
				seatEl.classList.add('active');
			}
		});
	}

	function renderPlayerHand() {
		const handContainer = document.getElementById('player-hand');
		if (!handContainer) return;

		const playableIds = new Set();
		if (state.currentPlayerId === state.myPlayerId && state.phase === 'playing') {
			// Determine which cards are playable (mock - server validates)
			state.myHand.forEach((card) => {
				playableIds.add(card.id);
			});
		}

		CardRenderer.renderHand(state.myHand, handContainer, {
			playableIds,
			onCardClick: (card) => {
				if (playableIds.has(card.id)) {
					playCard(card);
				}
			},
		});

		updateUnoButtonState();
	}

	function playCard(card) {
		if (state.currentPlayerId !== state.myPlayerId) {
			Toast.show('Not your turn!', 'warning');
			return;
		}

		if (card.value === 'wild' || card.value === 'wild_draw4') {
			Animations.wildColorPicker((color) => {
				send('PLAY_CARD', {
					roomId: state.roomId,
					cardId: card.id,
					chosenColor: color,
				});
			});
		} else {
			send('PLAY_CARD', {
				roomId: state.roomId,
				cardId: card.id,
			});
		}
	}

	function drawCard() {
		if (state.currentPlayerId !== state.myPlayerId) {
			Toast.show('Not your turn!', 'warning');
			return;
		}

		send('DRAW_CARD', { roomId: state.roomId });
	}

	function callUno() {
		send('CALL_UNO', { roomId: state.roomId });
	}

	function updateUnoButtonState() {
		const unoBtn = document.getElementById('uno-btn');
		if (!unoBtn) return;

		const canCallUno = state.currentPlayerId === state.myPlayerId && state.myHand.length === 2;
		unoBtn.disabled = !canCallUno;

		if (canCallUno && window.anime) {
			window.anime({
				targets: unoBtn,
				scale: [1, 1.05, 1],
				duration: 600,
				loop: true,
				easing: 'easeInOutQuad',
			});
		}
	}

	function updateTurnIndicator() {
		const indicator = document.getElementById('current-player-name');
		if (!indicator) return;

		if (state.phase !== 'playing') {
			indicator.textContent = 'Game Finished';
			return;
		}

		const currentPlayer = state.players.find((p) => p.id === state.currentPlayerId);
		const isMyTurn = state.currentPlayerId === state.myPlayerId;

		indicator.innerHTML = isMyTurn
			? `<span style="color: var(--vegas-gold);">🎯 YOUR TURN</span>`
			: `<span>${currentPlayer?.name || 'Waiting'}'s turn</span>`;

		const timerEl = document.getElementById('turn-timer');
		if (timerEl) {
			timerEl.classList.toggle('active', isMyTurn);
		}
	}

	function renderGameOver() {
		const overlay = document.getElementById('game-over-overlay');
		const list = document.getElementById('ranking-list');

		if (!overlay || !list) return;

		list.innerHTML = state.ranking
			.map(
				(item, index) => `
			<div class="ranking-item ${['gold', 'silver', 'bronze', 'other'][index] || 'other'}">
				<div class="ranking-place">#${index + 1}</div>
				<div class="ranking-name">${item.name}</div>
			</div>
		`
			)
			.join('');

		overlay.classList.add('active');

		Animations.gameOver(state.ranking);
	}

	function setupEventListeners() {
		const unoBtn = document.getElementById('uno-btn');
		if (unoBtn) {
			unoBtn.addEventListener('click', callUno);
		}

		const drawPile = document.querySelector('.draw-pile');
		if (drawPile) {
			drawPile.addEventListener('click', drawCard);
		}

		const backBtn = document.getElementById('back-to-lobby-btn');
		if (backBtn) {
			backBtn.addEventListener('click', () => {
				window.location.href = '/';
			});
		}
	}

	function init() {
		connectWebSocket();
		setupEventListeners();
	}

	return { init };
})();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', () => GameClient.init());
} else {
	GameClient.init();
}
