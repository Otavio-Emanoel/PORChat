import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { Platform } from 'react-native';
import type {
  WebSocketEnvelope,
  ChatMessage,
  ChatPoll,
  PinnedMessageInfo,
  Room,
  User,
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
  pinnedMessage: PinnedMessageInfo | null;
  setPinnedMessage: (pin: PinnedMessageInfo | null) => void;
  roomUpdate: Room | null;
  roomId: string;
  nickname: string;
  userProfile: User | null;
  authToken: string | null;
  serverHost: string;
  setServerHost: (host: string) => void;
  setRoomId: (id: string) => void;
  setNickname: (name: string) => void;
  sendMessage: (content: string, replyToId?: string) => void;
  editMessage: (messageId: string, content: string) => void;
  deleteMessage: (messageId: string) => void;
  pinMessage: (messageId: string) => void;
  unpinMessage: () => void;
  markMessagesRead: (messageIds?: string[]) => void;
  createPoll: (question: string, options: string[], multiSelect?: boolean) => void;
  votePoll: (messageId: string, optionId: string) => void;
  closePoll: (messageId: string) => void;
  sendTyping: (isTyping: boolean) => void;
  sendAction: (event: string, payload: unknown) => void;
  castVote: (choice: 'side_a' | 'side_b') => void;
  sendReaction: (emoji: string) => void;
  submitArgument: (argument: string, phase?: 'opening' | 'rebuttal') => void;
  playerReady: () => void;
  askCourtQuestion: (question: string) => void;
  submitQuizAnswer: (choice: 'A' | 'B' | 'C' | 'D') => void;
  loginWithCredentials: (email: string, password: string) => Promise<boolean>;
  updateMobileProfile: (payload: {
    nickname?: string;
    avatar_color?: string;
    status_text?: string;
    bio?: string;
  }) => Promise<boolean>;
  typingUsers: Record<string, { nickname: string; timestamp: number }>;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

const DEFAULT_ROOM_ID = '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d';

const getDefaultHost = () => {
  const win =
    typeof globalThis !== 'undefined'
      ? ((globalThis as Record<string, unknown>).window as { location?: { hostname?: string } } | undefined)
      : undefined;
  if (Platform.OS === 'web' && win?.location?.hostname) {
    return `${win.location.hostname}:8081`;
  }
  return '192.168.3.138:8081';
};

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [roomId, setRoomId] = useState(DEFAULT_ROOM_ID);
  const [nickname, setNickname] = useState('Otavio');
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [serverHost, setServerHost] = useState(getDefaultHost);
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<Array<{ id: string; nickname: string }>>([]);
  const [gameState, setGameState] = useState<GameStateUpdatePayload | null>(null);
  const [pinnedMessage, setPinnedMessage] = useState<PinnedMessageInfo | null>(null);
  const [roomUpdate, setRoomUpdate] = useState<Room | null>(null);
  const [typingUsers, setTypingUsers] = useState<Record<string, { nickname: string; timestamp: number }>>({});

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isClosingExplicitlyRef = useRef<boolean>(false);
  const roomIdRef = useRef<string>(roomId);

  useEffect(() => {
    roomIdRef.current = roomId;
  }, [roomId]);

  const handleEnvelope = useCallback((envelope: WebSocketEnvelope) => {
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
        const currentRoom = roomIdRef.current;
        if (envelope.room_id && currentRoom && envelope.room_id !== currentRoom) {
          return;
        }
        if (msg.room_id && currentRoom && msg.room_id !== currentRoom) {
          return;
        }
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) {
            return prev;
          }
          return [...prev, msg];
        });
        break;
      }

      case 'chat:message_edited': {
        const updatedMsg = envelope.payload as ChatMessage;
        setMessages((prev) =>
          prev.map((m) => (m.id === updatedMsg.id ? { ...m, ...updatedMsg } : m))
        );
        setPinnedMessage((prev) =>
          prev && prev.message_id === updatedMsg.id
            ? { ...prev, content: updatedMsg.content }
            : prev
        );
        break;
      }

      case 'chat:pin_updated': {
        const payload = envelope.payload as { pinned_message: PinnedMessageInfo | null };
        setPinnedMessage(payload.pinned_message || null);
        break;
      }

      case 'chat:read_receipt': {
        const payload = envelope.payload as { user: string; message_ids: string[] };
        const idSet = new Set(payload.message_ids || []);
        if (idSet.size === 0 || !payload.user) break;
        setMessages((prev) =>
          prev.map((m) => {
            if (!idSet.has(m.id)) return m;
            const currentRead = m.read_by || [];
            if (currentRead.some((r) => r.toLowerCase() === payload.user.toLowerCase())) {
              return m;
            }
            return { ...m, read_by: [...currentRead, payload.user] };
          })
        );
        break;
      }

      case 'chat:poll_updated': {
        const payload = envelope.payload as { message_id: string; poll: ChatPoll };
        setMessages((prev) =>
          prev.map((m) => (m.id === payload.message_id ? { ...m, poll: payload.poll } : m))
        );
        break;
      }

      case 'chat:reaction': {
        const payload = envelope.payload as {
          message_id: string;
          reactions: Record<string, string[]>;
        };
        setMessages((prev) =>
          prev.map((m) =>
            m.id === payload.message_id ? { ...m, reactions: payload.reactions } : m
          )
        );
        break;
      }

      case 'chat:message_deleted': {
        const payload = envelope.payload as { message_id: string };
        setMessages((prev) => prev.filter((m) => m.id !== payload.message_id));
        setPinnedMessage((prev) =>
          prev && prev.message_id === payload.message_id ? null : prev
        );
        break;
      }

      case 'room:updated': {
        const updatedRoom = envelope.payload as Room;
        setRoomUpdate(updatedRoom);
        if (updatedRoom.pinned_message !== undefined) {
          setPinnedMessage(updatedRoom.pinned_message || null);
        }
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
  }, []);

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
    const params = new URLSearchParams({
      room_id: roomId,
      nickname,
      client_type: 'mobile',
    });
    if (authToken) {
      params.set('token', authToken);
    }
    const url = `ws://${host}/ws?${params.toString()}`;

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
  }, [roomId, nickname, serverHost, authToken, handleEnvelope]);

  useEffect(() => {
    if (!roomId) return;
    setMessages([]);
    setGameState(null);
    setTypingUsers({});
    setPinnedMessage(null);
    setRoomUpdate(null);
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
      } catch {
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

  const sendMessage = (content: string, replyToId?: string) => {
    sendAction('chat:send', {
      content,
      ...(replyToId ? { reply_to_id: replyToId } : {}),
    });
  };

  const editMessage = (messageId: string, content: string) => {
    sendAction('chat:edit_message', { message_id: messageId, content });
  };

  const deleteMessage = (messageId: string) => {
    sendAction('chat:delete_message', { message_id: messageId });
  };

  const pinMessage = (messageId: string) => {
    sendAction('chat:pin_message', { message_id: messageId });
  };

  const unpinMessage = () => {
    sendAction('chat:unpin_message', {});
  };

  const markMessagesRead = (messageIds?: string[]) => {
    sendAction('chat:mark_read', { message_ids: messageIds || [] });
  };

  const createPoll = (question: string, options: string[], multiSelect = false) => {
    sendAction('chat:create_poll', {
      question,
      options,
      multi_select: multiSelect,
    });
  };

  const votePoll = (messageId: string, optionId: string) => {
    sendAction('chat:vote_poll', {
      message_id: messageId,
      option_id: optionId,
    });
  };

  const closePoll = (messageId: string) => {
    sendAction('chat:close_poll', { message_id: messageId });
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

  const submitArgument = (argument: string, phase?: 'opening' | 'rebuttal') => {
    sendAction('debate:submit_argument', {
      argument,
      ...(phase ? { phase } : {}),
    });
  };

  const playerReady = () => {
    sendAction('debate:player_ready', {});
  };

  const askCourtQuestion = (question: string) => {
    sendAction('debate:ask_question', { question });
  };

  const submitQuizAnswer = (choice: 'A' | 'B' | 'C' | 'D') => {
    sendAction('quiz:submit_answer', {
      choice,
      client_sent_ms: Date.now(),
    });
  };

  const loginWithCredentials = async (email: string, password: string): Promise<boolean> => {
    try {
      const host = serverHost.trim() || 'localhost:8081';
      const res = await fetch(`http://${host}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      if (data.user && data.token) {
        setUserProfile(data.user);
        setAuthToken(data.token);
        setNickname(data.user.nickname);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const updateMobileProfile = async (payload: {
    nickname?: string;
    avatar_color?: string;
    status_text?: string;
    bio?: string;
  }): Promise<boolean> => {
    try {
      const host = serverHost.trim() || 'localhost:8081';
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }
      const res = await fetch(
        `http://${host}/api/auth/profile?user=${encodeURIComponent(nickname)}`,
        {
          method: 'PUT',
          headers,
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) return false;
      const data = await res.json();
      if (data.user) {
        setUserProfile(data.user);
        setNickname(data.user.nickname);
        if (data.token) setAuthToken(data.token);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  return (
    <WebSocketContext.Provider
      value={{
        isConnected,
        messages,
        onlineUsers,
        gameState,
        pinnedMessage,
        setPinnedMessage,
        roomUpdate,
        roomId,
        nickname,
        userProfile,
        authToken,
        serverHost,
        setServerHost,
        setRoomId,
        setNickname,
        sendMessage,
        editMessage,
        deleteMessage,
        pinMessage,
        unpinMessage,
        markMessagesRead,
        createPoll,
        votePoll,
        closePoll,
        sendTyping,
        sendAction,
        castVote,
        sendReaction,
        submitArgument,
        playerReady,
        askCourtQuestion,
        submitQuizAnswer,
        loginWithCredentials,
        updateMobileProfile,
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
