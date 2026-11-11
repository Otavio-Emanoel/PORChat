# 🏗️ Arquitetura do Sistema — PORChat

Este documento detalha os princípios de design de software, modelos de concorrência, camada de persistência e ciclo de vida de conexões do **PORChat**.

---

## 1. Estrutura do Monorepo

O projeto está organizado como um monorepo modular:

```text
PORChat/
├── api/                  # Backend em Go (REST API, WebSockets Hub, Game FSM)
│   ├── cmd/server/       # Ponto de entrada do servidor HTTP/WS (main.go)
│   ├── internal/
│   │   ├── auth/         # Autenticação JWT, UserStore, Rate Limiter
│   │   ├── chat/         # Salas, Mensagens, Anexos, Enquetes, Persistência
│   │   ├── game/         # Motor de Jogos (FSM Debate, Quiz, Rankings, Banco de Questões)
│   │   ├── security/     # Sanitização, Auditoria de Segurança, Anti-XSS
│   │   └── ws/           # Hub WebSockets, Conexões de Clientes, Broadcast
│   └── Dockerfile        # Imagem de produção Go em múltiplos estágios
├── web/                  # Frontend Web e Modo TV em Next.js 14
│   ├── src/
│   │   ├── app/          # App Router: Home, /room/[roomId], /tv, /tv/[roomId]
│   │   ├── components/   # Componentes reusáveis (Chat, Modais, TV Stage, Reações)
│   │   └── lib/          # Clientes de API, WebSocket hook, Áudio, Segurança
│   └── Dockerfile        # Imagem de produção Node.js / Next.js
├── mobile/               # Aplicativo Mobile e Game Controller (React Native / Expo)
│   └── src/
│       ├── screens/      # ChatScreen, GameControllerScreen, ProfileModal
│       ├── context/      # WebSocketContext unificado com sincronização global
│       └── theme/        # Tokens visuais do Design System
├── shared/               # Contratos e interfaces TypeScript compartilhadas
│   └── types/            # Definições de Mensagens, Envelopes WS, FSM State
├── data/                 # Armazenamento JSON persistente em disco
├── docs/                 # Documentação técnica do sistema
└── scripts/              # Scripts de inicialização, deploy e infraestrutura para Ubuntu
```

---

## 2. Modelo de Concorrência do Backend (Go)

O backend do PORChat foi projetado para alta concorrência com baixa latência, aproveitando goroutines e canais nativos do Go sem necessidade de brokers externos pesados como Redis ou Kafka para a escala MVP.

### 2.1 Padrão Hub / Room (Actor Pattern)
O WebSocket Hub centraliza o registro e desregistro de conexões, dividindo o tráfego por salas (`room_id`):

```
                        ┌───────────────────────────────────┐
                        │          ws.Hub Central           │
                        └─┬───────────────┬───────────────┬─┘
                          │               │               │
               ┌──────────▼─────┐  ┌──────▼───────┐  ┌────▼───────────┐
               │  Room A (Chat) │  │Room B (Debate│  │  Room C (Quiz) │
               │  Hub Channel   │  │ FSM Engine)  │  │  Hub Channel   │
               └──────────┬─────┘  └──────┬───────┘  └────┬───────────┘
                          │               │               │
                   ┌──────┴──────┐ ┌──────┴──────┐ ┌──────┴──────┐
                   │  Clients    │ │  Clients    │ │  Clients    │
                   │ (Web/Mobile)│ │ (Web/Mobile)│ │ (Web/Mobile)│
                   └─────────────┘ └─────────────┘ └─────────────┘
```

1. **Isolamento de Canais:** Cada conexão WebSocket possui buffers dedicados de escrita (`send chan []byte` com buffer de 256 mensagens). Mensagens de broadcast para uma sala não bloqueiam clientes lentos em outras salas.
2. **Proteção de Estado com `sync.RWMutex`:** Mapas em memória (`rooms`, `messages`, `sessions`) são sempre protegidos por travas de leitura/escrita atômicas (`RLock`/`RUnlock` para consultas de alta frequência e `Lock`/`Unlock` para mutações).
3. **Detecção e Limpeza de Conexões Mortas:**
   - O servidor emite `ping` a cada 54 segundos com `pongWait` de 60 segundos.
   - Conexões que não respondem ao heartbeat são desconectadas e limpas da memória automaticamente, disparando atualização de presença (`chat:presence`).

---

## 3. Motor de Persistência JSON (Zero-Dependency)

Para facilitar a portabilidade e permitir implantação instantânea em qualquer servidor sem exigir PostgreSQL ou Redis configurados previamente, o backend conta com um mecanismo de persistência JSON ACID-safe em `data/`:

- `data/chat_store.json`: Contém salas, mensagens de chat, enquetes, histórico de edições e referências de anexos.
- `data/user_store.json`: Contém perfis de usuários, fotos de avatar, biografia, credenciais com hash seguro e tokens.
- `data/game_stats.json`: Estatísticas de carreira de jogadores (vitórias em debates, votos, pontuação de quiz, sequência de acertos).
- `data/custom_bank.json`: Banco de tópicos de debate e perguntas de quiz criados pelos usuários por sala.

### Escrita Atômica Segura
Para evitar arquivos corrompidos em caso de reinicialização abrupta ou queda de energia do servidor, as gravações em disco utilizam o padrão de **escrita atômica temporária**:

```go
func (s *RoomStore) SaveToDisk(filePath string) error {
    s.mu.RLock()
    defer s.mu.RUnlock()

    bytes, err := json.MarshalIndent(data, "", "  ")
    if err != nil {
        return err
    }

    _ = os.MkdirAll(filepath.Dir(filePath), 0755)
    tmpPath := filePath + ".tmp"
    if err := os.WriteFile(tmpPath, bytes, 0644); err != nil {
        return err
    }
    return os.Rename(tmpPath, filePath) // Renomeação atômica em nível de SO
}
```

---

## 4. Ciclo de Vida da Conexão & Sincronização pós-Reconexão

Uma das regras críticas do PORChat é a **recuperação instantânea do estado** em caso de oscilação de rede de dispositivos móveis:

1. **Handshake de Conexão:**
   - O cliente se conecta em `GET /ws?room_id={roomId}&nickname={user}&token={jwt}&client_type={web|mobile|tv}`.
   - O servidor valida o token JWT ou nickname de demonstração e registra a sessão no Hub.
2. **Push Imediato de Estado (`game:state_sync`):**
   - Se houver um jogo ativo na sala (`DEBATE` ou `QUIZ`), o servidor envia imediatamente o snapshot atual da Máquina de Estados para o socket do usuário recém-conectado.
   - O cliente móvel ou web não precisa enviar solicitações adicionais; a tela se ajusta instantaneamente à fase em andamento (ex.: tela de votação aberta com tempo restante sincronizado).
3. **Presença em Tempo Real (`chat:presence`):**
   - Transmitido para todos os clientes da sala informando quem entrou, saiu ou está conectado.
