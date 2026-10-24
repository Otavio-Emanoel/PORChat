'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useWebSocket } from '@/lib/useWebSocket';
import { getStoredUser, clearStoredSession, type User } from '@/lib/auth';
import {
  MessageSquare,
  Tv,
  Send,
  Users,
  Swords,
  Zap,
  ArrowLeft,
  Copy,
  Check,
  Smile,
  LogOut,
  Flame,
  Award,
} from 'lucide-react';
import Link from 'next/link';

interface RoomData {
  id: string;
  name: string;
  code: string;
}

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.roomId as string;

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [nickname, setNickname] = useState('Visitante');
  const [inputText, setInputText] = useState('');
  const [roomInfo, setRoomInfo] = useState<RoomData | null>(null);
  const [allRooms, setAllRooms] = useState<RoomData[]>([]);
  const [copied, setCopied] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize User
  useEffect(() => {
    const user = getStoredUser();
    if (user) {
      setCurrentUser(user);
      setNickname(user.nickname);
    } else {
      const guestNick = 'Visitante_' + Math.floor(100 + Math.random() * 900);
      setNickname(guestNick);
    }
  }, []);

  // Fetch Rooms info
  useEffect(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8081';
    fetch(`${apiBase}/api/rooms`)
      .then((res) => res.json())
      .then((data: RoomData[]) => {
        setAllRooms(data);
        const current = data.find((r) => r.id === roomId);
        if (current) setRoomInfo(current);
      })
      .catch((err) => console.error('Erro ao buscar salas:', err));
  }, [roomId]);

  const { isConnected, messages, onlineUsers, gameState, sendMessage, sendAction } = useWebSocket({
    roomId,
    nickname,
    clientType: 'web',
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    sendMessage(inputText.trim());
    setInputText('');
  };

  const handleStartDebate = () => {
    sendAction('game:start', {
      game_type: 'debate',
      topic: 'Abacaxi na pizza é crime ou alta gastronomia?',
      debater_a_id: currentUser?.id || 'debater-a',
      debater_b_id: 'debater-b',
    });
  };

  const handleStartQuiz = () => {
    sendAction('game:start', {
      game_type: 'quiz',
    });
  };

  const handleCopyInvite = () => {
    const inviteText = `${window.location.origin}/room/${roomId}`;
    navigator.clipboard.writeText(inviteText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReaction = (emoji: string) => {
    sendAction('game:reaction', { emoji });
  };

  const handleVote = (choice: 'side_a' | 'side_b') => {
    sendAction('debate:vote', { choice });
  };

  const handleAnswerQuiz = (choice: 'A' | 'B' | 'C' | 'D') => {
    sendAction('quiz:answer', { choice, timestamp: Date.now() });
  };

  return (
    <div className="flex h-screen bg-surface-light text-ink-main overflow-hidden font-body">
      {/* Channels Sidebar */}
      <aside className="w-72 bg-white border-r border-gray-200 flex flex-col justify-between hidden md:flex shadow-sm">
        <div>
          {/* Logo & Back to Home */}
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <Link
              href="/"
              className="flex items-center gap-2 text-ink-main hover:text-brand-primary transition-colors group"
            >
              <div className="w-8 h-8 rounded-xl bg-brand-primary flex items-center justify-center text-white font-heading font-bold text-lg shadow-sm group-hover:scale-105 transition-transform">
                P
              </div>
              <span className="font-heading text-lg tracking-tight">PORChat</span>
            </Link>
            <Link
              href="/"
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              title="Voltar para a Página Inicial"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </div>

          {/* Rooms Navigation List */}
          <div className="p-3">
            <div className="flex items-center justify-between px-2 mb-2">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                Canais de Festa
              </span>
              <span className="text-[10px] bg-gray-100 px-2 py-0.5 rounded-full font-bold text-gray-500">
                {allRooms.length}
              </span>
            </div>

            <div className="space-y-1">
              {allRooms.map((room) => {
                const isActive = room.id === roomId;
                return (
                  <button
                    key={room.id}
                    onClick={() => router.push(`/room/${room.id}`)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-2xl text-xs font-bold text-left transition-all ${
                      isActive
                        ? 'bg-brand-primary text-white shadow-sm'
                        : 'text-ink-main hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <MessageSquare className="w-4 h-4 shrink-0 opacity-80" />
                      <span className="truncate">{room.name}</span>
                    </div>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-lg font-mono ${
                        isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {room.code}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* User Session Footer */}
        <div className="p-4 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
          <div className="flex items-center gap-2.5 truncate">
            <div className="w-9 h-9 rounded-xl bg-brand-primary/10 text-brand-primary font-heading font-bold text-sm flex items-center justify-center shrink-0">
              {nickname.slice(0, 2).toUpperCase()}
            </div>
            <div className="truncate">
              <div className="text-xs font-bold truncate text-ink-main">{nickname}</div>
              <div className="text-[10px] text-brand-mint font-semibold flex items-center gap-1">
                <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-brand-mint animate-pulse' : 'bg-red-400'}`} />
                {isConnected ? 'Conectado' : 'Desconectado'}
              </div>
            </div>
          </div>
          {currentUser && (
            <button
              onClick={() => {
                clearStoredSession();
                setCurrentUser(null);
                setNickname('Visitante_' + Math.floor(100 + Math.random() * 900));
              }}
              title="Desconectar"
              className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </aside>

      {/* Main Chat Feed */}
      <main className="flex-1 flex flex-col h-full bg-white relative">
        {/* Room Header */}
        <header className="h-16 px-6 border-b border-gray-200 flex items-center justify-between bg-white z-10 shadow-sm">
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="font-heading text-lg font-bold text-ink-main tracking-tight leading-none">
                  {roomInfo?.name || 'Sala do Chat'}
                </h2>
                {roomInfo?.code && (
                  <button
                    onClick={handleCopyInvite}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-mono font-bold transition-all"
                    title="Clique para copiar link da sala"
                  >
                    <span>{roomInfo.code}</span>
                    {copied ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                  </button>
                )}
              </div>
              <div className="text-xs text-ink-muted flex items-center gap-2 mt-1">
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-gray-400" />
                  {onlineUsers.length} online
                </span>
                {gameState && gameState.phase !== 'CHAT' && (
                  <span className="px-2 py-0.5 rounded-full bg-brand-action/15 text-brand-action text-[10px] font-bold uppercase animate-pulse">
                    Fase: {gameState.phase}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action Trigger Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleStartDebate}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-brand-action text-white text-xs font-bold hover:bg-brand-action/90 shadow-sm tactile-btn transition-all"
            >
              <Swords className="w-3.5 h-3.5" />
              <span>Modo Debate</span>
            </button>

            <button
              type="button"
              onClick={handleStartQuiz}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-brand-primary text-white text-xs font-bold hover:bg-brand-primary/90 shadow-sm tactile-btn transition-all"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Quiz Relâmpago</span>
            </button>

            <Link
              href={`/tv/${roomId}`}
              target="_blank"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-surface-tv text-white text-xs font-bold hover:bg-surface-tv/90 shadow-sm tactile-btn transition-all"
            >
              <Tv className="w-3.5 h-3.5 text-brand-reward" />
              <span>Modo TV</span>
            </Link>
          </div>
        </header>

        {/* Active Game Banner / Action Cards */}
        {gameState && gameState.phase === 'VOTING' && (
          <div className="bg-gradient-to-r from-brand-action/10 via-brand-primary/10 to-brand-mint/10 p-4 border-b border-brand-primary/20 animate-in slide-in-from-top duration-300">
            <div className="max-w-2xl mx-auto flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-brand-action uppercase tracking-wider block">
                  Votação do Júri em Andamento!
                </span>
                <p className="text-sm font-bold text-ink-main">
                  Quem apresentou o melhor argumento?
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleVote('side_a')}
                  className="px-4 py-2 rounded-xl bg-brand-action text-white font-bold text-xs shadow-sm hover:scale-105 active:scale-95 transition-all"
                >
                  Lado A (Coral)
                </button>
                <button
                  onClick={() => handleVote('side_b')}
                  className="px-4 py-2 rounded-xl bg-brand-mint text-white font-bold text-xs shadow-sm hover:scale-105 active:scale-95 transition-all"
                >
                  Lado B (Mint)
                </button>
              </div>
            </div>
          </div>
        )}

        {gameState && gameState.phase === 'QUESTION' && (
          <div className="bg-surface-tv text-white p-4 border-b border-gray-800 animate-in slide-in-from-top duration-300">
            <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-brand-reward uppercase tracking-wider block">
                  Pergunta no Telão!
                </span>
                <p className="text-sm font-bold">Responda rápido para ganhar mais pontos:</p>
              </div>
              <div className="grid grid-cols-4 gap-2 w-full sm:w-auto">
                {(['A', 'B', 'C', 'D'] as const).map((opt) => (
                  <button
                    key={opt}
                    onClick={() => handleAnswerQuiz(opt)}
                    className="px-4 py-2 rounded-xl font-heading font-bold text-sm bg-brand-primary hover:bg-brand-primary/80 active:scale-95 transition-all"
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Message Feed */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-ink-muted">
              <div className="w-16 h-16 rounded-3xl bg-brand-primary/10 text-brand-primary flex items-center justify-center mb-4">
                <MessageSquare className="w-8 h-8" />
              </div>
              <h3 className="font-heading text-lg font-bold text-ink-main">Nenhuma mensagem ainda</h3>
              <p className="text-xs max-w-sm mt-1 text-gray-500">
                Quebre o gelo enviando um "Oi", inicie um debate animado ou lance um Quiz no telão!
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMe = msg.nickname === nickname;
              const isSystem = msg.type === 'system';

              if (isSystem) {
                return (
                  <div key={msg.id} className="flex justify-center my-2">
                    <span className="px-4 py-1.5 rounded-full bg-gray-100 text-gray-600 text-xs font-medium border border-gray-200/50">
                      ✨ {msg.content}
                    </span>
                  </div>
                );
              }

              return (
                <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-xs font-bold text-ink-main">{msg.nickname}</span>
                    <span className="text-[10px] text-gray-400">
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div
                    className={`max-w-md px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm ${
                      isMe
                        ? 'bg-brand-primary text-white rounded-tr-none'
                        : 'bg-white text-ink-main border border-gray-200 rounded-tl-none'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Floating Reaction Bar */}
        <div className="px-6 py-2 bg-gray-50/70 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
          <span className="font-semibold text-[11px] text-gray-400">Reações Rápidas no Telão:</span>
          <div className="flex items-center gap-1.5">
            {['🔥', '👏', '😂', '👑', '🤯', '💀'].map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => handleReaction(emoji)}
                className="w-8 h-8 rounded-full bg-white hover:bg-gray-100 border border-gray-200 flex items-center justify-center text-sm hover:scale-125 transition-all shadow-xs"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        {/* Message Input Footer */}
        <footer className="p-4 bg-white border-t border-gray-200">
          <form onSubmit={handleSend} className="flex gap-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={`Escreva uma mensagem como ${nickname}...`}
              className="flex-1 px-4 py-3 rounded-2xl border border-gray-200 text-sm focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 outline-none transition-all"
            />
            <button
              type="submit"
              disabled={!inputText.trim()}
              className="px-5 py-3 rounded-2xl bg-brand-primary text-white font-bold hover:bg-brand-primary/90 disabled:opacity-40 shadow-sm tactile-btn transition-all flex items-center justify-center"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </footer>
      </main>
    </div>
  );
}
