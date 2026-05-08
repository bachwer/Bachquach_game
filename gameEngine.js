const { v4: uuidv4 } = require('uuid');

const COLORS = ['red', 'green', 'blue', 'yellow'];
const NUMBER_VALUES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const ACTION_VALUES = ['skip', 'reverse', 'draw2'];

class GameEngine {
	constructor(players) {
		this.players = Array.isArray(players) ? [...players] : [];
		this.initialPlayers = [...this.players];
		this.hands = new Map();
		this.deck = [];
		this.discardPile = [];
		this.currentPlayerIndex = 0;
		this.direction = 1;
		this.pendingDrawCount = 0;
		this.currentColor = null;
		this.phase = 'waiting';
		this.ranking = [];
		this.unoCalledBy = new Set();
	}

	initGame() {
		if (this.players.length < 2) {
			throw new Error('At least 2 players are required to start.');
		}

		this.deck = this.#buildDeck();
		this.#shuffle(this.deck);
		this.discardPile = [];
		this.hands.clear();
		this.ranking = [];
		this.unoCalledBy.clear();
		this.pendingDrawCount = 0;
		this.direction = 1;
		this.currentPlayerIndex = 0;

		for (const player of this.players) {
			this.hands.set(player.id, this.#drawFromDeck(7));
		}

		let firstCard = this.#drawFromDeck(1)[0];
		while (firstCard && firstCard.value === 'wild_draw4') {
			this.deck.push(firstCard);
			this.#shuffle(this.deck);
			firstCard = this.#drawFromDeck(1)[0];
		}

		if (!firstCard) {
			throw new Error('Unable to initialize discard pile.');
		}

		this.discardPile.push(firstCard);
		if (firstCard.color === 'wild') {
			this.currentColor = COLORS[Math.floor(Math.random() * COLORS.length)];
		} else {
			this.currentColor = firstCard.color;
		}

		this.phase = 'playing';

		return {
			hands: this.hands,
			topCard: firstCard,
			currentPlayerId: this.#getCurrentPlayer()?.id || null,
		};
	}

	canPlayCard(playerId, cardId) {
		if (this.phase !== 'playing') {
			return false;
		}

		const current = this.#getCurrentPlayer();
		if (!current || current.id !== playerId) {
			return false;
		}

		const hand = this.hands.get(playerId) || [];
		const card = hand.find((item) => item.id === cardId);
		if (!card) {
			return false;
		}

		const topCard = this.#getTopCard();
		if (!topCard) {
			return true;
		}

		if (this.pendingDrawCount > 0) {
			if (topCard.value === 'draw2') {
				return card.value === 'draw2' || card.value === 'wild_draw4';
			}
			return card.value === 'wild_draw4';
		}

		if (card.color === 'wild') {
			return true;
		}

		return card.color === this.currentColor || card.value === topCard.value;
	}

	playCard(playerId, cardId, chosenColor) {
		if (!this.canPlayCard(playerId, cardId)) {
			throw new Error('Invalid card play.');
		}

		const hand = this.hands.get(playerId) || [];
		const cardIndex = hand.findIndex((item) => item.id === cardId);
		const [card] = hand.splice(cardIndex, 1);
		this.discardPile.push(card);

		let effect = 'none';
		let advanceSteps = 1;

		if (card.value === 'skip') {
			effect = 'skip';
			advanceSteps = 2;
			this.currentColor = card.color;
		} else if (card.value === 'reverse') {
			effect = 'reverse';
			this.direction *= -1;
			this.currentColor = card.color;
			if (this.players.length === 2) {
				advanceSteps = 2;
			}
		} else if (card.value === 'draw2') {
			effect = 'draw2';
			this.pendingDrawCount += 2;
			this.currentColor = card.color;
		} else if (card.value === 'wild') {
			if (!COLORS.includes(chosenColor)) {
				throw new Error('A valid chosenColor is required for wild cards.');
			}
			effect = 'wild';
			this.currentColor = chosenColor;
		} else if (card.value === 'wild_draw4') {
			if (!COLORS.includes(chosenColor)) {
				throw new Error('A valid chosenColor is required for wild draw 4.');
			}
			effect = 'wild_draw4';
			this.pendingDrawCount += 4;
			this.currentColor = chosenColor;
		} else {
			this.currentColor = card.color;
		}

		if ((this.hands.get(playerId) || []).length !== 1) {
			this.unoCalledBy.delete(playerId);
		}

		this.#advanceTurn(advanceSteps);
		this.#resolveFinish(playerId);

		const nextPlayer = this.#getCurrentPlayer();
		const gameOver = this.phase === 'finished';

		return {
			success: true,
			nextPlayerId: nextPlayer ? nextPlayer.id : null,
			effect,
			handSize: (this.hands.get(playerId) || []).length,
			topCard: this.#getTopCard(),
			currentColor: this.currentColor,
			gameOver,
			ranking: [...this.ranking],
			card,
		};
	}

	drawCard(playerId) {
		const current = this.#getCurrentPlayer();
		if (!current || current.id !== playerId) {
			throw new Error('Not your turn.');
		}

		const hand = this.hands.get(playerId) || [];

		if (this.pendingDrawCount > 0) {
			const drawCount = this.pendingDrawCount;
			const drawnCards = this.#drawFromDeck(drawCount);
			hand.push(...drawnCards);
			this.pendingDrawCount = 0;
			this.unoCalledBy.delete(playerId);
			this.#advanceTurn(1);

			return {
				drawnCards,
				canPlay: false,
				nextPlayerId: this.#getCurrentPlayer()?.id || null,
				handSizes: this.#getHandSizes(),
			};
		}

		const drawnCards = this.#drawFromDeck(1);
		hand.push(...drawnCards);
		const drawn = drawnCards[0] || null;
		const canPlay = Boolean(drawn && this.#isCardPlayableOnTop(drawn));

		if (!canPlay) {
			this.#advanceTurn(1);
		}

		return {
			drawnCards,
			canPlay,
			nextPlayerId: this.#getCurrentPlayer()?.id || null,
			handSizes: this.#getHandSizes(),
		};
	}

	callUno(playerId) {
		const current = this.#getCurrentPlayer();
		if (!current || current.id !== playerId) {
			throw new Error('UNO can only be called on your turn.');
		}

		const hand = this.hands.get(playerId) || [];
		if (hand.length !== 2) {
			throw new Error('UNO can only be called when you have exactly 2 cards.');
		}

		this.unoCalledBy.add(playerId);
		return { success: true, playerId };
	}

	penalizeUno(targetPlayerId, callerPlayerId) {
		if (targetPlayerId === callerPlayerId) {
			return { penalized: false, drawnCards: [] };
		}

		const targetHand = this.hands.get(targetPlayerId);
		if (!targetHand || targetHand.length !== 1 || this.unoCalledBy.has(targetPlayerId)) {
			return { penalized: false, drawnCards: [] };
		}

		const drawnCards = this.#drawFromDeck(2);
		targetHand.push(...drawnCards);
		this.unoCalledBy.delete(targetPlayerId);

		return { penalized: true, drawnCards };
	}

	skipTurnTimeout(playerId) {
		const current = this.#getCurrentPlayer();
		if (!current || current.id !== playerId) {
			throw new Error('Timeout skip can only be applied to current player.');
		}

		const hand = this.hands.get(playerId) || [];
		const drawnCards = this.#drawFromDeck(1);
		hand.push(...drawnCards);
		this.unoCalledBy.delete(playerId);
		this.#advanceTurn(1);

		return {
			drawnCards,
			nextPlayerId: this.#getCurrentPlayer()?.id || null,
			handSizes: this.#getHandSizes(),
		};
	}

	getCurrentState() {
		return {
			players: [...this.players],
			hands: this.hands,
			topCard: this.#getTopCard(),
			currentColor: this.currentColor,
			currentPlayerId: this.#getCurrentPlayer()?.id || null,
			direction: this.direction,
			pendingDrawCount: this.pendingDrawCount,
			phase: this.phase,
			ranking: [...this.ranking],
			handSizes: this.#getHandSizes(),
		};
	}

	#buildDeck() {
		const deck = [];

		for (const color of COLORS) {
			deck.push(this.#createCard(color, 0));

			for (const value of NUMBER_VALUES.slice(1)) {
				deck.push(this.#createCard(color, value));
				deck.push(this.#createCard(color, value));
			}

			for (const action of ACTION_VALUES) {
				deck.push(this.#createCard(color, action));
				deck.push(this.#createCard(color, action));
			}
		}

		for (let i = 0; i < 4; i += 1) {
			deck.push(this.#createCard('wild', 'wild'));
			deck.push(this.#createCard('wild', 'wild_draw4'));
		}

		return deck;
	}

	#createCard(color, value) {
		return { id: uuidv4(), color, value };
	}

	#shuffle(items) {
		for (let i = items.length - 1; i > 0; i -= 1) {
			const j = Math.floor(Math.random() * (i + 1));
			[items[i], items[j]] = [items[j], items[i]];
		}
	}

	#getTopCard() {
		return this.discardPile[this.discardPile.length - 1] || null;
	}

	#drawFromDeck(count) {
		const drawn = [];

		for (let i = 0; i < count; i += 1) {
			if (this.deck.length === 0) {
				this.#reshuffleDiscardIntoDeck();
			}

			const card = this.deck.pop();
			if (!card) {
				break;
			}
			drawn.push(card);
		}

		return drawn;
	}

	#reshuffleDiscardIntoDeck() {
		if (this.discardPile.length <= 1) {
			return;
		}

		const topCard = this.discardPile.pop();
		this.deck.push(...this.discardPile);
		this.discardPile = [topCard];
		this.#shuffle(this.deck);
	}

	#getCurrentPlayer() {
		if (this.players.length === 0) {
			return null;
		}

		const normalizedIndex = ((this.currentPlayerIndex % this.players.length) + this.players.length) % this.players.length;
		this.currentPlayerIndex = normalizedIndex;
		return this.players[this.currentPlayerIndex] || null;
	}

	#advanceTurn(steps = 1) {
		if (this.players.length === 0) {
			return;
		}

		for (let i = 0; i < steps; i += 1) {
			this.currentPlayerIndex =
				(this.currentPlayerIndex + this.direction + this.players.length) % this.players.length;
		}
	}

	#resolveFinish(playerId) {
		const hand = this.hands.get(playerId) || [];
		if (hand.length !== 0) {
			return;
		}

		const finishedIndex = this.players.findIndex((player) => player.id === playerId);
		if (finishedIndex === -1) {
			return;
		}

		this.ranking.push(playerId);
		this.players.splice(finishedIndex, 1);

		if (this.players.length === 0) {
			this.phase = 'finished';
			return;
		}

		if (this.players.length === 1) {
			this.ranking.push(this.players[0].id);
			this.phase = 'finished';
			return;
		}

		if (finishedIndex <= this.currentPlayerIndex) {
			this.currentPlayerIndex -= 1;
		}

		if (this.currentPlayerIndex < 0) {
			this.currentPlayerIndex = this.players.length - 1;
		}
	}

	#isCardPlayableOnTop(card) {
		if (!card) {
			return false;
		}

		const topCard = this.#getTopCard();
		if (!topCard) {
			return true;
		}

		if (this.pendingDrawCount > 0) {
			if (topCard.value === 'draw2') {
				return card.value === 'draw2' || card.value === 'wild_draw4';
			}
			return card.value === 'wild_draw4';
		}

		if (card.color === 'wild') {
			return true;
		}

		return card.color === this.currentColor || card.value === topCard.value;
	}

	#getHandSizes() {
		const handSizes = new Map();
		for (const player of this.initialPlayers) {
			handSizes.set(player.id, (this.hands.get(player.id) || []).length);
		}
		return handSizes;
	}
}

module.exports = GameEngine;
