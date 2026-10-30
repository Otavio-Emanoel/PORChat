'use client';

import React from 'react';
import Link from 'next/link';
import { Swords, Zap, Tv, Smartphone, Clock, ArrowRight } from 'lucide-react';
import type { GameStateUpdatePayload } from '@/lib/types';

interface InChatGameCardProps {
  roomId: string;
  gameState: GameStateUpdatePayload;
  onEnterJury?: () => void;
}

export function InChatGameCard({ roomId, gameState, onEnterJury }: InChatGameCardProps) {
  const isDebate = gameState.game_type === 'debate';
  const isQuiz = gameState.game_type === 'quiz';

  const debateState = gameState.debate_state;
  const quizState = gameState.quiz_state;

  return (
    <div className="my-3 mx-auto max-w-lg w-full animate-pop-in">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-surface-tv via-[#252538] to-[#1E1E2E] text-white p-5 shadow-xl border-2 border-brand-primary/40">
        {/* Glow corner */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-brand-primary/20 rounded-full blur-2xl pointer-events-none" />

        {/* Header Row */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span
              className={`p-2 rounded-xl text-white ${
                isDebate ? 'bg-brand-action' : 'bg-brand-primary'
              } shadow-xs flex items-center justify-center`}
            >
              {isDebate ? <Swords className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
            </span>
            <div>
              <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-brand-reward">
                {isDebate ? 'Modo Debate Ativo' : 'Quiz Relâmpago Ativo'}
              </span>
              <h3 className="font-heading text-sm font-bold text-white tracking-tight leading-snug">
                {isDebate
                  ? debateState?.topic || 'Abacaxi na pizza é crime ou alta gastronomia?'
                  : quizState?.current_question?.prompt || 'Partida de Quiz em andamento!'}
              </h3>
            </div>
          </div>

          {/* Timer Badge */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-xs border border-white/10 text-brand-reward font-mono font-bold text-xs">
            <Clock className="w-3.5 h-3.5 animate-spin" />
            <span>{gameState.remaining_seconds}s</span>
          </div>
        </div>

        {/* Phase Details */}
        <div className="bg-black/30 rounded-2xl p-3 mb-3 border border-white/5 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="text-gray-400">Fase atual:</span>
            <span className="font-bold text-brand-mint font-mono uppercase tracking-wide">
              {gameState.phase.replace('_', ' ')}
            </span>
          </div>

          {isDebate && debateState && (
            <div className="flex items-center gap-3 text-[11px] font-bold">
              <span className="text-brand-action">Lado A: {debateState.votes_count?.side_a || 0}</span>
              <span className="text-brand-mint">Lado B: {debateState.votes_count?.side_b || 0}</span>
            </div>
          )}

          {isQuiz && quizState && (
            <div className="text-[11px] text-gray-300 font-mono">
              Pergunta {quizState.current_question_index + 1} de {quizState.total_questions}
            </div>
          )}
        </div>

        {/* Quick Action CTAs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {isDebate && gameState.phase === 'VOTING' && onEnterJury && (
            <button
              type="button"
              onClick={onEnterJury}
              className="col-span-2 sm:col-span-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-brand-action hover:bg-brand-action/90 text-white font-bold text-xs shadow-xs tactile-btn transition-all"
            >
              <Swords className="w-3.5 h-3.5" />
              <span>Votar no Júri</span>
            </button>
          )}

          <Link
            href={`/tv/${roomId}`}
            target="_blank"
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white/15 hover:bg-white/20 text-white font-bold text-xs backdrop-blur-xs border border-white/10 transition-all hover:scale-102"
          >
            <Tv className="w-3.5 h-3.5 text-brand-reward" />
            <span>Abrir Telão TV</span>
          </Link>

          <Link
            href={`http://localhost:8082`}
            target="_blank"
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-brand-primary hover:bg-brand-primary/90 text-white font-bold text-xs shadow-xs tactile-btn transition-all hover:scale-102"
          >
            <Smartphone className="w-3.5 h-3.5 text-brand-mint" />
            <span>Controle Mobile</span>
            <ArrowRight className="w-3 h-3 ml-0.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
