# 🎮 PORChat — Chat, Play, Debate.

**PORChat** (Pedro, Otavio & Raul Chat) is a cross-platform social messaging ecosystem that transforms ordinary group chats into interactive multiplayer arenas. Built across **Web, Mobile, and a Real-Time API**, it combines seamless instant messaging with synchronous mini-games and a dedicated **TV Mode** for living-room party experiences.

## ✨ Key Features

- 💬 **Real-Time Messaging:** Instant 1-on-1 and group conversations with live presence indicators.
- 🕹️ **In-Chat Mini-Games:** Launch interactive games directly inside any group chat without installing external apps.
- ⚖️ **Debate Mode (The Court):** Two members go head-to-head defending opposing viewpoints under a synchronized timer while the rest of the group votes on the winner in real time.
- ⚡ **Quick Trivia / Quiz:** Fast-paced multiple-choice rounds where speed and accuracy determine the leaderboard.
- 📺 **TV Mode (Big-Screen Host):** Turn the Web client into a Kahoot/Jackbox-style stage display showing timers, prompts, and live scoreboards, while everyone's Mobile app automatically transforms into a game controller.

---

## 📚 Documentation Portal (`./docs`)

Comprehensive documentation is available in the [`./docs`](./docs) folder:

- [**Documentation Home (`docs/README.md`)**](./docs/README.md)
- [**System Architecture (`docs/ARCHITECTURE.md`)**](./docs/ARCHITECTURE.md) — Monorepo structure, Go concurrency model, Hub/Room pattern, and zero-dependency JSON storage engine.
- [**Game Engine & FSM (`docs/GAMES_AND_FSM.md`)**](./docs/GAMES_AND_FSM.md) — Server-authoritative state machine, Debate Mode ("The Court"), Quick Trivia Quiz, and custom banks.
- [**API REST & WebSockets (`docs/API_AND_WEBSOCKETS.md`)**](./docs/API_AND_WEBSOCKETS.md) — Envelope standard, client/server event catalog, and REST endpoints.
- [**Web Client & TV Mode (`docs/WEB_AND_TV_MODE.md`)**](./docs/WEB_AND_TV_MODE.md) — Next.js responsive chat, zero-layout-shift floating actions, and big-screen TV stage view.
- [**Mobile App & Game Controller (`docs/MOBILE_CONTROLLER.md`)**](./docs/MOBILE_CONTROLLER.md) — React Native (Expo) messaging, dynamic buzzer controller, and native media attachments.
- [**Ubuntu Server Deployment (`docs/DEPLOYMENT_UBUNTU.md`)**](./docs/DEPLOYMENT_UBUNTU.md) — Complete production guide with Docker Compose, Nginx SSL, and Systemd.

---

## 🚀 Ubuntu Server Quick Bootstrap (1 Command)

To provision and run PORChat on an Ubuntu 20.04/22.04/24.04 server (installs Docker, Docker Compose, firewall, and data directories automatically):

```bash
# 1. Clone repository
git clone https://github.com/Otavio-Emanoel/PORChat.git /opt/porchat
cd /opt/porchat

# 2. Run Ubuntu bootstrap script
sudo ./scripts/setup_ubuntu.sh

# 3. Start the production stack with Docker Compose
./scripts/start_production.sh
```

---

## 🛠️ Management Scripts (`./scripts`)

- `./scripts/setup_ubuntu.sh` — Full Ubuntu bootstrap (updates apt, installs Docker Engine & Docker Compose plugin, configures UFW firewall).
- `./scripts/start_production.sh` — Verifies ports, builds and starts Docker containers in detached mode.
- `./scripts/stop_production.sh` — Gracefully stops all containers while preserving persistent data in `./data`.
- `./scripts/deploy.sh` — Auto-pulls git updates, creates safety backups, and rebuilds containers with zero data loss.
- `./scripts/backup_data.sh` — Creates timestamped compressed backups in `./backups/`.
- `./scripts/install_systemd.sh` — Installs and enables the `porchat.service` systemd unit for automatic boot startup.
- `./scripts/audit_ports.sh` — Validates port safety and verifies isolation against external services.

