'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type {
  WebSocketEnvelope,
  ChatMessage,
  SysConnectedPayload,
  SysUserJoinedPayload,
  SysUserLeftPayload,
  GameStateUpdatePayload,
  ClientType,
} from './types';

interface UseWebSocketOptions {
  roomId: string;
  nickname: string;
  token?: string;
  clientType?: ClientType;
}

export function useWebSocket({
  roomId,
  nickname,
  token,
  clientType = 'web',
}: UseWebSocketOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [latency, setLatency] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<Array<{ id: string; nickname: string }>>([]);
  const [gameState, setGameState] = useState<GameStateUpdatePayload | null>(null);
  const [typingUsers, setTypingUsers] = useState<Record<string, { nickname: string; timestamp: number }>>({});

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isClosingExplicitlyRef = useRef<boolean>(false);

  // Fetch message history whenever roomId changes
  useEffect(() => {
    if (!roomId) return;
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
        setMessages((prev) => {
          // Strictly deduplicate by message ID
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

    // Clean up any existing connection before opening a new one
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
        // Only reconnect if this wasn't an intentional teardown
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

  const sendMessage = (content: string) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
    const envelope: WebSocketEnvelope = {
      event: 'chat:send',
      room_id: roomId,
      timestamp: Date.now(),
      payload: { content },
    };
    socketRef.current.send(JSON.stringify(envelope));
  };

  const sendTyping = (isTyping: boolean) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
    const envelope: WebSocketEnvelope = {
      event: 'chat:typing',
      room_id: roomId,
      timestamp: Date.now(),
      payload: { is_typing: isTyping },
    };
    socketRef.current.send(JSON.stringify(envelope));
  };

  const sendAction = (event: string, payload: unknown) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
    const envelope: WebSocketEnvelope = {
      event,
      room_id: roomId,
      timestamp: Date.now(),
      payload,
    };
    socketRef.current.send(JSON.stringify(envelope));
  };

  // Heartbeat ping to measure latency (Item 77)
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
    sendMessage,
    sendTyping,
    sendAction,
  };
}

