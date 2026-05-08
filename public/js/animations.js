/* Animation System using anime.js */

const Animations = (() => {
	function ensureAnime() {
		if (!window.anime) {
			console.warn('anime.js not loaded');
			return null;
		}
		return window.anime;
	}

	function dealCards(playerSeats) {
		const anime = ensureAnime();
		if (!anime) return Promise.resolve();

		const promises = [];
		const deckEl = document.querySelector('.draw-pile');
		if (!deckEl) return Promise.resolve();

		let cardIndex = 0;
		for (const seat of playerSeats) {
			const seatEl = document.querySelector(`[data-seat="${seat}"]`);
			if (!seatEl) continue;

			for (let i = 0; i < 7; i += 1) {
				const delay = (cardIndex * 80);
				promises.push(
					new Promise((resolve) => {
						setTimeout(() => {
							anime({
								targets: {},
								duration: 400,
								complete: resolve,
							});
						}, delay);
					})
				);
				cardIndex += 1;
			}
		}

		return Promise.all(promises);
	}

	function playCard(cardEl, discardPileEl) {
		const anime = ensureAnime();
		if (!anime) return Promise.resolve();

		const discardRect = discardPileEl.getBoundingClientRect();
		const cardRect = cardEl.getBoundingClientRect();

		return new Promise((resolve) => {
			anime({
				targets: cardEl,
				left: discardRect.left - cardRect.left,
				top: discardRect.top - cardRect.top,
				rotate: (Math.random() - 0.5) * 30,
				scale: 0.9,
				duration: 400,
				easing: 'easeInOutQuad',
				complete: () => {
					anime({
						targets: discardPileEl,
						scale: [1, 1.1, 1],
						duration: 300,
						easing: 'easeOutBounce',
						complete: resolve,
					});
				},
			});
		});
	}

	function drawCard(deckEl, targetHandEl) {
		const anime = ensureAnime();
		if (!anime) return Promise.resolve();

		return new Promise((resolve) => {
			anime({
				targets: targetHandEl,
				opacity: [0.5, 1],
				duration: 300,
				easing: 'easeOutQuad',
				complete: resolve,
			});
		});
	}

	function skipEffect(playerNameEl) {
		const anime = ensureAnime();
		if (!anime) return Promise.resolve();

		return new Promise((resolve) => {
			const skipEl = document.createElement('div');
			skipEl.textContent = '⊘';
			skipEl.style.position = 'absolute';
			skipEl.style.fontSize = '2rem';
			skipEl.style.color = 'var(--casino-red)';
			skipEl.style.fontWeight = 'bold';
			skipEl.style.pointerEvents = 'none';

			const rect = playerNameEl.getBoundingClientRect();
			skipEl.style.left = `${rect.left}px`;
			skipEl.style.top = `${rect.top - 40}px`;
			document.body.appendChild(skipEl);

			anime({
				targets: skipEl,
				translateY: -60,
				opacity: [1, 0],
				rotate: 360,
				duration: 800,
				easing: 'easeOutQuad',
				complete: () => {
					skipEl.remove();
					resolve();
				},
			});

			anime({
				targets: playerNameEl,
				translateX: [0, -10, 10, -5, 5, 0],
				duration: 400,
				easing: 'easeInOutQuad',
			});
		});
	}

	function reverseEffect(tableEl) {
		const anime = ensureAnime();
		if (!anime) return Promise.resolve();

		return new Promise((resolve) => {
			anime({
				targets: tableEl,
				rotate: 360,
				duration: 600,
				easing: 'easeInOutQuad',
				complete: resolve,
			});
		});
	}

	function drawPenaltyCards(playerEl, count) {
		const anime = ensureAnime();
		if (!anime) return Promise.resolve();

		const promises = [];
		const rect = playerEl.getBoundingClientRect();

		for (let i = 0; i < count; i += 1) {
			const card = document.createElement('div');
			card.style.position = 'fixed';
			card.style.left = `${rect.left + Math.random() * 40 - 20}px`;
			card.style.top = `${rect.top - 100}px`;
			card.style.width = '40px';
			card.style.height = '60px';
			card.style.background = 'linear-gradient(135deg, #d42b2b, #8b0000)';
			card.style.border = '2px solid #ff6b6b';
			card.style.borderRadius = '6px';
			card.style.pointerEvents = 'none';
			card.style.zIndex = '999';
			document.body.appendChild(card);

			promises.push(
				new Promise((resolve) => {
					anime({
						targets: card,
						translateY: 120,
						translateX: (Math.random() - 0.5) * 60,
						rotate: Math.random() * 360,
						opacity: [1, 0],
						duration: 800 + i * 100,
						delay: i * 50,
						easing: 'easeInOutQuad',
						complete: () => {
							card.remove();
							resolve();
						},
					});
				})
			);
		}

		return Promise.all(promises);
	}

	function unoAlert(playerNameEl) {
		const anime = ensureAnime();
		if (!anime) return Promise.resolve();

		const rect = playerNameEl.getBoundingClientRect();
		const unoText = document.createElement('div');
		unoText.textContent = '🎯 UNO!';
		unoText.style.position = 'fixed';
		unoText.style.left = `${rect.left}px`;
		unoText.style.top = `${rect.top - 60}px`;
		unoText.style.fontSize = '2.4rem';
		unoText.style.fontWeight = 'bold';
		unoText.style.color = 'var(--vegas-gold)';
		unoText.style.pointerEvents = 'none';
		unoText.style.zIndex = '999';
		unoText.style.textShadow = '0 0 20px var(--casino-red)';
		document.body.appendChild(unoText);

		return new Promise((resolve) => {
			anime({
				targets: unoText,
				scale: [0, 1.5, 1],
				opacity: [1, 1, 0],
				rotate: [0, 10, 0],
				duration: 1200,
				easing: 'easeOutBounce',
				complete: () => {
					unoText.remove();
					resolve();
				},
			});
		});
	}

	function unoMissedPenalty(playerEl) {
		const anime = ensureAnime();
		if (!anime) return Promise.resolve();

		const rect = playerEl.getBoundingClientRect();
		const xEl = document.createElement('div');
		xEl.textContent = '❌';
		xEl.style.position = 'fixed';
		xEl.style.left = `${rect.left}px`;
		xEl.style.top = `${rect.top - 40}px`;
		xEl.style.fontSize = '2rem';
		xEl.style.pointerEvents = 'none';
		xEl.style.zIndex = '999';
		document.body.appendChild(xEl);

		return new Promise((resolve) => {
			anime({
				targets: xEl,
				translateX: [0, -10, 10, -10, 10, 0],
				opacity: [1, 0.8, 1, 0.8, 1, 0],
				duration: 600,
				easing: 'easeInOutQuad',
				complete: () => {
					xEl.remove();
					resolve();
				},
			});
		});
	}

	function turnIndicator(playerSeat) {
		const anime = ensureAnime();
		if (!anime) return Promise.resolve();

		const seatEl = document.querySelector(`[data-seat="${playerSeat}"]`);
		if (!seatEl) return Promise.resolve();

		anime({
			targets: seatEl,
			filter: [
				'drop-shadow(0 0 8px rgba(212, 175, 55, 0.4))',
				'drop-shadow(0 0 16px rgba(212, 175, 55, 0.8))',
				'drop-shadow(0 0 8px rgba(212, 175, 55, 0.4))',
			],
			duration: 1500,
			loop: true,
			easing: 'easeInOutQuad',
		});

		return Promise.resolve();
	}

	function gameOver(rankingData) {
		const anime = ensureAnime();
		if (!anime) return Promise.resolve();

		const overlay = document.querySelector('.game-over-overlay');
		if (!overlay) return Promise.resolve();

		overlay.classList.add('active');

		const items = document.querySelectorAll('.ranking-item');
		const promises = [];

		items.forEach((item, index) => {
			promises.push(
				new Promise((resolve) => {
					anime({
						targets: item,
						scale: [0, 1.1, 1],
						opacity: [0, 1],
						duration: 600,
						delay: index * 150,
						easing: 'easeOutBounce',
						complete: resolve,
					});
				})
			);
		});

		return Promise.all(promises);
	}

	function cardHoverLift(cardEl) {
		if (!window.anime) return;

		cardEl.addEventListener('mouseenter', () => {
			window.anime({
				targets: cardEl,
				translateY: -15,
				boxShadow: '0 12px 30px rgba(0, 0, 0, 0.8)',
				duration: 300,
				easing: 'easeOutQuad',
			});
		});

		cardEl.addEventListener('mouseleave', () => {
			window.anime({
				targets: cardEl,
				translateY: 0,
				boxShadow: '0 8px 20px rgba(0, 0, 0, 0.5)',
				duration: 300,
				easing: 'easeOutQuad',
			});
		});
	}

	function wildColorPicker(callback) {
		const anime = ensureAnime();
		if (!anime) {
			callback('red');
			return Promise.resolve();
		}

		const overlay = document.createElement('div');
		overlay.style.position = 'fixed';
		overlay.style.top = 0;
		overlay.style.left = 0;
		overlay.style.width = '100%';
		overlay.style.height = '100%';
		overlay.style.background = 'rgba(0, 0, 0, 0.7)';
		overlay.style.display = 'flex';
		overlay.style.alignItems = 'center';
		overlay.style.justifyContent = 'center';
		overlay.style.zIndex = '300';
		overlay.style.backdropFilter = 'blur(4px)';

		const colors = [
			{ color: '#d42b2b', label: 'red' },
			{ color: '#2d7a2d', label: 'green' },
			{ color: '#1a5fb4', label: 'blue' },
			{ color: '#d4a017', label: 'yellow' },
		];

		const container = document.createElement('div');
		container.style.display = 'grid';
		container.style.gridTemplateColumns = 'repeat(2, 150px)';
		container.style.gap = '30px';
		container.style.position = 'relative';
		container.style.zIndex = '301';

		const circles = [];

		colors.forEach(({ color, label }) => {
			const circle = document.createElement('div');
			circle.style.width = '150px';
			circle.style.height = '150px';
			circle.style.background = color;
			circle.style.borderRadius = '50%';
			circle.style.cursor = 'pointer';
			circle.style.border = '3px solid rgba(212, 175, 55, 0.5)';
			circle.style.display = 'grid';
			circle.style.placeItems = 'center';
			circle.style.fontSize = '2rem';
			circle.style.fontWeight = 'bold';
			circle.style.color = 'white';
			circle.style.userSelect = 'none';
			circle.style.transition = 'all 0.2s';

			const text = document.createElement('span');
			text.textContent = ['🔴', '🟢', '🔵', '🟡'][colors.indexOf({ color, label })];
			circle.appendChild(text);

			circle.addEventListener('click', () => {
				anime({
					targets: circle,
					scale: 2,
					opacity: 0,
					duration: 400,
					easing: 'easeInOutQuad',
					complete: () => {
						overlay.remove();
						callback(label);
					},
				});
			});

			circle.addEventListener('mouseenter', () => {
				anime({
					targets: circle,
					scale: 1.1,
					boxShadow: `0 0 30px ${color}`,
				});
			});

			circle.addEventListener('mouseleave', () => {
				anime({
					targets: circle,
					scale: 1,
					boxShadow: 'none',
				});
			});

			container.appendChild(circle);
			circles.push(circle);
		});

		overlay.appendChild(container);
		document.body.appendChild(overlay);

		circles.forEach((circle, index) => {
			anime({
				targets: circle,
				scale: [0, 1],
				opacity: [0, 1],
				duration: 600,
				delay: index * 100,
				easing: 'easeOutBounce',
			});
		});

		return new Promise((resolve) => {
			// Callback will resolve it
		});
	}

	function timerWarning(timerEl) {
		const anime = ensureAnime();
		if (!anime) return;

		anime({
			targets: timerEl,
			scale: [1, 1.1, 1],
			color: [
				'var(--vegas-gold)',
				'var(--casino-red)',
				'var(--vegas-gold)',
			],
			duration: 500,
			loop: true,
			easing: 'easeInOutQuad',
		});
	}

	return {
		dealCards,
		playCard,
		drawCard,
		skipEffect,
		reverseEffect,
		drawPenaltyCards,
		unoAlert,
		unoMissedPenalty,
		turnIndicator,
		gameOver,
		cardHoverLift,
		wildColorPicker,
		timerWarning,
	};
})();

window.Animations = Animations;
