# 🔌 API REST & Protocolo WebSockets — PORChat

Este documento especifica o contrato completo de comunicação do **PORChat**, cobrindo o envelope padronizado de WebSockets, os eventos bidirecionais em tempo real e os endpoints REST.

---

## 1. Envelope Padrão de WebSockets (CRÍTICO)

Todas as mensagens trafegadas via WebSocket (em ambas as direções) **OBRIGATORIAMENTE** seguem o envelope JSON estrito:

```json
{
  "event": "nome:do_evento",
  "room_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "timestamp": 1762819200000,
  "payload": {}
}
```

- `event` (string, obrigatório): Identificador do tipo de ação ou notificação.
- `room_id` (string, obrigatório): ID da sala de chat em que a mensagem ocorre.
- `timestamp` (number, obrigatório): Timestamp Epoch Unix em milissegundos.
- `payload` (object, obrigatório): Dados específicos do evento.

---

## 2. Eventos Cliente ➔ Servidor (Ações)

| Evento | Payload | Descrição |
| :--- | :--- | :--- |
| `chat:message` | `{ "content": string, "reply_to_id"?: string }` | Envia mensagem de texto convencional no chat. |
| `chat:reaction` | `{ "message_id": string, "emoji": string }` | Alterna reação em uma mensagem (`like`, `heart`, `fire`, etc.). |
| `chat:edit_message` | `{ "message_id": string, "content": string }` | Edita o conteúdo de mensagem enviada pelo próprio usuário. |
| `chat:delete_message`| `{ "message_id": string }` | Exclui mensagem própria ou por administrador da sala. |
| `chat:pin_message` | `{ "message_id": string }` | Fixa uma mensagem no topo da sala. |
| `chat:unpin_message` | `{}` | Remove a mensagem atualmente fixada no topo. |
| `chat:typing` | `{ "is_typing": boolean }` | Notifica status de digitação do participante. |
| `chat:poll_create` | `{ "question": string, "options": string[], "multi_select"?: boolean }` | Cria uma nova enquete interativa na sala. |
| `chat:poll_vote` | `{ "message_id": string, "option_id": string }` | Registra voto em opção de enquete. |
| `chat:poll_close` | `{ "message_id": string }` | Encerra a enquete ativa (autor ou admin). |
| `game:start` | `{ "game_type": "debate" \| "quiz", ...args }` | Inicia uma partida de Debate ou Quiz na sala. |
| `game:player_ready`| `{}` | Informa prontidão do jogador na fase de Lobby. |
| `game:argument` | `{ "argument": string, "phase": "opening" \| "rebuttal" }` | Submete argumento de debatedor no tribunal. |
| `game:court_question`| `{ "question": string }` | Jurado submete pergunta para os debatedores. |
| `game:reaction` | `{ "reaction": "agree" \| "fire" \| "applause" \| ... }` | Emite reação flutuante ao vivo para o Modo TV. |
| `game:vote` | `{ "choice": "side_a" \| "side_b" }` | Registra o voto final do jurado no vencedor do debate. |
| `game:quiz_answer` | `{ "option": number }` | Envia resposta selecionada na pergunta do Quiz (0 a 3). |
| `game:pause` | `{}` | Pausa o temporizador da partida em andamento (admin). |
| `game:resume` | `{}` | Retoma temporizador da partida pausada (admin). |
| `game:skip_phase` | `{}` | Pula imediatamente para a próxima fase do jogo. |
| `game:abort` | `{}` | Cancela a partida e retorna a sala para o modo de chat. |

---

## 3. Eventos Servidor ➔ Cliente (Broadcasts)

