# 📺 Web Frontend & Modo TV (Stage Display) — PORChat

O frontend do **PORChat** é desenvolvido em **Next.js 14** (App Router, TypeScript e Tailwind CSS). Ele cumpre dois papéis fundamentais:
1. **Cliente de Chat Completo:** Interface web ágil e responsiva para troca de mensagens, anexos e enquetes.
2. **Modo TV (Big-Screen Stage):** Visor de palco em tela cheia projetado especificamente para televisões, projetores e monitores durante os jogos síncronos da sala.

---

## 1. Interface Web de Chat (`/room/[roomId]`)

### 1.1 Barra de Ações Flutuante sem Layout Shift (Zero CLS)
Para evitar o problema de trepidação e rolagem inesperada do chat quando o cursor passa sobre uma mensagem:
- A barra de ações rápida (`MessageHoverToolbar`) possui posicionamento **`absolute -top-3.5`** com `z-20`.
- Ocupa **0px de espaço vertical no fluxo do documento**.
- A transição é controlada por classes utilitárias CSS do Tailwind: `opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto`.
- As pílulas de contagem de reações ativas (`MessageReactionBadges`) são exibidas de forma estática abaixo da mensagem apenas quando houver votos, sem sofrer alteração com o hover do mouse.

### 1.2 Citação Rica com Miniatura de Mídia
Ao responder a mensagens com mídia:
- **Barra de Composição:** Exibe o remetente original, ícone da mídia (`camera`, `file`, `mic`, `poll`) e **miniatura da imagem** (40x40px com cantos arredondados) antes do envio.
- **Card no Feed:** O balão da resposta renderiza o card estilizado com a miniatura da imagem original à direita e borda colorida na cor do design system (`#6C5CE7`).
- **Navegação com Salto:** Um clique no card de citação rola suavemente até a mensagem original com animação de destaque (*ring pulse*).

### 1.3 Recursos Adicionais do Feed
- **Recibo de Leitura em Tempo Real:** Indicador visual de entrega no servidor e contagem de participantes que leram a mensagem.
- **Notas de Áudio:** Player com barras de forma de onda (*waveform*) dinâmicas e controle de reprodução.
- **Enquetes Interativas:** Votação em tempo real com barras de progresso proporcionais coloridas.

---

## 2. Modo TV (`/tv` e `/tv/[roomId]`)

Inspirado no Kahoot e no Jackbox Games, o **Modo TV** transforma qualquer computador conectado a uma televisão ou projetor na arena visual da partida.

```
┌────────────────────────────────────────────────────────────────────────┐
│  [ARN-1000] MODO TRIBUNAL: Go vs Rust               TEMPO: 00:28 ⏱️   │
│ ══════════════════════════════════════════════════════════════════════ │
│                                                                        │
│   ┌───────────────────────────┐     ┌───────────────────────────┐      │
│   │   DEBATEDOR A: OTAVIO     │     │    DEBATEDOR B: PEDRO     │      │
│   │   "Goroutines e canais    │ vs. │  "Borrow checker elimina  │      │
│   │    tornam concorrência    │     │   data races em tempo     │      │
│   │    simples e legível."    │     │   de compilação."         │      │
│   └───────────────────────────┘     └───────────────────────────┘      │
│                                                                        │
│            [Votação da Plateia: 75% Lado A | 25% Lado B]               │
│                   ❤️  🔥  👏  (Reações ao vivo subindo)                │
└────────────────────────────────────────────────────────────────────────┘
```

### 2.1 Princípios de Design para Telas Grandes
- **Paleta Space Night (`#1E1E2E`):** Fundo escuro de alto contraste que reduz cansaço visual e valoriza as cores de destaque mesmo em ambientes iluminados.
- **Tipografia Escalonada com Viewport:** Usa unidades relativas (`vw`, `vh`, `clamp()`) para garantir legibilidade perfeita tanto em projetores 1080p quanto em Smart TVs 4K sem qualquer barra de rolagem vertical.
- **Contraste de Atores:**
  - Lado A do Debate: Coral Vibrante (`#FF7675`).
  - Lado B do Debate: Menta Fresco (`#00CEC9`).
  - Pódio e Vencedor: Ouro Solar (`#FDCB6E`).

### 2.2 Transmissão de Reações Flutuantes ao Vivo
Enquanto os debatedores discursam ou os jurados votam:
- Cada toque no celular dos participantes emite um evento `game:reaction`.
- O Modo TV recebe o broadcast e instancia partículas vetoriais animadas que sobem pela tela com física suave de flutuação e fade-out.

### 2.3 Áudio Feedback Sintetizado
O Modo TV inclui sintetizador de áudio via Web Audio API para tocar:
- Sons táteis de envio e recebimento de mensagens.
- Alerta sonoro de contagem regressiva nos últimos 5 segundos de cada fase.
- Fanfarra triunfal ao revelar o vencedor no pódio.
