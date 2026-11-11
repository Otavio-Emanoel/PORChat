# 📚 PORChat — Documentação Oficial do Sistema

Bem-vindo à documentação oficial do **PORChat** (Pedro, Otavio & Raul Chat). Este repositório reúne um ecossistema multiplataforma de mensageria social em tempo real com jogos síncronos de festa (party games) e visualização de palco em tela cheia (**TV Mode**), inspirado no Kahoot, Discord e Jackbox Games.

---

## 🧭 Índice da Documentação

A documentação está organizada de forma modular nos seguintes guias técnicos:

1. [**Arquitetura do Sistema (`ARCHITECTURE.md`)**](./ARCHITECTURE.md)
   - Visão geral dos componentes (`api/`, `web/`, `mobile/`, `shared/`).
   - Modelo de concorrência em Go (Goroutines, Channels, Hub/Room Pattern, `sync.RWMutex`).
   - Persistência sem dependências externas (Zero-dependency JSON Storage em `data/`).
   - Ciclo de vida de conexões e sincronização de estado pós-reconexão.

2. [**Motor de Jogos & Máquina de Estados FSM (`GAMES_AND_FSM.md`)**](./GAMES_AND_FSM.md)
   - Princípio de autoridade estrita do servidor para tempos e pontuações.
   - **Modo Debate ("The Court" / Tribunal):** fases, debatedores, jurados, perguntas da corte, votação e apuração.
   - **Modo Quiz Relâmpago:** categorias, cálculo de pontuação por precisão e delta de milissegundos (`ms`).
   - Banco de tópicos e perguntas customizadas por sala.

3. [**API REST & Protocolo WebSockets (`API_AND_WEBSOCKETS.md`)**](./API_AND_WEBSOCKETS.md)
   - Envelope padrão de WebSocket (`event`, `room_id`, `timestamp`, `payload`).
   - Catálogo exaustivo de eventos cliente ➔ servidor e servidor ➔ cliente.
   - Endpoints REST (Autenticação JWT, Salas, Upload e Download de Anexos, Histórico, Rankings, Auditoria).

4. [**Web Frontend & Modo TV (`WEB_AND_TV_MODE.md`)**](./WEB_AND_TV_MODE.md)
   - Cliente Next.js (App Router, Tailwind CSS).
   - Feed de chat com citações ricas com miniatura de mídia e barra flutuante sem *layout shift*.
   - **Modo TV (`/tv` e `/tv/[roomId]`):** display de palco em alta resolução para projetores e televisões (`#1E1E2E`).
   - Efeitos visuais, sonoros e palco de premiação.

5. [**Aplicativo Mobile & Controle do Jogo (`MOBILE_CONTROLLER.md`)**](./MOBILE_CONTROLLER.md)
   - App React Native com Expo.
   - Transição dinâmica de chat para Game Controller tátil / buzzer baseado no papel do usuário.
   - Suporte completo a anexos nativos (Câmera, Galeria, Documentos, Enquetes).
   - Configuração de rede e depuração via emulador Android (`adb reverse`).

6. [**Guia de Deploy & Operação no Ubuntu Server (`DEPLOYMENT_UBUNTU.md`)**](./DEPLOYMENT_UBUNTU.md)
   - Instalação automatizada via script (`./scripts/setup_ubuntu.sh`).
   - Orquestração em containers com Docker e Docker Compose.
   - Configuração de Proxy Reverso Nginx com SSL/TLS (Let's Encrypt).
   - Gerenciamento com Systemd (`porchat.service`), rotina de backups e auditoria de portas.

---

## 🛠️ Stack Tecnológica

| Camada | Tecnologia | Propósito | Porta Padrão |
| :--- | :--- | :--- | :--- |
| **Backend API** | Go (Golang) + Chi Router + Gorilla WebSocket | REST API, Hub WebSocket, FSM dos Jogos e Armazenamento JSON | `8081` |
| **Web Client** | Next.js 14 (App Router) + Tailwind CSS + Lucide Icons | Interface Web de Chat e Visualizador de Palco (TV Mode) | `3001` |
| **Mobile App** | React Native (Expo) + TypeScript + Ionicons | Chat móvel diário e Game Controller tátil | `8082` |
| **Shared** | TypeScript | Tipagens e contratos compartilhados de mensagens, salas e jogos | N/A |
| **Storage** | JSON Engine ACID-safe com mutex e escrita atômica | Persistência de salas, mensagens, usuários e estatísticas | `data/` |

---

## 🚀 Início Rápido Local (Desenvolvimento)

### Pré-requisitos
- Go 1.22+
- Node.js 20+ e npm
- Docker e Docker Compose (opcional para rodar via container)

### 1. Clonar o repositório
```bash
git clone https://github.com/Otavio-Emanoel/PORChat.git
cd PORChat
```

### 2. Rodar todos os testes automatizados
```bash
make test
```

### 3. Iniciar o Backend Go (API :8081)
```bash
PORT=8081 go run api/cmd/server/main.go
```

### 4. Iniciar o Frontend Web (Next.js :3001)
```bash
cd web
npm install
npm run dev
```
Acesse `http://localhost:3001` no navegador.

### 5. Iniciar o Mobile App (Expo :8082)
```bash
cd mobile
npm install
npx expo start --port 8082 --localhost
```

---

## 🔒 Diretrizes de Portas e Segurança
O PORChat opera em portas dedicadas para evitar qualquer conflito com serviços externos:
- **API Go:** `8081`
- **Web Next.js:** `3001`
- **Mobile Expo:** `8082`
- **Portas protegidas (nunca utilizadas):** `3000`, `4000`, `8080`, `5432`, `6379`.

Valide a integridade a qualquer momento executando:
```bash
./scripts/audit_ports.sh
```
