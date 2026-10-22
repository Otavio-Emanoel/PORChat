# 🤖 AGENTS.md — PORChat Context & Architecture Guide

This document provides core architectural context, domain rules, and design system guidelines for AI coding assistants and developers working on **PORChat**.

---

## 1. Project Overview
**PORChat** (Pedro, Otavio & Raul Chat) is a cross-platform social messaging ecosystem that combines instant group messaging with real-time synchronous party games and a big-screen **TV Mode** (inspired by Kahoot and Jackbox Games).

### Core Pillars
1. **Permanent Lobby (Chat Core):** Standard 1-on-1 and group chats that persist before and after games. Users can trigger a mini-game directly inside any group conversation.
2. **Server-Authoritative Game Engine:** When a game starts in a group, the Go backend manages a Finite State Machine (FSM) for that room and broadcasts role-specific states over WebSockets.
3. **Second-Screen Experience (TV Mode vs. Mobile Controller):**
   - **Web (Next.js):** Acts as a full messaging client OR toggles into **TV Mode** (a full-screen stage display for projectors/TVs showing timers, arguments, questions, and live leaderboards).
   - **Mobile (React Native):** Acts as a daily messaging app that automatically morphs into a tactile **Game Controller / Buzzer** (voting buttons, argument inputs, reaction triggers) when an active game is detected in the current group.

---

## 2. Tech Stack & Ecosystem

### Backend (`/api` or `/backend`)
- **Language:** Go (Golang)
- **Communication:** REST API (auth, history, user/group management) + WebSockets (real-time chat, presence, and game state synchronization).
- **Concurrency Model:** Idiomatic Go routines and channels (`Hub` / `Room` pattern) to manage isolated group connections, game timers (`time.Ticker`), and thread-safe state transitions without race conditions.

### Web Frontend (`/web`)
- **Framework:** Next.js (App Router, TypeScript)
- **Styling:** Tailwind CSS
- **Key Views:**
  - `Chat View`: Responsive sidebar + message feed + inline game invite cards.
  - `TV Mode View`: Full-screen, high-contrast (`#1E1E2E`), big-typography stage view with smooth transitions, progress bars, and audio/visual cues.

### Mobile App (`/mobile`)
- **Framework:** React Native (TypeScript)
- **Key Views:**
  - `Conversation Screen`: Standard mobile chat UI.
  - `Controller Overlay / Screen`: Dynamic view injected when a room enters `GAME_ACTIVE` state. Shifts UI based on the user's role (`DEBATER`, `VOTER`, `TRIVIA_PLAYER`).

---

## 3. Core Game Mechanics (MVP Scope)

### Mode 1: Debate Mode ("The Court" / Modo Debate)
- **Setup:** Triggered in a group chat. Defines a topic and selects 2 members as `DEBATERS` (Side A vs. Side B). Remaining members are assigned as `JURORS` (Audience).
- **Phases (FSM):**
  1. `LOBBY`: Waiting for players to ready up / TV Mode to connect.
  2. `OPENING_ARGUMENTS`: Side A and Side B submit or present arguments under a server-controlled countdown.
  3. `REBUTTAL`: Quick counter-argument phase.
  4. `VOTING`: Audience mobile screens display two massive cards (Side A Coral vs. Side B Mint) to cast votes; live emoji reactions float up on the TV Mode screen.
  5. `RESULTS`: Server tallies votes, reveals the winner with animations on TV Mode, updates group rankings, and returns the room to `CHAT` mode.

### Mode 2: Quick Trivia (Quiz Relâmpago)
- **Setup:** Multiple-choice questions displayed prominently on Web/TV Mode.
- **Flow:** Server broadcasts question -> Mobile screens display 4 colored geometric buttons -> Points calculated based on accuracy + response time (`ms` delta measured on the Go server).

---

## 4. Architecture & WebSocket Rules (CRITICAL)

1. **Strict Server Authority:**
   - **NEVER** trust client-side timers or score calculations.
   - The Go backend owns the clock (`time.Ticker`) and emits `game:tick` or `phase_end_timestamp` (Unix ms) so clients can render smooth progress bars.
