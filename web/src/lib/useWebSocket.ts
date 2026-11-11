'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type {
  WebSocketEnvelope,
  ChatMessage,
  ChatPoll,
  PinnedMessageInfo,
  Room,
  SysConnectedPayload,
  SysUserJoinedPayload,
  SysUserLeftPayload,
  GameStateUpdatePayload,
  TvReactionStreamPayload,
  ClientType,
} from './types';

interface UseWebSocketOptions {
  roomId: string;
  nickname: string;
  token?: string;
  clientType?: ClientType;
  onSessionTerminated?: (reason: string) => void;
}

export function useWebSocket({
  roomId,
  nickname,
  token,
  clientType = 'web',
  onSessionTerminated,
}: UseWebSocketOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [latency, setLatency] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<Array<{ id: string; nickname: string }>>([]);
  const [gameState, setGameState] = useState<GameStateUpdatePayload | null>(null);
  const [typingUsers, setTypingUsers] = useState<Record<string, { nickname: string; timestamp: number }>>({});
  const [pinnedMessage, setPinnedMessage] = useState<PinnedMessageInfo | null>(null);
  const [roomUpdate, setRoomUpdate] = useState<Room | null>(null);
  const [lastReactionEvent, setLastReactionEvent] = useState<{
    id: string;
    emoji: string;
    from?: string;
    timestamp: number;
  } | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isClosingExplicitlyRef = useRef<boolean>(false);
  const roomIdRef = useRef<string>(roomId);

  useEffect(() => {
    roomIdRef.current = roomId;
  }, [roomId]);

  // Fetch message history whenever roomId changes
  useEffect(() => {
    if (!roomId) return;
    setMessages([]);
    setGameState(null);
    setTypingUsers({});
    setPinnedMessage(null);
    setRoomUpdate(null);
    let isCancelled = false;
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8081';

    fetch(`${apiBase}/api/rooms/${roomId}/messages`)
      .then((res) => (res.ok ? res.json() : []))
      .then((history: ChatMessage[]) => {
        if (!isCancelled && Array.isArray(history)) {
          setMessages(history);
        }
      })
      .catch(() => {});

    return () => {
      isCancelled = true;
    };
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
        const p = envelope.payload as {
          message_id: string;
          content: string;
          edited_at: string;
          is_edited: boolean;
        };
        if (p && p.message_id) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === p.message_id
                ? { ...m, content: p.content, edited_at: p.edited_at, is_edited: true }
                : m
            )
          );
          setPinnedMessage((prev) =>
            prev && prev.message_id === p.message_id ? { ...prev, content: p.content } : prev
          );
        }
        break;
      }

      case 'chat:pin_updated': {
        const p = envelope.payload as {
          room_id: string;
          pinned_message: PinnedMessageInfo | null;
        };
        setPinnedMessage(p?.pinned_message || null);
        break;
      }

      case 'chat:read_receipt': {
        const p = envelope.payload as {
          room_id: string;
          user_id: string;
          nickname: string;
          message_ids: string[];
        };
        if (p && Array.isArray(p.message_ids) && p.nickname) {
          const idSet = new Set(p.message_ids);
          setMessages((prev) =>
            prev.map((m) => {
              if (!idSet.has(m.id)) return m;
              const existing = m.read_by || [];
              if (existing.some((r) => r.toLowerCase() === p.nickname.toLowerCase())) {
                return m;
              }
              return { ...m, read_by: [...existing, p.nickname] };
            })
          );
        }
        break;
      }

      case 'chat:poll_updated': {
        const p = envelope.payload as {
          room_id: string;
          message_id: string;
          poll: ChatPoll;
        };
        if (p && p.message_id && p.poll) {
          setMessages((prev) =>
            prev.map((m) => (m.id === p.message_id ? { ...m, poll: p.poll } : m))
          );
        }
        break;
      }

      case 'room:updated': {
        const p = envelope.payload as { room: Room };
        if (p?.room) {
          setRoomUpdate(p.room);
          if (p.room.pinned_message !== undefined) {
            setPinnedMessage(p.room.pinned_message || null);
          }
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

      case 'tv:reaction_stream': {
        const p = envelope.payload as TvReactionStreamPayload;
        const firstReaction = p?.emoji || p?.reactions?.[0]?.emoji;
        if (firstReaction) {
          setLastReactionEvent({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            emoji: firstReaction,
            from: p.from,
            timestamp: Date.now(),
          });
        }
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

      case 'chat:reaction': {
        const p = envelope.payload as {
          message_id: string;
          emoji: string;
          user_id?: string;
          reactions: Record<string, string[]>;
        };
        if (p && p.message_id) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === p.message_id ? { ...m, reactions: p.reactions } : m
            )
          );
        }
        break;
      }

      case 'chat:message_deleted': {
        const p = envelope.payload as { message_id: string };
        if (p && p.message_id) {
          setMessages((prev) => prev.filter((m) => m.id !== p.message_id));
          setPinnedMessage((prev) => (prev && prev.message_id === p.message_id ? null : prev));
        }
        break;
      }

      case 'auth:session_terminated': {
        const p = envelope.payload as { reason?: string };
        const reason =
          p?.reason ||
          'Sua conta foi conectada em outro dispositivo. Você foi desconectado.';
        isClosingExplicitlyRef.current = true;
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
        if (socketRef.current) {
          socketRef.current.close();
          socketRef.current = null;
        }
        setIsConnected(false);
        if (onSessionTerminated) {
          onSessionTerminated(reason);
        }
        break;
      }

      case 'sys:pong': {
        const p = envelope.payload as { client_time: number; server_time: number };
        if (p && p.client_time) {
          const rtt = Date.now() - p.client_time;
          setLatency(Math.max(1, Math.round(rtt)));
        }
        break;
      }

      default:
        break;
    }
  }, []);

  const connect = useCallback(() => {
    if (!roomId || !nickname) return;

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

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = process.env.NEXT_PUBLIC_WS_HOST || 'localhost:8081';
    let url = `${protocol}//${host}/ws?room_id=${encodeURI(roomId)}&client_type=${clientType}`;

    if (token) {
      url += `&token=${encodeURIComponent(token)}`;
    } else {
      url += `&nickname=${encodeURIComponent(nickname)}`;
    }

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
        console.warn('WebSocket encountered error:', err);
      };

      ws.onmessage = (event) => {
        try {
          const envelope: WebSocketEnvelope = JSON.parse(event.data);
          handleEnvelope(envelope);
        } catch (e) {
          console.error('Failed to parse WS payload:', e);
        }
      };
    } catch (e) {
      console.warn('Failed to construct WebSocket:', e);
    }
  }, [roomId, nickname, token, clientType, handleEnvelope]);

  useEffect(() => {
    connect();
    return () => {
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
  }, [connect]);

  // Periodically clean up expired typing indicators (older than 3s)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setTypingUsers((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const [uid, info] of Object.entries(next)) {
          if (now - info.timestamp > 3000) {
            delete next[uid];
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const sendAction = useCallback(
    (event: string, payload: unknown) => {
      if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
      const envelope: WebSocketEnvelope = {
        event,
        room_id: roomId,
        timestamp: Date.now(),
        payload,
      };
      socketRef.current.send(JSON.stringify(envelope));
    },
    [roomId]
  );

  const sendMessage = useCallback(
    (content: string, replyToId?: string) => {
      sendAction('chat:send', {
        content,
        ...(replyToId ? { reply_to_id: replyToId } : {}),
      });
    },
    [sendAction]
  );

  const editMessage = useCallback(
    (messageId: string, content: string) => {
      sendAction('chat:edit_message', { message_id: messageId, content });
    },
    [sendAction]
  );

  const pinMessage = useCallback(
    (messageId: string) => {
      sendAction('chat:pin_message', { message_id: messageId });
    },
    [sendAction]
  );

  const unpinMessage = useCallback(() => {
    sendAction('chat:unpin_message', {});
  }, [sendAction]);

  const markMessagesRead = useCallback(
    (messageIds?: string[]) => {
      sendAction('chat:mark_read', { message_ids: messageIds || [] });
    },
    [sendAction]
  );

  const createPoll = useCallback(
    (question: string, options: string[], multiSelect = false) => {
      sendAction('chat:create_poll', {
        question,
        options,
        multi_select: multiSelect,
      });
    },
    [sendAction]
  );

  const votePoll = useCallback(
    (messageId: string, optionId: string) => {
      sendAction('chat:vote_poll', {
        message_id: messageId,
        option_id: optionId,
      });
    },
    [sendAction]
  );

  const closePoll = useCallback(
    (messageId: string) => {
      sendAction('chat:close_poll', { message_id: messageId });
    },
    [sendAction]
  );

  const sendTyping = useCallback(
    (isTyping: boolean) => {
      sendAction('chat:typing', { is_typing: isTyping });
    },
    [sendAction]
  );

  // Heartbeat ping to measure latency
  useEffect(() => {
    if (!isConnected) return;
    const sendPing = () => {
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(
          JSON.stringify({
            event: 'sys:ping',
            room_id: roomId,
            timestamp: Date.now(),
            payload: { client_time: Date.now() },
          })
        );
      }
    };
    sendPing();
    const interval = setInterval(sendPing, 15000);
    return () => clearInterval(interval);
  }, [isConnected, roomId]);

  return {
    isConnected,
    latency,
    messages,
    setMessages,
    onlineUsers,
    gameState,
    typingUsers,
    pinnedMessage,
    setPinnedMessage,
    roomUpdate,
    lastReactionEvent,
    sendMessage,
    editMessage,
    pinMessage,
    unpinMessage,
    markMessagesRead,
    createPoll,
    votePoll,
    closePoll,
    sendTyping,
    sendAction,
  };
}
