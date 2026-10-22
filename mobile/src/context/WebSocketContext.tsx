import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
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
  setRoomId: (id: string) => void;
  setNickname: (name: string) => void;
  sendMessage: (content: string) => void;
  sendAction: (event: string, payload: unknown) => void;
  castVote: (choice: 'side_a' | 'side_b') => void;
  sendReaction: (emoji: string) => void;
  submitArgument: (argument: string) => void;
  submitQuizAnswer: (choice: 'A' | 'B' | 'C' | 'D') => void;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

const DEFAULT_ROOM_ID = '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d';

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [roomId, setRoomId] = useState(DEFAULT_ROOM_ID);
  const [nickname, setNickname] = useState('Otavio_Mobile');
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<Array<{ id: string; nickname: string }>>([]);
  const [gameState, setGameState] = useState<GameStateUpdatePayload | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (!roomId) return;

    // Change host IP if running on physical device or simulator
    const host = '10.0.2.2:8080'; // standard Android emulator loopback or localhost
    const url = `ws://${host}/ws?room_id=${encodeURI(roomId)}&nickname=${encodeURIComponent(nickname)}&client_type=mobile`;

    try {
      const ws = new WebSocket(url);
      socketRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
      };

      ws.onclose = () => {
        setIsConnected(false);
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 2000);
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
  }, [roomId, nickname]);

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
        setMessages((prev) => [...prev, msg]);
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

      default:
        break;
    }
  };

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (socketRef.current) socketRef.current.close();
    };
  }, [connect]);

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
        setRoomId,
        setNickname,
        sendMessage,
        sendAction,
        castVote,
        sendReaction,
        submitArgument,
        submitQuizAnswer,
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