2. **Standardized WebSocket Envelope:**
   All WebSocket payloads (both directions) MUST follow a strict JSON envelope:
   ```json
   {
     "event": "game:state_update",
     "room_id": "grp_12345",
     "timestamp": 1761090000,
     "payload": {}
   }
   ```
3. **Role-Aware Rendering:**
   - Clients must react declaratively to the `game_state` payload sent by the server. If `state.phase == "VOTING"` and `user.id` is in `state.jurors`, render the voting buzzer immediately.

---

## 5. Design System & UI Guidelines ("Friendly Party Vibe")

The UI must feel welcoming, playful, tactile, and energetic (inspired by Duolingo, Discord, and Jackbox). Avoid sterile corporate layouts.

### Shape & Layout Rules

- **Border Radius:** Generous rounded corners (`rounded-2xl` / `16px` to `rounded-3xl` / `24px`) for cards, chat bubbles, and buttons.
- **Tactile Buttons:** Game controller buttons should feel pressable (use subtle bottom borders or drop shadows that compress on active press).

### Color Palette (Tailwind Configuration Reference)

Configure and use these semantic tokens across Web (Tailwind) and Mobile (StyleSheet/NativeWind):

| Token Name | Hex Code | Usage |
| --- | --- | --- |
| `brand-primary` | `#6C5CE7` | Friendly Violet — Primary buttons, active headers, outgoing chat bubbles. |
| `brand-action` | `#FF7675` | Vibrant Coral — "Start Game" CTAs, countdown alerts, Debate Side A. |
| `brand-reward` | `#FDCB6E` | Sun Yellow — Winner crowns, leaderboards, stars, TV Mode highlights. |
| `brand-mint` | `#00CEC9` | Fresh Mint — Online indicators, vote confirmation, Debate Side B. |
| `bg-light` | `#F8F9FA` | Warm Cream — Default chat background (prevents harsh pure-white eye strain). |
| `bg-tv` | `#1E1E2E` | Space Night — Default **TV Mode** & Dark Mode background for high contrast. |
| `text-main` | `#2D3436` | Soft Charcoal — Primary body text and headings on light backgrounds. |

#### Game Controller / Quiz Option Colors

- **Option A (Coral):** `#FF6B6B`
- **Option B (Ocean):** `#48DBFB`
- **Option C (Mustard):** `#FECA57`
- **Option D (Emerald):** `#1DD1A1`

### Tailwind Configuration Example (`tailwind.config.ts`)

```typescript
colors: {
  brand: {
    primary: '#6C5CE7',
    action: '#FF7675',
    reward: '#FDCB6E',
    mint: '#00CEC9',
  },
  surface: {
    light: '#F8F9FA',
    tv: '#1E1E2E',
  },
  ink: {
    main: '#2D3436',
  },
  quiz: {
    a: '#FF6B6B',
    b: '#48DBFB',
    c: '#FECA57',
    d: '#1DD1A1',
  }
}
```

### Typography

- **Headings, Scores & TV Mode:** `Fredoka` or `Plus Jakarta Sans` (Bold / ExtraBold).
- **Chat Body & UI Controls:** `Inter` or `Nunito` (Regular / Medium / SemiBold).

---

## 6. Coding Conventions for AI Assistants

- **Go (API):**
  - Keep HTTP handlers thin; isolate business logic in services and WebSocket state machines inside dedicated domain packages (`internal/chat`, `internal/game`, `internal/ws`).
  - Always guard shared room maps and game states with `sync.RWMutex` or channel-based actor patterns.
  - Handle WebSocket disconnections gracefully: if a player drops mid-game and reconnects, immediately push the current `game:state_sync` snapshot to their socket.

- **Next.js (Web):**
  - Use functional components, strict TypeScript interfaces mirroring Go structs, and Tailwind utility classes.
  - Ensure **TV Mode** uses viewport-relative sizing (`vw`, `vh`, `clamp()`) so it looks crisp on both 1080p projectors and 4K TVs without vertical scrolling.

- **React Native (Mobile):**
  - Prioritize low-latency touch feedback (`Pressable` with haptic feedback when available) for game controller screens.
  - Keep WebSocket connection state global (via Context or Zustand) so switching between the Chat screen and the Game Controller screen never drops the socket connection.
