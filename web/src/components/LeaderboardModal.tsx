'use client';

import React, { useEffect, useState } from 'react';
import { X, Trophy, History, Award, Target, Flame, Scale, Zap } from 'lucide-react';
import type { RoomLeaderboardEntry, MatchHistoryRecord } from '@/lib/types';
import { fetchRoomLeaderboard, fetchRoomMatchHistory } from '@/lib/apiClient';

interface LeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  roomName: string;
}

export default function LeaderboardModal({
  isOpen,
  onClose,
  roomId,
  roomName,
}: LeaderboardModalProps) {
  const [tab, setTab] = useState<'ranking' | 'history'>('ranking');
  const [leaderboard, setLeaderboard] = useState<RoomLeaderboardEntry[]>([]);
  const [history, setHistory] = useState<MatchHistoryRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !roomId) return;
    setLoading(true);
    Promise.all([fetchRoomLeaderboard(roomId), fetchRoomMatchHistory(roomId)])
      .then(([board, hist]) => {
        setLeaderboard(board || []);
        setHistory(hist || []);
      })
      .finally(() => setLoading(false));
  }, [isOpen, roomId]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Ranking e Histórico da Sala"
    >
      <div className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-800 bg-[#161925] text-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#FDCB6E]/20 text-[#FDCB6E]">
              <Trophy className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-heading text-lg font-bold">Ranking & Histórico de Partidas</h2>
              <p className="text-xs text-slate-400">{roomName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-2 gap-3 border-b border-slate-800 bg-[#11131D] px-6 py-3">
          <button
            type="button"
            onClick={() => setTab('ranking')}
            className={`flex items-center justify-center gap-2 rounded-2xl py-2.5 text-sm font-bold transition ${
              tab === 'ranking'
                ? 'bg-[#FDCB6E] text-slate-950'
                : 'bg-slate-900 text-slate-400 hover:text-white'
            }`}
          >
            <Trophy className="h-4 w-4" />
            Classificação Geral ({leaderboard.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('history')}
            className={`flex items-center justify-center gap-2 rounded-2xl py-2.5 text-sm font-bold transition ${
              tab === 'history'
                ? 'bg-[#6C5CE7] text-white'
                : 'bg-slate-900 text-slate-400 hover:text-white'
            }`}
          >
            <History className="h-4 w-4" />
            Histórico de Partidas ({history.length})
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="py-12 text-center text-sm text-slate-400">
              Carregando estatísticas da sala...
            </div>
          ) : tab === 'ranking' ? (
            leaderboard.length === 0 ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-8 text-center text-sm text-slate-400">
                Nenhuma partida registrada ainda nesta sala. Inicie um Modo Debate ou Quiz Relâmpago para inaugurar o placar!
              </div>
            ) : (
              <div className="space-y-3">
                {leaderboard.map((entry) => {
                  const isTop1 = entry.rank === 1;
                  const isTop2 = entry.rank === 2;
                  const isTop3 = entry.rank === 3;
                  return (
                    <div
                      key={entry.user_id || entry.nickname}
                      className={`flex items-center justify-between rounded-2xl border p-4 transition ${
                        isTop1
                          ? 'border-[#FDCB6E]/50 bg-[#FDCB6E]/10'
                          : isTop2
                          ? 'border-slate-500/40 bg-slate-800/60'
                          : isTop3
                          ? 'border-amber-700/40 bg-amber-950/20'
                          : 'border-slate-800 bg-slate-900/50'
                      }`}
                    >
                      <div className="flex items-center gap-3.5">
                        <div
                          className={`flex h-9 w-9 items-center justify-center rounded-xl text-sm font-extrabold ${
                            isTop1
                              ? 'bg-[#FDCB6E] text-slate-950'
                              : isTop2
                              ? 'bg-slate-300 text-slate-950'
                              : isTop3
                              ? 'bg-amber-600 text-white'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          #{entry.rank}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-heading text-base font-bold text-white">
                              {entry.nickname}
                            </span>
                            {isTop1 && (
                              <span className="rounded-lg bg-[#FDCB6E]/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#FDCB6E]">
                                Líder da Sala
                              </span>
                            )}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                            <span className="flex items-center gap-1">
                              <Scale className="h-3 w-3 text-[#FF7675]" />
                              {entry.debates_won} vitórias no Tribunal
                            </span>
                            <span className="flex items-center gap-1">
                              <Zap className="h-3 w-3 text-[#6C5CE7]" />
                              {entry.quiz_wins} vitórias no Quiz
                            </span>
                            <span className="flex items-center gap-1">
                              <Target className="h-3 w-3 text-[#00CEC9]" />
                              {entry.accuracy_percent}% precisão
                            </span>
                            {entry.best_streak > 0 && (
                              <span className="flex items-center gap-1 text-[#FDCB6E]">
                                <Flame className="h-3 w-3" />
                                Streak {entry.best_streak}x
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="font-heading text-lg font-extrabold text-[#FDCB6E]">
                          {entry.total_points.toLocaleString('pt-BR')} pts
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {entry.matches_played} partidas
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : history.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-8 text-center text-sm text-slate-400">
              Nenhuma partida concluída ainda nesta sala.
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((rec) => (
                <div
                  key={rec.id}
                  className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-xl ${
                          rec.game_type === 'debate'
                            ? 'bg-[#FF7675]/20 text-[#FF7675]'
                            : 'bg-[#6C5CE7]/20 text-[#6C5CE7]'
                        }`}
                      >
                        {rec.game_type === 'debate' ? (
                          <Scale className="h-4 w-4" />
                        ) : (
                          <Zap className="h-4 w-4" />
                        )}
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          {rec.game_type === 'debate' ? 'Modo Debate' : 'Quiz Relâmpago'} • {rec.category}
                        </span>
                        <h3 className="font-heading text-sm font-bold text-white">{rec.title}</h3>
                      </div>
                    </div>
                    <span className="flex items-center gap-1 rounded-xl bg-[#FDCB6E]/15 px-2.5 py-1 text-xs font-bold text-[#FDCB6E]">
                      <Award className="h-3.5 w-3.5" />
                      {rec.winner_nickname}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-300">{rec.summary}</p>
                  {rec.top_scores && rec.top_scores.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {rec.top_scores.map((sc, idx) => (
                        <span
                          key={`${rec.id}-${sc.nickname}-${idx}`}
                          className="rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1 text-[11px] text-slate-300"
                        >
                          {idx + 1}º {sc.nickname}:{' '}
                          <strong className="text-white">{sc.score} pts</strong>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