| Evento | Payload | Descrição |
| :--- | :--- | :--- |
| `chat:new_message` | `ChatMessage` | Nova mensagem de texto, anexo, enquete ou card de jogo. |
| `chat:reaction_updated`| `{ "message_id": string, "reactions": Record<string, string[]> }` | Atualização atômica de contagem de reações. |
| `chat:message_edited` | `{ "message_id": string, "content": string, "edited_at": string }` | Mensagem foi editada pelo autor. |
| `chat:message_deleted`| `{ "message_id": string }` | Mensagem foi removida do feed. |
| `chat:message_pinned` | `PinnedMessageInfo` | Mensagem fixada no topo da sala. |
| `chat:message_unpinned`| `{}` | Nenhuma mensagem fixada no topo. |
| `chat:poll_updated` | `{ "message_id": string, "poll": ChatPoll }` | Nova contagem de votos ou encerramento de enquete. |
| `chat:presence` | `{ "room_id": string, "online_users": string[], "count": number }` | Lista de participantes conectados na sala. |
| `chat:typing` | `{ "user_id": string, "nickname": string, "is_typing": boolean }` | Indicador de usuário digitando. |
| `game:state_sync` | `GameState` (DebateState \| QuizState) | Sincronização completa da Máquina de Estados da partida. |
| `game:tick` | `{ "time_remaining": number, "phase_end_timestamp": number }` | Atualização de relógio emitida a cada segundo. |
| `game:floating_reaction`| `{ "reaction": string, "from_nickname": string }` | Dispara animação de emoji flutuante no Modo TV. |
| `game:results` | `MatchSummary` | Revelação do vencedor e pontuação final. |

---

## 4. Endpoints REST da API

Base URL padrão: `http://localhost:8081`

### 4.1 Autenticação e Perfis
- `POST /api/auth/register` — Cadastra novo usuário (`nickname`, `email`, `password`).
- `POST /api/auth/login` — Autentica e retorna JWT Bearer Token.
- `GET /api/auth/me` — Retorna dados do usuário autenticado via cabeçalho `Authorization: Bearer <token>`.
- `PUT /api/auth/profile` — Atualiza cor de avatar, status de presença e biografia.

### 4.2 Salas de Chat
- `GET /api/rooms` — Lista salas públicas e privadas pertencentes ao usuário.
- `POST /api/rooms` — Cria uma nova sala ou grupo com código de convite de 6 caracteres.
- `GET /api/rooms/{id}` — Retorna detalhes, membros, administradores e mensagem fixada da sala.
- `POST /api/rooms/join` — Entra em uma sala existente através do código de convite PIN.
- `POST /api/rooms/{id}/members` — Adiciona participantes à sala.
- `DELETE /api/rooms/{id}/members/{user}` — Remove participante da sala.
- `PUT /api/rooms/{id}/admin` — Concede ou revoga privilégios de administrador.
- `PUT /api/rooms/{id}/settings` — Altera nome ou descrição do grupo.
- `POST /api/rooms/{id}/regenerate-code` — Gera novo código de convite PIN de 6 caracteres.
- `DELETE /api/rooms/{id}` — Exclui a sala permanentemente (apenas criador).

### 4.3 Anexos de Mídia (Imagens, Arquivos e Áudios)
- `POST /api/rooms/{id}/attachments` — Faz upload de mídia codificada em Base64 com hash SHA-256 e gera mensagem de chat com link de download.
- `GET /api/attachments/{attId}` — Serve o arquivo binário com Content-Type apropriado e cabeçalho `X-Attachment-SHA256`.

### 4.4 Histórico de Partidas e Rankings
- `GET /api/rooms/{id}/history` — Retorna as últimas partidas disputadas na sala (vencedores, pontuações, títulos).
- `GET /api/rooms/{id}/leaderboard` — Retorna o ranking consolidado de pontos e vitórias da sala.
- `GET /api/stats/player/{user}` — Retorna o histórico de carreira individual do jogador.

### 4.5 Banco de Questões e Tópicos da Sala
- `GET /api/rooms/{id}/topics` & `POST /api/rooms/{id}/topics` — Consulta ou adiciona novos temas de debate.
- `GET /api/rooms/{id}/questions` & `POST /api/rooms/{id}/questions` — Consulta ou adiciona novas perguntas de quiz com 4 alternativas.

### 4.6 Saúde & Auditoria de Segurança
- `GET /health` — Verificação de integridade operacional do servidor (`{ "status": "healthy" }`).
- `GET /api/security/audit` — Log estruturado em JSON com eventos de segurança (login, conexões WS, criação de salas, uploads).
- `GET /api/security/audit/export` — Exporta o relatório completo de auditoria para arquivo CSV/JSON.
