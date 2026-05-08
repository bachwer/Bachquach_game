/* Lobby UI and WebSocket Client */

const LobbyClient = (() => {
	let ws = null;
	let currentRoomId = null;
	let currentPlayerId = null;
	let currentMaxPlayers = 4;

	function showToast(message, type = 'info') {
		Toast.show(message, type);
	}

	function connectWebSocket() {
		const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
		const wsUrl = `${protocol}://${window.location.host}`;

		ws = new WebSocket(wsUrl);

		ws.addEventListener('open', () => {
			console.info('[Lobby] Connected to UNO server');
		});

		ws.addEventListener('message', (event) => {
			try {
				const { type, payload } = JSON.parse(event.data);
				handleMessage(type, payload);
			} catch (err) {
				console.error('[Lobby] Invalid message:', err);
			}
		});

		ws.addEventListener('close', () => {
			console.warn('[Lobby] Disconnected from server');
			showToast('Connection lost. Refresh page to reconnect.', 'error');
		});

		ws.addEventListener('error', (err) => {
			console.error('[Lobby] WebSocket error:', err);
			showToast('Connection error. Please try again.', 'error');
		});
	}

	function handleMessage(type, payload) {
		switch (type) {
			case 'ROOM_CREATED':
				handleRoomCreated(payload);
				break;

			case 'ROOM_JOINED':
				handleRoomJoined(payload);
				break;

			case 'PLAYER_JOINED':
				handlePlayerJoined(payload);
				break;

			case 'ERROR':
				handleError(payload);
				break;

			default:
				console.warn(`[Lobby] Unknown message type: ${type}`);
		}
	}

	function handleRoomCreated(payload) {
		const { roomId, playerId, seat } = payload;
		currentRoomId = roomId;
		currentPlayerId = playerId;

		// Store in sessionStorage
		sessionStorage.setItem('roomId', roomId);
		sessionStorage.setItem('playerId', playerId);

		// Show room code
		document.getElementById('room-code-display').textContent = roomId;
		document.getElementById('create-loading').classList.add('hidden');
		document.getElementById('create-form').classList.add('hidden');
		document.getElementById('create-success').classList.remove('hidden');

		console.info(`[Lobby] Room created: ${roomId}`);
	}

	function handleRoomJoined(payload) {
		const { roomId, playerId, seat, players } = payload;
		currentRoomId = roomId;
		currentPlayerId = playerId;

		sessionStorage.setItem('roomId', roomId);
		sessionStorage.setItem('playerId', playerId);

		// Update player list
		const playersList = document.getElementById('joined-players-list');
		playersList.innerHTML = players
			.map(
				(player) =>
					`<div class="player-item">
				<div class="seat-num">${player.seat + 1}</div>
				<div class="name">${player.name}</div>
				${player.isHost ? '<div class="badge">HOST</div>' : ''}
			</div>`
			)
			.join('');

		document.getElementById('join-form').classList.add('hidden');
		document.getElementById('join-loading').classList.add('hidden');
		document.getElementById('join-waiting').classList.remove('hidden');

		console.info(`[Lobby] Joined room: ${roomId}`);
	}

	function handlePlayerJoined(payload) {
		const { player } = payload;
		console.info(`[Lobby] Player joined: ${player.name}`);

		// Update waiting room player list if visible
		const waitingDiv = document.getElementById('join-waiting');
		if (!waitingDiv.classList.contains('hidden')) {
			// Fetch current room state by sending ping - or just show a notification
			showToast(`${player.name} joined the table!`, 'info');
		}
	}

	function handleError(payload) {
		const { message } = payload;
		console.error('[Lobby] Server error:', message);
		showToast(message || 'An error occurred', 'error');

		// Hide loading states
		document.getElementById('create-loading').classList.add('hidden');
		document.getElementById('join-loading').classList.add('hidden');
	}

	function validateName(name) {
		const trimmed = name.trim();
		if (!trimmed) {
			return { valid: false, error: 'Name is required' };
		}
		if (trimmed.length < 2) {
			return { valid: false, error: 'Name must be at least 2 characters' };
		}
		if (trimmed.length > 20) {
			return { valid: false, error: 'Name must be 20 characters or less' };
		}
		if (!/^[A-Za-z0-9 ]+$/.test(trimmed)) {
			return { valid: false, error: 'Name can only contain letters, numbers, and spaces' };
		}
		return { valid: true };
	}

	function validateRoomCode(code) {
		const upper = code.trim().toUpperCase();
		if (!upper) {
			return { valid: false, error: 'Room code is required' };
		}
		if (upper.length !== 6) {
			return { valid: false, error: 'Room code must be exactly 6 characters' };
		}
		if (!/^[A-Z0-9]+$/.test(upper)) {
			return { valid: false, error: 'Room code must contain only letters and numbers' };
		}
		return { valid: true, value: upper };
	}

	function showError(fieldId, message) {
		const errorEl = document.getElementById(fieldId);
		if (errorEl) {
			errorEl.textContent = message;
			errorEl.classList.add('show');
		}
	}

	function clearError(fieldId) {
		const errorEl = document.getElementById(fieldId);
		if (errorEl) {
			errorEl.textContent = '';
			errorEl.classList.remove('show');
		}
	}

	function setupCreateRoom() {
		const form = document.getElementById('create-form');
		const nameInput = document.getElementById('create-name');
		const passwordInput = document.getElementById('create-password');
		const numberBtns = document.querySelectorAll('.number-btn');
		const submitBtn = form.querySelector('button[type="submit"]');

		// Number selector
		numberBtns.forEach((btn) => {
			btn.addEventListener('click', (e) => {
				e.preventDefault();
				numberBtns.forEach((b) => b.classList.remove('selected'));
				btn.classList.add('selected');
				currentMaxPlayers = parseInt(btn.dataset.max, 10);
			});
		});

		// Form submission
		form.addEventListener('submit', (e) => {
			e.preventDefault();

			clearError('create-name-error');
			clearError('create-password-error');

			const nameVal = nameInput.value.trim();
			const nameValidation = validateName(nameVal);

			if (!nameValidation.valid) {
				showError('create-name-error', nameValidation.error);
				return;
			}

			const passwordVal = passwordInput.value.trim() || null;

			if (passwordVal && passwordVal.length > 20) {
				showError('create-password-error', 'Password must be 20 characters or less');
				return;
			}

			document.getElementById('create-form').classList.add('hidden');
			document.getElementById('create-loading').classList.remove('hidden');

			// Send CREATE_ROOM
			if (!ws || ws.readyState !== WebSocket.OPEN) {
				showToast('Not connected to server', 'error');
				document.getElementById('create-form').classList.remove('hidden');
				document.getElementById('create-loading').classList.add('hidden');
				return;
			}

			ws.send(
				JSON.stringify({
					type: 'CREATE_ROOM',
					payload: {
						name: nameVal,
						password: passwordVal,
						mode: 'ffa',
						maxPlayers: currentMaxPlayers,
					},
				})
			);
		});

		// Go to game button
		document.getElementById('go-to-game-btn').addEventListener('click', () => {
			window.location.href = `/game?roomId=${currentRoomId}&playerId=${currentPlayerId}`;
		});

		// Copy code button
		document.getElementById('copy-code-btn').addEventListener('click', () => {
			const code = document.getElementById('room-code-display').textContent;
			navigator.clipboard.writeText(code).then(() => {
				showToast('Room code copied to clipboard!', 'success');
			});
		});
	}

	function setupJoinRoom() {
		const form = document.getElementById('join-form');
		const nameInput = document.getElementById('join-name');
		const codeInput = document.getElementById('join-code');
		const passwordInput = document.getElementById('join-password');

		// Auto-uppercase room code
		codeInput.addEventListener('input', (e) => {
			e.target.value = e.target.value.toUpperCase();
		});

		form.addEventListener('submit', (e) => {
			e.preventDefault();

			clearError('join-name-error');
			clearError('join-code-error');
			clearError('join-password-error');

			const nameVal = nameInput.value.trim();
			const nameValidation = validateName(nameVal);

			if (!nameValidation.valid) {
				showError('join-name-error', nameValidation.error);
				return;
			}

			const codeVal = codeInput.value.trim();
			const codeValidation = validateRoomCode(codeVal);

			if (!codeValidation.valid) {
				showError('join-code-error', codeValidation.error);
				return;
			}

			const passwordVal = passwordInput.value.trim() || null;

			document.getElementById('join-form').classList.add('hidden');
			document.getElementById('join-loading').classList.remove('hidden');

			if (!ws || ws.readyState !== WebSocket.OPEN) {
				showToast('Not connected to server', 'error');
				document.getElementById('join-form').classList.remove('hidden');
				document.getElementById('join-loading').classList.add('hidden');
				return;
			}

			ws.send(
				JSON.stringify({
					type: 'JOIN_ROOM',
					payload: {
						roomId: codeValidation.value,
						password: passwordVal,
						name: nameVal,
					},
				})
			);
		});
	}

	function setupModals() {
		const createModal = document.getElementById('create-modal');
		const joinModal = document.getElementById('join-modal');

		document.getElementById('create-room-btn').addEventListener('click', () => {
			createModal.classList.add('active');
		});

		document.getElementById('join-room-btn').addEventListener('click', () => {
			joinModal.classList.add('active');
		});

		document.getElementById('create-modal-close').addEventListener('click', () => {
			createModal.classList.remove('active');
			resetCreateForm();
		});

		document.getElementById('join-modal-close').addEventListener('click', () => {
			joinModal.classList.remove('active');
			resetJoinForm();
		});

		document.getElementById('create-cancel').addEventListener('click', () => {
			createModal.classList.remove('active');
			resetCreateForm();
		});

		document.getElementById('join-cancel').addEventListener('click', () => {
			joinModal.classList.remove('active');
			resetJoinForm();
		});

		// Close on overlay click
		document.getElementById('create-modal').addEventListener('click', (e) => {
			if (e.target === createModal) {
				createModal.classList.remove('active');
				resetCreateForm();
			}
		});

		document.getElementById('join-modal').addEventListener('click', (e) => {
			if (e.target === joinModal) {
				joinModal.classList.remove('active');
				resetJoinForm();
			}
		});
	}

	function resetCreateForm() {
		document.getElementById('create-form').classList.remove('hidden');
		document.getElementById('create-loading').classList.add('hidden');
		document.getElementById('create-success').classList.add('hidden');
		document.getElementById('create-form').reset();
		clearError('create-name-error');
		clearError('create-password-error');
		currentMaxPlayers = 4;
		document.querySelector('[data-max="4"]').classList.add('selected');
	}

	function resetJoinForm() {
		document.getElementById('join-form').classList.remove('hidden');
		document.getElementById('join-loading').classList.add('hidden');
		document.getElementById('join-waiting').classList.add('hidden');
		document.getElementById('join-form').reset();
		clearError('join-name-error');
		clearError('join-code-error');
		clearError('join-password-error');
	}

	function init() {
		connectWebSocket();
		setupModals();
		setupCreateRoom();
		setupJoinRoom();

		// Animate page load
		if (window.anime) {
			const panel = document.querySelector('.lobby-panel');
			window.anime({
				targets: panel,
				opacity: [0, 1],
				translateY: [50, 0],
				duration: 800,
				easing: 'easeOutQuad',
			});

			const fan = document.querySelector('.card-fan');
			if (fan) {
				window.anime({
					targets: fan,
					opacity: [0, 1],
					translateY: [-30, 0],
					duration: 1000,
					delay: 200,
					easing: 'easeOutQuad',
				});
			}

			const buttons = document.querySelectorAll('.action-buttons button');
			window.anime({
				targets: buttons,
				opacity: [0, 1],
				translateY: [20, 0],
				duration: 600,
				delay: window.anime.stagger(150, { start: 600 }),
				easing: 'easeOutQuad',
			});
		}
	}

	return { init };
})();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', () => LobbyClient.init());
} else {
	LobbyClient.init();
}
