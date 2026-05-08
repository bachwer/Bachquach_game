# 🎰 UNO VIBE CODE

A real-time multiplayer UNO card game with a **Vegas gambling aesthetic** — deep crimson, charcoal black, and gold accents. Play with 2-4 players online using WebSocket technology.

## ✨ Features

- **Real-Time Multiplayer**: 2-4 players per game using WebSocket
- **Complete UNO Rules**: Skip, Reverse, Draw 2, Wild, Wild Draw 4, UNO call/penalty, draw stacking
- **Animated Gameplay**: Smooth card animations, effects, and turn indicators
- **Room System**: Create or join games with room codes and optional passwords
- **Turn Timer**: 30-second turn limit with automatic card draw on timeout
- **Persistent Storage**: Game history and stats tracked in SQLite
- **Vegas Theme**: Gold-accented UI with casino aesthetic (Cinzel Decorative + Rajdhani fonts)
- **Responsive Design**: Works on desktop (mobile layouts optimized for desktop play)
- **Reconnection**: Auto-recovery up to 5 attempts if connection drops

## 🚀 Quick Start

### Prerequisites

- **Node.js** 14+ (download from [nodejs.org](https://nodejs.org))
- **npm** (comes with Node.js)

### Installation

1. **Clone or download this project**
   ```bash
   cd uno-game
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```
   This installs: Express, WebSocket (ws), SQLite (better-sqlite3), UUID, and CORS middleware.

3. **Start the server**
   ```bash
   npm start
   ```
   The server will start on **http://localhost:3000**

4. **Open in browser**
   - Primary player: http://localhost:3000
   - Additional players: Open new browser tabs or windows at the same URL

## 🎮 How to Play

### Creating a Room

1. Click **"Create Room"** on the landing page
2. Enter your **player name** (2-20 characters)
3. Optionally set a **password** (≤20 characters)
4. Select **number of players** (2, 3, or 4)
5. Click **"Create"** — you'll get a 6-character **room code**
6. Share the room code with other players

### Joining a Room

1. Click **"Join Room"** on the landing page
2. Enter your **player name**
3. Enter the **room code** (6 characters, auto-uppercase)
4. Enter the **password** if the room has one (leave blank if no password)
5. Click **"Join"** — you'll see other players as they join

### Starting the Game

- **Host only**: Click **"Start Game"** once all players have joined
- **Other players**: Wait for host to start (you'll see "Waiting for host...")

### Playing

1. **On your turn**, click any card in your hand to play it
2. **Wild cards** → Choose a color from the popup circles
3. **No playable card?** → Click the **Draw** pile (left center)
4. **Got 1 card left?** → Click **"UNO!"** button to call UNO
5. **Opponent missed UNO?** → During the 5-second window, click their seat to penalize them (+2 cards)

### Card Types

| Card | Effect |
|------|--------|
| **0-9** | Number cards (match color or value) |
| **Skip** | Next player loses turn |
| **Reverse** | Reverse turn order |
| **+2** | Next player draws 2 cards (stackable) |
| **Wild** | Play any time, choose color |
| **+4 Wild** | Play any time, next player draws 4, choose color (stackable) |

### Game Rules

- **Draw Stacking**: Multiple +2 or +4 cards stack (accumulate on the next player)
- **Turn Timer**: 30 seconds per turn; auto-draw if you don't play
- **UNO Window**: 5 seconds after playing down to 1 card — other players can call you out
- **UNO Penalty**: Miss calling UNO? Draw 2 cards!
- **First to 0 cards** wins!

## 📁 Project Structure

```
uno-game/
├── server.js              # Express + WebSocket server, room management
├── database.js            # SQLite persistence layer
├── gameEngine.js          # Pure UNO game logic (no I/O)
├── package.json           # Dependencies: express, ws, better-sqlite3, uuid, cors
├── public/
│   ├── index.html         # Landing page (create/join rooms)
│   ├── game.html          # Game table UI (4 player seats, discard pile, hand)
│   ├── css/
│   │   ├── main.css       # Vegas theme variables, utilities, toast system
│   │   ├── lobby.css      # Landing page styling (modals, forms, animations)
│   │   └── game.css       # Game table (seats, hand, turn timer, animations)
│   └── js/
│       ├── lobby.js       # Landing page WebSocket client (create/join)
│       ├── game.js        # Game state machine, message handlers, card play logic
│       ├── cards.js       # CardRenderer: pure CSS card rendering, hand layout
│       ├── animations.js  # Animations: card deal, play, skip, reverse, etc.
│       └── toast.js       # Toast notifications (success/error/info/warning)
└── README.md              # This file
```

## 🛠️ Tech Stack

### Backend
- **Node.js + Express** — HTTP server for static files
- **WebSocket (ws)** — Real-time multiplayer communication
- **SQLite3 (better-sqlite3)** — Persistent game storage with WAL mode
- **UUID** — Unique room/player/card IDs
- **CORS** — Cross-origin request handling

### Frontend
- **HTML5 / CSS3 / Vanilla JavaScript** — No build step, no frameworks
- **anime.js** (3.2.1 CDN) — Smooth animations (card fly, spin, bounce)
- **Font Awesome 6** (CDN) — Icons (Skip, Reverse, UNO star, etc.)
- **Google Fonts** — Cinzel Decorative (headers), Rajdhani (body)
- **WebSocket API** — Browser's native WebSocket

### Color Palette
- **Casino Red**: #c9302c
- **Vegas Gold**: #d4af37
- **Felt Dark**: #0d1f0f
- **Cream Text**: #f5f0e0
- **Card Colors**: Red, Green, Blue, Yellow, Wild (rainbow)

## 📊 Architecture Overview

### Server-Side Flow
1. **HTTP Server** (Express) — Serves `index.html` and `game.html`
2. **WebSocket Layer** — Receives CREATE_ROOM, JOIN_ROOM, PLAY_CARD, etc.
3. **Room Manager** — Tracks active rooms, players, turn state
4. **Game Engine** — Pure logic: validate moves, calculate effects, manage turn order
5. **Database** — Persist rooms, players, game sessions, events

### Client-Side Flow
1. **Landing Page** (`lobby.js`) — WebSocket connect → CREATE_ROOM / JOIN_ROOM
2. **Game Page** (`game.js`) — Receive GAME_STARTED → render board → handle user input
3. **Card Rendering** (`cards.js`) — DOM-based cards with CSS gradients and icons
4. **Animations** (`animations.js`) — Orchestrate anime.js for all visual effects
5. **Notifications** (`toast.js`) — Show success/error/info messages

### WebSocket Protocol

**Client → Server:**
- `CREATE_ROOM {name, password, mode, maxPlayers}`
- `JOIN_ROOM {roomId, password, name}`
- `START_GAME {roomId}`
- `PLAY_CARD {roomId, cardId, chosenColor?}`
- `DRAW_CARD {roomId}`
- `CALL_UNO {roomId}`
- `PENALIZE_UNO {roomId, targetPlayerId}`
- `PING {}`

**Server → Client:**
- `ROOM_CREATED {roomId, playerId, seat}`
- `ROOM_JOINED {roomId, playerId, seat, players}`
- `PLAYER_JOINED {player}`
- `GAME_STARTED {hand, topCard, currentColor, currentPlayerId, players, seats}`
- `CARD_PLAYED {playerId, card, topCard, currentColor, nextPlayerId, effect, handSizes, unoAlert?}`
- `CARDS_DRAWN {playerId, count, nextPlayerId, handSizes, drawnCards?}`
- `UNO_CALLED {playerId}`
- `UNO_PENALIZED {targetPlayerId, count}`
- `TURN_TIMER {playerId, secondsLeft}`
- `GAME_OVER {ranking}`
- `PLAYER_LEFT {playerId}`
- `ERROR {message}`

## ✅ Testing Checklist

Use this checklist to verify all game mechanics work:

### Room Management
- [ ] Create room → receive 6-char room code
- [ ] Join room with code from different browser tab
- [ ] Room code is case-insensitive (auto-uppercase)
- [ ] Password protection works (can't join without correct password)
- [ ] Waiting room shows all players + their seat numbers

### Game Start
- [ ] Host can start game with 2+ players
- [ ] Can't start with only 1 player
- [ ] Each player gets 7 cards + hand fans nicely
- [ ] Discard pile shows top card
- [ ] Turn indicator highlights current player

### Card Play
- [ ] Click playable card → card plays, adds to discard pile
- [ ] Card disappears from hand after play
- [ ] Can't play unplayable cards (grayed out or not clickable)
- [ ] Opponent hand card counts decrease

### Wild Cards
- [ ] Play wild card → color picker appears (4 colored circles)
- [ ] Click color → picker closes, color is chosen
- [ ] Current color indicator updates
- [ ] Can play any card on wild color

### Draw + Stacking
- [ ] Click draw pile → card added to hand
- [ ] Draw 2 on opponent → they draw 2 on their turn
- [ ] Stack draw 2 + draw 2 → next player draws 4
- [ ] Stack wild 4 on draw 2 → accumulates correctly

### Special Cards
- [ ] **Skip**: Next player's turn skipped (player shakes animation)
- [ ] **Reverse**: Turn order reverses (2 player = your turn again, 3+ = next player changes)
- [ ] **Draw 2**: Next player draws 2 cards
- [ ] **Draw 4**: Next player draws 4 cards, you pick color

### Turn Timer
- [ ] Timer starts at 30 seconds, counts down
- [ ] Timer warning effect when <10 seconds
- [ ] Auto-draw if timer runs out
- [ ] Next player's timer resets

### UNO Call & Penalty
- [ ] UNO button enabled when you have 2 cards
- [ ] Click UNO button → broadcasts UNO to other players
- [ ] UNO button pulsing animation when enabled
- [ ] If you play down to 1 card without calling UNO:
  - [ ] 5-second penalty window opens
  - [ ] Other players can click your seat → penalize you +2 cards
  - [ ] If no one penalizes, your UNO is safe

### Game End
- [ ] First player to 0 cards → game ends
- [ ] Ranking overlay shows: #1 (gold), #2 (silver), #3+ (bronze)
- [ ] "Back to Lobby" button works

### Multiplayer Sync
- [ ] All players see same card state in real-time
- [ ] All players' hand sizes stay in sync
- [ ] Turn order correct for 2, 3, 4 players
- [ ] Reverse actually reverses order

### Reconnection
- [ ] Disconnect internet → connection lost toast
- [ ] Reconnect → "Reconnecting..." message
- [ ] Should auto-recover and continue game
- [ ] After 5 failed attempts → "Please refresh" message

### UI/UX
- [ ] Toast notifications appear for all events
- [ ] Card hover shows lift animation
- [ ] Seat positions clear (bottom = you, top = opposite, left/right = sides)
- [ ] Opponent hand cards face-down
- [ ] All fonts load (Cinzel Decorative headings, Rajdhani body)
- [ ] Gold accent colors consistent throughout

## 🐛 Troubleshooting

### Server won't start
```bash
# Make sure you're in the right directory
cd uno-game

# Delete node_modules and reinstall
rm -r node_modules package-lock.json
npm install

# Try starting again
npm start
```

### "Connection refused" error
- Make sure server is running (`npm start`)
- Check that http://localhost:3000 shows the landing page
- If port 3000 is in use, kill the process:
  - Windows: `netstat -ano | findstr :3000` then `taskkill /PID <PID> /F`
  - Mac/Linux: `lsof -i :3000` then `kill -9 <PID>`

### Cards not displaying
- Check browser console (F12) for errors
- Make sure fonts and anime.js load from CDN
- Try hard refresh (Ctrl+Shift+R on Windows, Cmd+Shift+R on Mac)

### WebSocket connection fails
- Make sure both URL and server use same protocol (http/ws or https/wss)
- Check firewall settings if on restricted network
- Try incognito/private mode to clear cache

### Game logic issues
- Check `server.js` logs in terminal for errors
- Look at browser console (F12) for client-side errors
- Verify `gameEngine.js` hand sizes match UI display

## 📝 Development Commands

```bash
# Start the development server (with auto-restart on file change)
npm run dev

# Start production server
npm start

# Just run the game engine tests (if added in future)
npm test
```

## 🎨 Customization

### Change Colors
Edit `public/css/main.css` CSS variables:
```css
:root {
  --casino-red: #c9302c;
  --vegas-gold: #d4af37;
  --felt-dark: #0d1f0f;
  --cream-text: #f5f0e0;
}
```

### Change Fonts
Edit the Google Fonts link in `public/index.html` and `public/game.html`:
```html
<link href="https://fonts.googleapis.com/css2?family=YOUR_FONT:wght@400&display=swap" rel="stylesheet">
```

### Change Room Code Length
Edit `server.js` line ~70:
```javascript
const roomCode = generateRoomCode(6); // Change 6 to another number
```

## 📜 License

This project is a fun multiplayer UNO game created for demonstration purposes.

## 🤝 Contributing

Found a bug? Have a feature idea?
1. Test thoroughly against the checklist above
2. Document the issue clearly
3. Submit with steps to reproduce

## 🎯 Future Enhancements

- [ ] Persistent player stats/rankings
- [ ] Chat during gameplay
- [ ] Spectator mode
- [ ] AI opponents
- [ ] Replay system
- [ ] Mobile touch optimization
- [ ] Sound effects and background music
- [ ] Accessibility (ARIA labels, keyboard nav)
- [ ] Automated testing suite

---

**Built with ❤️ and gold accents. Now go play! 🎰**
