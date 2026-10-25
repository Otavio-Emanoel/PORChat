import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { Platform } from 'react-native';
import type {
  WebSocketEnvelope,
  ChatMessage,
  SysConnectedPayload,
  SysUserJoinedPayload,
  SysUserLeftPayload,
  GameStateUpdatePayload,
} from '../types';

interface WebSocketContextType {
  isConnected: boolean;
  messages: ChatMessage[];
  onlineUsers: Array<{ id: string; nickname: string }>;
  gameState: GameStateUpdatePayload | null;
  roomId: string;
  nickname: string;
  serverHost: string;
  setServerHost: (host: string) => void;
  setRoomId: (id: string) => void;
  setNickname: (name: string) => void;
  sendMessage: (content: string) => void;
  sendTyping: (isTyping: boolean) => void;
  sendAction: (event: string, payload: unknown) => void;
  castVote: (choice: 'side_a' | 'side_b') => void;
  sendReaction: (emoji: string) => void;
  submitArgument: (argument: string) => void;
  submitQuizAnswer: (choice: 'A' | 'B' | 'C' | 'D') => void;
  typingUsers: Record<string, { nickname: string; timestamp: number }>;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

const DEFAULT_ROOM_ID = '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d';

const getDefaultHost = () => {
  const win = typeof globalThis !== 'undefined' ? (globalThis as Record<string, unknown>).window as { location?: { hostname?: string } } | undefined : undefined;
  if (Platform.OS === 'web' && win?.location?.hostname) {
    return `${win.location.hostname}:8081`;
  }
  return '192.168.3.138:8081';
};

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [roomId, setRoomId] = useState(DEFAULT_ROOM_ID);
  const [nickname, setNickname] = useState('Otavio_Mobile');
  const [serverHost, setServerHost] = useState(getDefaultHost);
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<Array<{ id: string; nickname: string }>>([]);
  const [gameState, setGameState] = useState<GameStateUpdatePayload | null>(null);
  const [typingUsers, setTypingUsers] = useState<Record<string, { nickname: string; timestamp: number }>>({});

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isClosingExplicitlyRef = useRef<boolean>(false);

  const connect = useCallback(() => {
    if (!roomId) return;

    if (socketRef.current) {
      isClosingExplicitlyRef.current = true;
      socketRef.current.onopen = null;
      socketRef.current.onclose = null;
      socketRef.current.onerror = null;
      socketRef.current.onmessage = null;
      socketRef.current.close();
      socketRef.current = null;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    isClosingExplicitlyRef.current = false;

    const host = serverHost.trim() || 'localhost:8081';
    const url = `ws://${host}/ws?room_id=${encodeURI(roomId)}&nickname=${encodeURIComponent(nickname)}&client_type=mobile`;

    try {
      const ws = new WebSocket(url);
      socketRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
      };

      ws.onclose = () => {
        setIsConnected(false);
        if (!isClosingExplicitlyRef.current) {
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, 2500);
        }
      };

      ws.onerror = (err) => {
        console.warn('Mobile WS error:', err);
      };

      ws.onmessage = (event) => {
        try {
          const envelope: WebSocketEnvelope = JSON.parse(event.data);
          handleEnvelope(envelope);
        } catch (e) {
          console.error('Failed to parse mobile WS envelope:', e);
        }
      };
    } catch (e) {
      console.warn('Could not establish socket connection:', e);
    }
  }, [roomId, nickname, serverHost]);

  const handleEnvelope = (envelope: WebSocketEnvelope) => {
    switch (envelope.event) {
      case 'sys:connected': {
        const payload = envelope.payload as SysConnectedPayload;
        setOnlineUsers(payload.online_users || []);
        if (payload.active_game) {
          setGameState(payload.active_game);
        }
        break;
      }

      case 'sys:user_joined': {
        const payload = envelope.payload as SysUserJoinedPayload;
        setOnlineUsers((prev) => {
          if (prev.some((u) => u.id === payload.user_id)) return prev;
          return [...prev, { id: payload.user_id, nickname: payload.nickname }];
        });
        break;
      }

      case 'sys:user_left': {
        const payload = envelope.payload as SysUserLeftPayload;
        setOnlineUsers((prev) => prev.filter((u) => u.id !== payload.user_id));
        break;
      }

      case 'chat:new_message': {
        const msg = envelope.payload as ChatMessage;
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) {
            return prev;
          }
          return [...prev, msg];
        });
        break;
      }

      case 'game:state_update': {
        const state = envelope.payload as GameStateUpdatePayload;
        setGameState(state);
        break;
      }

      case 'game:tick': {
        const tick = envelope.payload as { remaining_seconds: number; phase_ends_at: number };
        setGameState((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            remaining_seconds: tick.remaining_seconds,
            phase_ends_at: tick.phase_ends_at,
          };
        });
        break;
      }

      case 'chat:typing': {
        const payload = envelope.payload as { user_id: string; nickname: string; is_typing: boolean };
        setTypingUsers((prev) => {
          const next = { ...prev };
          if (payload.is_typing) {
            next[payload.user_id] = { nickname: payload.nickname, timestamp: Date.now() };
          } else {
            delete next[payload.user_id];
          }
          return next;
        });
        break;
      }

      default:
        break;
    }
  };

  useEffect(() => {
    // Reset and fetch message history for the selected room
    let isCancelled = false;
    const fetchHistory = async () => {
      try {
        const host = serverHost.trim() || 'localhost:8081';
        const res = await fetch(`http://${host}/api/rooms/${roomId}/messages`);
        if (res.ok) {
          const history = await res.json();
          if (!isCancelled && Array.isArray(history)) {
            setMessages(history);
            return;
          }
        }
      } catch (e) {
        // Fallback
      }
      if (!isCancelled) {
        setMessages([]);
      }
    };

    fetchHistory();
    connect();

    return () => {
      isCancelled = true;
      isClosingExplicitlyRef.current = true;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (socketRef.current) {
        socketRef.current.onopen = null;
        socketRef.current.onclose = null;
        socketRef.current.onerror = null;
        socketRef.current.onmessage = null;
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, [connect, roomId, serverHost]);

  const sendAction = (event: string, payload: unknown) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
    const env: WebSocketEnvelope = {
      event,
      room_id: roomId,
      timestamp: Date.now(),
      payload,
    };
    socketRef.current.send(JSON.stringify(env));
  };

  const sendMessage = (content: string) => {
    sendAction('chat:send', { content });
  };

  const sendTyping = (isTyping: boolean) => {
    sendAction('chat:typing', { is_typing: isTyping });
  };

  const castVote = (choice: 'side_a' | 'side_b') => {
    sendAction('debate:cast_vote', { choice });
  };

  const sendReaction = (emoji: string) => {
    sendAction('debate:reaction', { emoji });
  };

  const submitArgument = (argument: string) => {
    sendAction('debate:submit_argument', { argument });
  };

  const submitQuizAnswer = (choice: 'A' | 'B' | 'C' | 'D') => {
    sendAction('quiz:submit_answer', {
      choice,
      client_sent_ms: Date.now(),
    });
  };

  return (
    <WebSocketContext.Provider
      value={{
        isConnected,
        messages,
        onlineUsers,
        gameState,
        roomId,
        nickname,
        serverHost,
        setServerHost,
        setRoomId,
        setNickname,
        sendMessage,
        sendTyping,
        sendAction,
        castVote,
        sendReaction,
        submitArgument,
        submitQuizAnswer,
        typingUsers,
      }}
    >
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocketContext = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocketContext must be used within a WebSocketProvider');
  }
  return context;
};
