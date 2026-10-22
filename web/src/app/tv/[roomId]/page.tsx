'use client';

import React, { useState, useEffect } from 'react';
import { useWebSocket } from '@/lib/useWebSocket';
import { Flame, Sparkles, Trophy, Users, Swords } from 'lucide-react';

export default function TVModePage({ params }: { params: { roomId: string } }) {
  const { roomId } = params;
  const [reactions, setReactions] = useState<Array<{ id: number; emoji: string; left: number }>>([]);

  const { isConnected, onlineUsers, gameState } = useWebSocket({
    roomId,
    nickname: 'TV_Display',
    clientType: 'tv',
  });

  const debateState = gameState?.debate_state;
  const isDebate = gameState?.game_type === 'debate';
  const phase = gameState?.phase || 'CHAT';
  const remaining = gameState?.remaining_seconds ?? 0;

  // Add floating reaction particles on state reaction
  const triggerReaction = (emoji: string) => {
    const id = Date.now() + Math.random();
    const left = Math.floor(Math.random() * 80) + 10; // 10% to 90% width
    setReactions((prev) => [...prev, { id, emoji, left }]);
    setTimeout(() => {
      setReactions((prev) => prev.filter((r) => r.id !== id));
    }, 3000);
  };

  return (
    <div className="min-h-screen bg-surface-tv text-white flex flex-col justify-between p-8 md:p-12 font-heading overflow-hidden relative select-none">
      {/* Floating Reactions Layer */}
      <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden">
        {reactions.map((r) => (
          <div
            key={r.id}
            className="absolute bottom-10 text-5xl animate-bounce"
            style={{ left: `${r.left}%`, transition: 'all 3s linear', transform: 'translateY(-120vh)' }}
          >
            {r.emoji}
          </div>
        ))}
      </div>

      {/* TV Header Bar */}
      <header className="flex items-center justify-between border-b border-white/10 pb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-3xl bg-brand-primary flex items-center justify-center text-white text-3xl font-black shadow-lg shadow-brand-primary/30">
            P
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight flex items-center gap-2">
              <span>PORChat</span>
              <span className="text-sm font-mono px-3 py-1 bg-brand-reward/20 text-brand-reward rounded-full border border-brand-reward/30">
                TV MODE
              </span>
            </h1>
            <p className="text-xs text-white/50 font-body">Conecte seu celular para jogar e votar</p>
          </div>
        </div>

        {/* Status / Room Info */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/5 border border-white/10 text-sm">
            <Users size={18} className="text-brand-mint" />
            <span className="font-bold">{onlineUsers.length} Jogadores</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-brand-mint/15 text-brand-mint text-sm font-bold border border-brand-mint/20">
            <span className="w-2.5 h-2.5 rounded-full bg-brand-mint animate-ping" />
            <span>AO VIVO</span>
          </div>
        </div>
      </header>

      {/* Main Stage Arena */}
      <main className="flex-1 flex flex-col items-center justify-center my-8 text-center">
        {phase === 'CHAT' ? (
          <div className="max-w-2xl bg-white/5 border border-white/10 rounded-3xl p-12 backdrop-blur-md shadow-2xl">
            <div className="w-20 h-20 rounded-3xl bg-brand-primary/20 text-brand-primary mx-auto flex items-center justify-center mb-6">
              <Swords size={40} className="text-brand-reward" />
            </div>
            <h2 className="text-4xl font-extrabold mb-3">Aguardando Início da Partida</h2>
            <p className="text-white/60 text-lg font-body max-w-md mx-auto mb-8">
              Inicie um **Modo Debate** ou **Quiz** pelo chat no computador ou celular para ver o palco ao vivo aqui!
            </p>
            <div className="inline-flex items-center gap-3 px-6 py-3 rounded-2xl bg-white/10 border border-white/20 text-brand-reward text-base">
              <Sparkles size={20} />
              <span>Código da Sala: {roomId.slice(0, 8)}</span>
            </div>
          </div>
        ) : (
          <div className="w-full max-w-6xl flex flex-col items-center">
            {/* Countdown Clock */}
            <div className="mb-6 flex flex-col items-center">
              <span className="text-xs font-mono uppercase tracking-widest text-white/50 mb-1">
                Tempo Restante
              </span>
              <div className="text-7xl md:text-8xl font-black font-mono text-brand-reward tracking-tighter drop-shadow-[0_0_35px_rgba(253,203,110,0.5)]">
                {remaining}s
              </div>
              <div className="text-sm font-bold uppercase tracking-wider px-4 py-1 rounded-full bg-white/10 mt-2 text-white/80">
                Fase: {phase}
              </div>
            </div>

            {/* Topic Banner */}
            <div className="w-full bg-white/5 border border-white/10 rounded-3xl p-6 mb-8 backdrop-blur-md shadow-xl">
              <span className="text-xs font-mono uppercase text-brand-reward block mb-1">Tema em Julgamento</span>
              <h2 className="text-2xl md:text-3xl font-extrabold leading-snug">
                "{debateState?.topic || 'Abacaxi na pizza é crime ou alta gastronomia?'}"
              </h2>
            </div>

            {/* Debaters Cards (Side A vs Side B) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
              {/* Side A (Coral) */}
              <div className="bg-gradient-to-b from-brand-action/20 to-brand-action/5 border-2 border-brand-action/40 rounded-3xl p-8 flex flex-col justify-between text-left shadow-2xl relative overflow-hidden">
                <div className="flex items-center justify-between mb-4">
                  <span className="px-3 py-1 rounded-xl bg-brand-action text-white text-xs font-bold uppercase tracking-wider">
                    Lado A
                  </span>
                  <span className="font-mono text-2xl font-black text-brand-action">
                    {debateState?.votes_count?.side_a ?? 0} Votos
                  </span>
                </div>
                <h3 className="text-2xl font-bold mb-4 text-white">
                  {debateState?.debater_a?.nickname || 'Defensor A'}
                </h3>
                <div className="bg-black/30 rounded-2xl p-4 font-body text-sm text-white/90 min-h-[90px] flex items-center">
                  <p>{debateState?.debater_a?.argument || 'Aguardando argumento...'}</p>
                </div>
              </div>

              {/* Side B (Mint) */}
              <div className="bg-gradient-to-b from-brand-mint/20 to-brand-mint/5 border-2 border-brand-mint/40 rounded-3xl p-8 flex flex-col justify-between text-left shadow-2xl relative overflow-hidden">
                <div className="flex items-center justify-between mb-4">
                  <span className="px-3 py-1 rounded-xl bg-brand-mint text-ink-main text-xs font-bold uppercase tracking-wider">
                    Lado B
                  </span>
                  <span className="font-mono text-2xl font-black text-brand-mint">
                    {debateState?.votes_count?.side_b ?? 0} Votos
                  </span>
                </div>
                <h3 className="text-2xl font-bold mb-4 text-white">
                  {debateState?.debater_b?.nickname || 'Defensor B'}
                </h3>
                <div className="bg-black/30 rounded-2xl p-4 font-body text-sm text-white/90 min-h-[90px] flex items-center">
                  <p>{debateState?.debater_b?.argument || 'Aguardando argumento...'}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* TV Bottom Footer */}
      <footer className="border-t border-white/10 pt-4 flex items-center justify-between text-xs text-white/40 font-body">
        <p>PORChat Stage Engine v1.0 • Otimizado para Projetores & TVs 4K</p>
        <p className="flex items-center gap-1">
          <Flame size={14} className="text-brand-action" />
          <span>Audience Reactions Ativas</span>
        </p>
      </footer>
    </div>
  );
}
