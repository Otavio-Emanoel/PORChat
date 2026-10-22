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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<Array<{ id: string; nickname: string }>>([]);
  const [gameState, setGameState] = useState<GameStateUpdatePayload | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (!roomId) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = process.env.NEXT_PUBLIC_WS_HOST || 'localhost:8080';
    let url = `${protocol}//${host}/ws?room_id=${encodeURI(roomId)}&client_type=${clientType}`;
    
    if (token) {
      url += `&token=${encodeURIComponent(token)}`;
    } else {
      url += `&nickname=${encodeURIComponent(nickname)}`;
    }

    const ws = new WebSocket(url);
    socketRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
    };

    ws.onclose = () => {
      setIsConnected(false);
      // Auto reconnect after 2 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 2000);
    };

    ws.onerror = (err) => {
      console.warn('WebSocket encountered error:', err);
      ws.close();
    };

    ws.onmessage = (event) => {
      try {
        const envelope: WebSocketEnvelope = JSON.parse(event.data);
        handleEnvelope(envelope);
      } catch (e) {
        console.error('Failed to parse WS payload:', e);
      }
    };
  }, [roomId, nickname, token, clientType]);

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
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [connect]);

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

  return {
    isConnected,
    messages,
    onlineUsers,
    gameState,
    sendMessage,
    sendAction,
  };
}
