/* Card Rendering Engine - Pure CSS UNO Cards */

const CardRenderer = (() => {
	const COLORS = {
		red: '#d42b2b',
		green: '#2d7a2d',
		blue: '#1a5fb4',
		yellow: '#d4a017',
		wild: 'conic-gradient(#d42b2b 0% 25%, #2d7a2d 25% 50%, #1a5fb4 50% 75%, #d4a017 75% 100%)',
	};

	const BORDERS = {
		red: '#ff6b6b',
		green: '#4ade80',
		blue: '#60a5fa',
		yellow: '#fde047',
		wild: '#d4af37',
	};

	const ICON_MAP = {
		'0': '0',
		'1': '1',
		'2': '2',
		'3': '3',
		'4': '4',
		'5': '5',
		'6': '6',
		'7': '7',
		'8': '8',
		'9': '9',
		skip: '⊘',
		reverse: '↺',
		draw2: '+2',
		wild: '🌈',
		wild_draw4: '+4',
	};

	function getCardDimensions(size = 'normal') {
		const sizes = {
			small: { width: 65, height: 100 },
			normal: { width: 80, height: 120 },
			large: { width: 100, height: 150 },
		};
		return sizes[size] || sizes.normal;
	}

	function createCardElement(card, options = {}) {
		const {
			size = 'normal',
			faceDown = false,
			playable = false,
			selected = false,
		} = options;

		const dims = getCardDimensions(size);
		const cardEl = document.createElement('div');
		cardEl.className = 'uno-card';
		cardEl.setAttribute('data-card-id', card.id);
		cardEl.setAttribute('data-color', card.color);
		cardEl.setAttribute('data-value', card.value);

		if (faceDown) {
			cardEl.classList.add('face-down');
		}
		if (playable) {
			cardEl.classList.add('playable');
		}
		if (selected) {
			cardEl.classList.add('selected');
		}

		cardEl.style.width = `${dims.width}px`;
		cardEl.style.height = `${dims.height}px`;

		const innerHTML = faceDown ? getCardBackHTML() : getCardFrontHTML(card);
		cardEl.innerHTML = innerHTML;

		applyCardStyling(cardEl, card, faceDown);

		return cardEl;
	}

	function getCardBackHTML() {
		return `
			<div class="card-back">
				<div class="back-pattern"></div>
				<div class="back-logo">UNO</div>
			</div>
		`;
	}

	function getCardFrontHTML(card) {
		const icon = ICON_MAP[card.value] || '?';
		const isWild = card.color === 'wild';

		return `
			<div class="card-inner">
				<div class="card-corner top-left">
					<span class="card-value">${icon}</span>
				</div>
				<div class="card-center">
					${isWild ? '<div class="wild-icon">🃏</div>' : `<div class="card-symbol">${getSuitSymbol(card.value)}</div>`}
				</div>
				<div class="card-corner bottom-right">
					<span class="card-value">${icon}</span>
				</div>
			</div>
		`;
	}

	function getSuitSymbol(value) {
		const symbols = {
			skip: '⊘',
			reverse: '↺',
			draw2: '②',
		};
		return symbols[value] || '●';
	}

	function applyCardStyling(cardEl, card, faceDown) {
		const style = cardEl.style;
		const colorKey = card.color === 'wild' ? 'wild' : card.color;
		const borderColor = BORDERS[colorKey] || '#d4af37';

		if (!faceDown) {
			const bgGradient = COLORS[colorKey];
			style.background = bgGradient;
			style.borderColor = borderColor;
		} else {
			style.background = 'linear-gradient(135deg, #1a0a0a, #0d0505)';
			style.borderColor = '#d4af37';
		}

		style.border = '3px solid';
		style.borderRadius = '12px';
		style.display = 'flex';
		style.alignItems = 'center';
		style.justifyContent = 'center';
		style.flexDirection = 'column';
		style.position = 'relative';
		style.cursor = 'pointer';
		style.boxShadow = faceDown
			? 'inset 0 1px 0 rgba(212, 175, 55, 0.2), 0 8px 20px rgba(0, 0, 0, 0.6)'
			: `inset 0 1px 0 rgba(255, 255, 255, 0.1), 0 8px 20px rgba(0, 0, 0, 0.5), 0 0 15px ${borderColor}33`;
	}

	function renderHand(cards, container, options = {}) {
		const { playableIds = new Set(), onCardClick = null } = options;

		container.innerHTML = '';

		const cardCount = cards.length;
		const totalRotation = 40; // total spread
		const rotationPerCard = cardCount > 1 ? totalRotation / (cardCount - 1) : 0;

		cards.forEach((card, index) => {
			const isPlayable = playableIds.has(card.id);
			const cardEl = createCardElement(card, {
				size: 'normal',
				playable: isPlayable,
			});

			// Fan layout
			const rotationDegrees = -totalRotation / 2 + index * rotationPerCard;
			cardEl.style.transform = `rotateZ(${rotationDegrees}deg)`;
			cardEl.style.transformOrigin = 'center 140%';
			cardEl.style.marginLeft = index > 0 ? '-30px' : '0';
			cardEl.style.transition = 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)';

			if (isPlayable && onCardClick) {
				cardEl.addEventListener('click', () => onCardClick(card));
			}

			container.appendChild(cardEl);
		});
	}

	function renderOpponentHand(count, container, options = {}) {
		const { direction = 'horizontal' } = options;

		container.innerHTML = '';

		for (let i = 0; i < count; i += 1) {
			const fakeCard = { id: `opponent-${i}`, color: 'red', value: '0' };
			const cardEl = createCardElement(fakeCard, {
				size: 'small',
				faceDown: true,
			});

			if (direction === 'horizontal') {
				cardEl.style.marginLeft = i > 0 ? '-15px' : '0';
			} else {
				cardEl.style.marginTop = i > 0 ? '-20px' : '0';
			}

			container.appendChild(cardEl);
		}
	}

	function renderDiscardPile(card, container) {
		container.innerHTML = '';

		const cardEl = createCardElement(card, { size: 'large' });
		cardEl.style.position = 'absolute';
		cardEl.style.width = '100px';
		cardEl.style.height = '150px';

		container.appendChild(cardEl);
	}

	function animateCardDeal(cardEl, fromEl, toEl, delay = 0) {
		return new Promise((resolve) => {
			if (!window.anime) {
				resolve();
				return;
			}

			const fromRect = fromEl.getBoundingClientRect();
			const toRect = toEl.getBoundingClientRect();

			const startX = fromRect.left + fromRect.width / 2;
			const startY = fromRect.top + fromRect.height / 2;
			const endX = toRect.left + toRect.width / 2;
			const endY = toRect.top + toRect.height / 2;

			const clone = cardEl.cloneNode(true);
			clone.style.position = 'fixed';
			clone.style.zIndex = '999';
			clone.style.left = `${startX - cardEl.offsetWidth / 2}px`;
			clone.style.top = `${startY - cardEl.offsetHeight / 2}px`;
			clone.style.pointerEvents = 'none';
			document.body.appendChild(clone);

			window.anime({
				targets: clone,
				left: endX - cardEl.offsetWidth / 2,
				top: endY - cardEl.offsetHeight / 2,
				rotate: Math.random() * 20 - 10,
				duration: 600 + delay,
				delay,
				easing: 'easeInOutQuad',
				complete: () => {
					clone.remove();
					resolve();
				},
			});
		});
	}

	function animateCardPlay(cardEl, toEl) {
		return new Promise((resolve) => {
			if (!window.anime) {
				resolve();
				return;
			}

			const fromRect = cardEl.getBoundingClientRect();
			const toRect = toEl.getBoundingClientRect();

			window.anime({
				targets: cardEl,
				left: toRect.left - fromRect.left,
				top: toRect.top - fromRect.top,
				rotate: (Math.random() - 0.5) * 30,
				scale: 0.9,
				duration: 400,
				easing: 'easeInOutQuad',
				complete: () => {
					resolve();
				},
			});
		});
	}

	function getCardLabel(card) {
		const colorLabel = card.color.charAt(0).toUpperCase() + card.color.slice(1);
		const valueLabel = String(card.value).toUpperCase();
		return `${colorLabel} ${valueLabel}`;
	}

	return {
		createCardElement,
		renderHand,
		renderOpponentHand,
		renderDiscardPile,
		animateCardDeal,
		animateCardPlay,
		getCardLabel,
	};
})();

window.CardRenderer = CardRenderer;
