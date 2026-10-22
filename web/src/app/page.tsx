'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useWebSocket } from '@/lib/useWebSocket';
import { MessageSquare, Tv, Send, Sparkles, Users, Swords, Zap, UserPlus } from 'lucide-react';
import Link from 'next/link';

const ROOMS = [
  { id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d', name: 'Lobby Principal (PORChat)', code: 'POR-1000' },
  { id: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', name: 'Tribunal dos Debates', code: 'DEB-2000' },
  { id: 'f1e2d3c4-b5a6-9876-5432-10fedcba9876', name: 'Arena Quiz Relâmpago', code: 'QZ-3000' },
];

const PRESET_PROFILES = ['Otavio', 'Pedro', 'Raul'];

export default function ChatPage() {
  const [selectedRoom, setSelectedRoom] = useState(ROOMS[0]);
  const [nickname, setNickname] = useState('Otavio');
  const [customNick, setCustomNick] = useState('');
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { isConnected, messages, onlineUsers, gameState, sendMessage, sendAction } = useWebSocket({
    roomId: selectedRoom.id,
    nickname: nickname,
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
      debater_a_id: '11111111-1111-1111-1111-111111111111',
      debater_b_id: '22222222-2222-2222-2222-222222222222',
    });
  };

  const handleStartQuiz = () => {
    sendAction('game:start', {
      game_type: 'quiz',
    });
  };

  const handleAddCustomNick = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customNick.trim()) return;
    setNickname(customNick.trim());
    setCustomNick('');
  };

  return (
    <div className="flex h-screen bg-surface-light text-ink-main overflow-hidden font-body">
      {/* Sidebar */}
      <aside className="w-80 bg-white border-r border-gray-200 flex flex-col justify-between hidden md:flex shadow-sm">
        <div>
          {/* Logo Header */}
          <div className="p-5 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-brand-primary flex items-center justify-center text-white font-heading text-xl shadow-md">
                P
              </div>
              <div>
                <h1 className="font-heading text-xl tracking-tight text-ink-main leading-none">
                  PORChat
                </h1>
                <span className="text-xs text-brand-primary font-medium">Chat & Mini-Games</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand-mint/15 text-brand-mint text-xs font-semibold">
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-brand-mint animate-pulse' : 'bg-red-400'}`} />
              {isConnected ? 'Ao Vivo' : 'Off'}
            </div>
          </div>

          {/* User Profile Multi-Tab Switcher */}
          <div className="p-4 mx-4 my-3 bg-gray-50 rounded-2xl border border-gray-100">
            <label className="text-xs font-bold text-ink-muted uppercase tracking-wider block mb-2">
              Perfil Atual: <span className="text-brand-primary">{nickname}</span>
            </label>
            <div className="flex gap-2 mb-2">
              {PRESET_PROFILES.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setNickname(p)}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all ${
                    nickname === p
                      ? 'bg-brand-primary text-white shadow-sm'
                      : 'bg-white text-ink-muted hover:bg-gray-100 border border-gray-200'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
            {/* Custom Nickname Input */}
            <form onSubmit={handleAddCustomNick} className="flex gap-1.5 mt-2">
              <input
                type="text"
                placeholder="Novo apelido..."
                value={customNick}
                onChange={(e) => setCustomNick(e.target.value)}
                className="flex-1 bg-white border border-gray-200 rounded-xl px-2.5 py-1 text-xs text-ink-main focus:outline-none focus:ring-1 focus:ring-brand-primary"
              />
              <button
                type="submit"
                disabled={!customNick.trim()}
                className="px-2 py-1 bg-gray-200 text-ink-main rounded-xl text-xs font-bold hover:bg-brand-primary hover:text-white disabled:opacity-40 transition-colors"
              >
                <UserPlus size={14} />
              </button>
            </form>
          </div>

          {/* Room Channels */}
          <div className="px-3">
            <h2 className="px-3 text-xs font-bold text-ink-muted uppercase tracking-wider mb-2">
              Canais do Chat
            </h2>
            <div className="space-y-1">
              {ROOMS.map((room) => {
                const isActive = room.id === selectedRoom.id;
                return (
                  <button
                    key={room.id}
                    onClick={() => setSelectedRoom(room)}
                    className={`w-full text-left px-3.5 py-2.5 rounded-2xl font-medium text-sm flex items-center justify-between transition-all ${
                      isActive
                        ? 'bg-brand-primary/10 text-brand-primary font-semibold'
                        : 'text-ink-main hover:bg-gray-100/80'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <MessageSquare size={18} className={isActive ? 'text-brand-primary' : 'text-gray-400'} />
                      <span className="truncate">{room.name}</span>
                    </div>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-gray-100 text-ink-muted">
                      {room.code}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* TV Mode Big CTA in Sidebar */}
        <div className="p-4 border-t border-gray-100">
          <Link
            href={`/tv/${selectedRoom.id}`}
            target="_blank"
            className="w-full py-3 px-4 rounded-2xl bg-surface-tv text-white font-heading text-sm flex items-center justify-center gap-2 tactile-btn hover:bg-opacity-95 shadow-lg"
          >
            <Tv size={18} className="text-brand-reward" />
            <span>Abrir Modo TV (Palco)</span>
          </Link>
        </div>
      </aside>

      {/* Main Chat Feed */}
      <main className="flex-1 flex flex-col bg-surface-light h-full overflow-hidden">
        {/* Top Header */}
        <header className="h-16 px-6 bg-white border-b border-gray-200 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <h2 className="font-heading text-lg font-bold text-ink-main">{selectedRoom.name}</h2>
            <div className="flex items-center gap-1.5 text-xs text-ink-muted bg-gray-100 px-2.5 py-1 rounded-full">
              <Users size={14} className="text-brand-primary" />
              <span>{onlineUsers.length} online</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleStartDebate}
              className="py-2 px-3.5 bg-brand-action text-white rounded-xl text-xs font-bold flex items-center gap-1.5 tactile-btn hover:brightness-105"
            >
              <Swords size={16} />
              <span>Modo Debate</span>
            </button>
            <button
              onClick={handleStartQuiz}
              className="py-2 px-3.5 bg-brand-primary text-white rounded-xl text-xs font-bold flex items-center gap-1.5 tactile-btn hover:brightness-105"
            >
              <Zap size={16} className="text-brand-reward" />
              <span>Quiz Relâmpago</span>
            </button>
            <Link
              href={`/tv/${selectedRoom.id}`}
              target="_blank"
              className="py-2 px-3.5 bg-surface-tv text-white rounded-xl text-xs font-bold flex items-center gap-1.5 tactile-btn hover:brightness-110"
            >
              <Tv size={16} className="text-brand-reward" />
              <span>Modo TV</span>
            </Link>
          </div>
        </header>

        {/* Active Game Banner if Game is Ongoing */}
        {gameState && gameState.phase !== 'CHAT' && (
          <div className="bg-brand-primary text-white px-6 py-3 flex items-center justify-between shadow-md animate-fade-in">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                {gameState.game_type === 'quiz' ? <Zap size={18} className="text-brand-reward" /> : <Swords size={18} />}
              </div>
              <div>
                <p className="font-heading text-sm font-bold">
                  {gameState.game_type === 'quiz' ? '⚡ Quiz Relâmpago Ativo!' : '⚖️ Modo Debate em Julgamento!'}
                </p>
                <p className="text-xs text-white/80">Fase atual: {gameState.phase}</p>
              </div>
            </div>
            <div className="text-right">
              <span className="font-mono text-2xl font-black text-brand-reward">
                {gameState.remaining_seconds}s
              </span>
            </div>
          </div>
        )}

        {/* Messages Stream */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-ink-muted">
              <div className="w-16 h-16 rounded-3xl bg-brand-primary/10 text-brand-primary flex items-center justify-center mb-3">
                <Sparkles size={28} />
              </div>
              <p className="font-heading text-lg font-bold text-ink-main">Nenhuma mensagem ainda</p>
              <p className="text-sm max-w-sm">Mande uma mensagem, inicie o Debate ou o Quiz e ligue o Modo TV!</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMe = msg.nickname === nickname;
              const isSystem = msg.type === 'system';

              if (isSystem) {
                return (
                  <div key={msg.id} className="flex justify-center my-3">
                    <div className="px-4 py-1.5 rounded-full bg-brand-reward/20 text-ink-main text-xs font-semibold flex items-center gap-1.5 border border-brand-reward/30">
                      <Sparkles size={14} className="text-amber-600" />
                      <span>{msg.content}</span>
                    </div>
                  </div>
                );
              }

              return (
                <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  <span className="text-[11px] font-bold text-ink-muted mb-1 px-1">
                    {msg.nickname}
                  </span>
                  <div
                    className={`max-w-md px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-xs ${
                      isMe
                        ? 'bg-brand-primary text-white rounded-br-xs'
                        : 'bg-white text-ink-main border border-gray-100 rounded-bl-xs'
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

        {/* Message Input Form */}
        <footer className="p-4 bg-white border-t border-gray-200">
          <form onSubmit={handleSend} className="flex items-center gap-2 max-w-4xl mx-auto">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={`Escreva como ${nickname}...`}
              className="flex-1 bg-surface-light border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/50 text-ink-main placeholder:text-gray-400"
            />
            <button
              type="submit"
              disabled={!inputText.trim()}
              className="w-12 h-12 rounded-2xl bg-brand-primary text-white flex items-center justify-center tactile-btn disabled:opacity-40 disabled:pointer-events-none"
            >
              <Send size={18} />
            </button>
          </form>
        </footer>
      </main>
    </div>
  );
}
