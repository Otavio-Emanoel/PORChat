# 📱 Mobile App & Game Controller — PORChat

O aplicativo móvel do **PORChat** é desenvolvido com **React Native** e **Expo**. Ele possui uma arquitetura de dupla personalidade: no cotidiano atua como um mensageiro veloz e moderno, e durante partidas síncronas se metamorfoseia em um **Controle Tátil de Jogo (Buzzer)**.

---

## 1. Experiência de Mensageria Móvel

### 1.1 Interface Inspirada no WhatsApp Moderno
- **Home com Abas:** Navegação por *Todas*, *Grupos*, *Diretas* e *Contatos*.
- **Criação de Grupos & Salas com PIN:** Modal para seleção múltipla de participantes e geração de código de convite de 6 caracteres.
- **Busca em Tempo Real:** Filtro instantâneo no feed da sala com destaque do termo pesquisado e contagem de ocorrências.
- **Perfil Customizável:** Edição de avatar com paleta de cores, fotos predefinidas e biografia.

### 1.2 Suporte Completo a Anexos e Mídia Nativa
O aplicativo suporta envio e visualização de fotos e documentos com integridade verificada via SHA-256:

| Tipo | Módulo Nativo | Recursos |
| :--- | :--- | :--- |
| **Fotos da Galeria** | `expo-image-picker` | Seleção de imagens da galeria com compressão JPEG otimizada. |
| **Câmera Direta** | `expo-image-picker` | Captura fotográfica instantânea. |
| **Documentos & Arquivos** | `expo-document-picker` | Envio de PDFs e arquivos com leitura em Base64 via `expo-file-system`. |
| **Enquetes Dinâmicas** | Nativo PORChat | Criação de enquetes de 2 a 8 opções com votação em barras coloridas. |

- **Pré-visualização Antes do Envio:** Chip expansível com miniatura da imagem ou ícone do arquivo com opção de cancelamento em um toque.
- **Visualizador Fullscreen de Imagem:** Toque na imagem abre o modal imersivo de alta resolução com botão para abertura externa.

---

## 2. Metamorfose em Game Controller (Segunda Tela)

Quando o backend sinaliza que a sala entrou em estado de jogo (`game:state_sync` com `phase != "CHAT"`), a tela do celular se transforma dinamicamente:

```
┌─────────────────────────────────────────────────────────┐
│ [ARN-1000] FASE DE VOTAÇÃO: Quem venceu o debate?       │
│ Tempo Restante: 00:18 ⏱️                                │
│ ─────────────────────────────────────────────────────── │
│                                                         │
│   ┌─────────────────────────────────────────────────┐   │
│   │                 VOTAR NO LADO A                 │   │
│   │              OTAVIO (Go Concorrência)           │   │
│   │               [Botão Coral Vibrante]            │   │
│   └─────────────────────────────────────────────────┘   │
│                                                         │
│   ┌─────────────────────────────────────────────────┐   │
│   │                 VOTAR NO LADO B                 │   │
│   │             PEDRO (Rust Memory Safety)          │   │
│   │               [Botão Menta Fresco]              │   │
│   └─────────────────────────────────────────────────┘   │
│                                                         │
│   Reações Rápidas para a TV: [❤️] [🔥] [👏] [💡]       │
└─────────────────────────────────────────────────────────┘
```

### 2.1 Papéis do Jogador
- **Debatedor Selecionado:** Campo de entrada com limite de caracteres e contagem regressiva para submeter o argumento de abertura ou réplica.
- **Jurado:** Dois cartões maciços de toque para votar no Lado A ou Lado B com feedback tátil.
- **Jogador de Quiz:** 4 botões geométricos em grade (Coral, Oceano, Mostarda, Esmeralda) medindo a velocidade de resposta em milissegundos.

### 2.2 Sincronização Global (`WebSocketContext`)
O estado da conexão com o WebSocket é mantido no topo da árvore de componentes React (`WebSocketContext`). Isso garante que:
- Alternar entre o feed de mensagens e o modo controle **nunca** desconecta o socket.
- Se o aplicativo for minimizado e reaberto, o estado do jogo é sincronizado no mesmo instante.

---

## 3. Desenvolvimento & Testes no Android Studio

### 3.1 Executar com Emulador Android
1. Inicie o emulador Android (ex.: `Medium_Phone_API_36.1`):
```bash
emulator -avd Medium_Phone_API_36.1
```

2. Configure o roteamento de portas locais para o emulador via `adb`:
```bash
# Permite que o emulador acesse o backend Go na porta 8081 do host
adb reverse tcp:8081 tcp:8081

# Permite que o emulador acesse o dev server Expo na porta 8082
adb reverse tcp:8082 tcp:8082
```

3. Inicie o Expo dev server:
```bash
cd mobile
npx expo start --port 8082 --localhost
```

4. Pressione `a` no terminal do Expo para instalar e abrir automaticamente o app no emulador Android.
