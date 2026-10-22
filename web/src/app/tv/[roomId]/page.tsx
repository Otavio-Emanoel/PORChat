'use client';

import React, { useState, useEffect } from 'react';
import { useWebSocket } from '@/lib/useWebSocket';
import { Flame, Sparkles, Trophy, Users, Swords, Crown, Zap, CheckCircle2 } from 'lucide-react';

interface Particle {
  id: number;
  emoji: string;
  left: number;
  size: number;
}

const QUIZ_OPTION_COLORS: Record<'A' | 'B' | 'C' | 'D', { bg: string; border: string; text: string }> = {
  A: { bg: 'bg-[#FF6B6B]/20', border: 'border-[#FF6B6B]', text: 'text-[#FF6B6B]' },
  B: { bg: 'bg-[#48DBFB]/20', border: 'border-[#48DBFB]', text: 'text-[#48DBFB]' },
  C: { bg: 'bg-[#FECA57]/20', border: 'border-[#FECA57]', text: 'text-[#FECA57]' },
  D: { bg: 'bg-[#1DD1A1]/20', border: 'border-[#1DD1A1]', text: 'text-[#1DD1A1]' },
};

export default function TVModePage({ params }: { params: { roomId: string } }) {
  const { roomId } = params;
  const [particles, setParticles] = useState<Particle[]>([]);

  const { onlineUsers, gameState } = useWebSocket({
    roomId,
    nickname: 'TV_Stage_Display',
    clientType: 'tv',
  });

  const isQuiz = gameState?.game_type === 'quiz';
  const debateState = gameState?.debate_state;
  const quizState = gameState?.quiz_state;
  const phase = gameState?.phase || 'CHAT';
  const remaining = gameState?.remaining_seconds ?? 0;

  // Debate stats
  const sideAVotes = debateState?.votes_count?.side_a ?? 0;
  const sideBVotes = debateState?.votes_count?.side_b ?? 0;
  const totalVotes = sideAVotes + sideBVotes;
  const sideAPercent = totalVotes > 0 ? Math.round((sideAVotes / totalVotes) * 100) : 50;
  const sideBPercent = totalVotes > 0 ? 100 - sideAPercent : 50;

  // Listen to incoming emoji reactions and spawn floating particles
  useEffect(() => {
    const handleReaction = (emoji: string) => {
      const id = Date.now() + Math.random();
      const left = Math.floor(Math.random() * 85) + 5;
      const size = Math.floor(Math.random() * 24) + 36;
      setParticles((prev) => [...prev.slice(-25), { id, emoji, left, size }]);
      setTimeout(() => {
        setParticles((prev) => prev.filter((p) => p.id !== id));
      }, 3500);
    };

    // Auto generate celebratory particles during RESULTS / FINAL_RESULTS
    if (phase === 'RESULTS' || phase === 'FINAL_RESULTS') {
      const interval = setInterval(() => {
        handleReaction('🎉');
        handleReaction('👑');
        handleReaction('⭐');
      }, 400);
      return () => clearInterval(interval);
    }
  }, [phase]);

  return (
    <div className="min-h-screen bg-surface-tv text-white flex flex-col justify-between p-6 md:p-12 font-heading overflow-hidden relative select-none">
      {/* Floating Reaction Particles */}
      <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden">
        {particles.map((p) => (
          <div
            key={p.id}
            className="absolute bottom-6 animate-float-up transition-transform ease-out"
            style={{
              left: `${p.left}%`,
              fontSize: `${p.size}px`,
              animation: 'floatUp 3.2s cubic-bezier(0.1, 0.8, 0.3, 1) forwards',
            }}
          >
            {p.emoji}
          </div>
        ))}
      </div>

      {/* Top Header Bar */}
      <header className="flex items-center justify-between border-b border-white/10 pb-5 z-10">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-3xl bg-brand-primary flex items-center justify-center text-white text-3xl font-black shadow-xl shadow-brand-primary/40">
            P
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-2">
              <span>PORChat Arena</span>
              <span className="text-xs font-mono px-3 py-1 bg-brand-reward/20 text-brand-reward rounded-full border border-brand-reward/30">
                TV MODE
              </span>
            </h1>
            <p className="text-xs text-white/50 font-body">Segundo ecrã sincronizado para auditório e plateia</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/5 border border-white/10 text-sm">
            <Users size={18} className="text-brand-mint" />
            <span className="font-bold">{onlineUsers.length} Participantes</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-brand-mint/15 text-brand-mint text-sm font-bold border border-brand-mint/20">
            <span className="w-2.5 h-2.5 rounded-full bg-brand-mint animate-ping" />
            <span>AO VIVO</span>
          </div>
        </div>
      </header>

      {/* Main TV Stage Area */}
      <main className="flex-1 flex flex-col items-center justify-center my-6 z-10">
        {phase === 'CHAT' ? (
          <div className="max-w-2xl bg-white/5 border border-white/10 rounded-3xl p-12 backdrop-blur-md shadow-2xl text-center">
            <div className="w-24 h-24 rounded-3xl bg-brand-primary/20 text-brand-primary mx-auto flex items-center justify-center mb-6">
              <Swords size={48} className="text-brand-reward animate-pulse" />
            </div>
            <h2 className="text-4xl md:text-5xl font-black mb-4">Aguardando Início da Partida</h2>
            <p className="text-white/60 text-lg font-body max-w-md mx-auto mb-8">
              Inicie o **Modo Debate** ou o **Quiz Relâmpago** pelo chat no computador ou celular para transmitir para esta tela!
            </p>
            <div className="inline-flex items-center gap-3 px-6 py-3.5 rounded-2xl bg-white/10 border border-white/20 text-brand-reward text-lg">
              <Sparkles size={22} />
              <span>Código da Sala: {roomId.slice(0, 8).toUpperCase()}</span>
            </div>
          </div>
        ) : isQuiz ? (
          /* ==================================================================== */
          /* ======================== TRIVIA QUIZ STAGE ========================= */
          /* ==================================================================== */
          <div className="w-full max-w-6xl flex flex-col items-center">
            {/* Clock & Phase Banner */}
            <div className="flex flex-col items-center mb-6">
              <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-reward/20 border border-brand-reward/30 text-brand-reward text-sm font-bold uppercase tracking-wider mb-2">
                <Zap size={16} />
                <span>QUIZ RELÂMPAGO • {phase}</span>
              </div>
              <div className="text-7xl md:text-9xl font-black font-mono text-brand-reward tracking-tighter drop-shadow-[0_0_40px_rgba(253,203,110,0.6)]">
                {remaining}s
              </div>
            </div>

            {/* Quiz Views based on Phase */}
            {phase === 'LOBBY' && (
              <div className="w-full max-w-3xl bg-white/5 border border-white/10 rounded-3xl p-10 backdrop-blur-md shadow-2xl text-center">
                <h2 className="text-3xl md:text-5xl font-black mb-4 text-brand-reward">
                  ⚡ Preparem seus Celulares!
                </h2>
                <p className="text-lg text-white/80 font-body">
                  O Quiz Relâmpago vai começar em {remaining} segundos! Quanto mais rápido você responder corretamente, mais pontos acumulará.
                </p>
              </div>
            )}

            {(phase === 'QUESTION' || phase === 'REVEAL') && (
              <div className="w-full space-y-6">
                {/* Question Prompt Card */}
                <div className="w-full bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-md shadow-2xl text-center">
                  <span className="text-xs font-mono uppercase text-brand-reward tracking-widest block mb-2">
                    Pergunta {(quizState?.current_question_index ?? 0) + 1} de {quizState?.total_questions ?? 3}
                  </span>
                  <h2 className="text-2xl md:text-4xl font-black leading-snug">
                    "{quizState?.current_question?.prompt || 'Carregando pergunta...'}"
                  </h2>
                </div>

                {/* 4 Colored Options Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
                  {(['A', 'B', 'C', 'D'] as const).map((opt) => {
                    const optionText = quizState?.current_question?.options?.[opt] || '';
                    const isCorrect = phase === 'REVEAL' && quizState?.correct_option === opt;
                    const answersCount = quizState?.answers_distribution?.[opt] ?? 0;
                    const colorScheme = QUIZ_OPTION_COLORS[opt];

                    return (
                      <div
                        key={opt}
                        className={`rounded-3xl p-6 flex items-center justify-between border-2 transition-all duration-300 shadow-xl ${
                          isCorrect
                            ? 'bg-emerald-500/30 border-emerald-400 scale-[1.02] shadow-emerald-500/30'
                            : phase === 'REVEAL'
                            ? 'opacity-40 bg-white/5 border-white/10'
                            : `${colorScheme.bg} ${colorScheme.border}`
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl border-2 ${
                              isCorrect
                                ? 'bg-emerald-400 text-ink-main border-emerald-300'
                                : `${colorScheme.border} ${colorScheme.text} bg-black/20`
                            }`}
                          >
                            {opt}
                          </div>
                          <span className="text-xl md:text-2xl font-bold text-white">
                            {optionText}
                          </span>
                        </div>

                        {phase === 'REVEAL' && (
                          <div className="flex items-center gap-2">
                            {isCorrect && <CheckCircle2 size={24} className="text-emerald-400" />}
                            <span className="font-mono text-lg font-bold text-white/80">
                              {answersCount} {answersCount === 1 ? 'voto' : 'votos'}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {phase === 'LEADERBOARD' && (
              <div className="w-full max-w-3xl bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-md shadow-2xl">
                <h3 className="text-2xl md:text-3xl font-black text-brand-reward mb-6 text-center">
                  📊 Placar da Rodada
                </h3>
                <div className="space-y-3">
                  {(quizState?.leaderboard || []).slice(0, 5).map((entry, idx) => (
                    <div
                      key={entry.user_id}
                      className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/10"
                    >
                      <div className="flex items-center gap-4">
                        <span className="w-8 h-8 rounded-xl bg-brand-primary/30 flex items-center justify-center font-mono font-bold text-brand-reward">
                          #{idx + 1}
                        </span>
                        <span className="text-xl font-bold text-white">{entry.nickname}</span>
                      </div>
                      <div className="flex items-center gap-4 font-mono">
                        <span className="text-emerald-400 font-bold">+{entry.round_score} pts</span>
                        <span className="text-2xl font-black text-brand-reward">{entry.total_score} pts</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {phase === 'FINAL_RESULTS' && (
              <div className="w-full max-w-3xl bg-gradient-to-b from-brand-reward/25 to-brand-reward/5 border-2 border-brand-reward/50 rounded-3xl p-10 backdrop-blur-lg shadow-2xl text-center">
                <div className="w-24 h-24 rounded-full bg-brand-reward/20 mx-auto flex items-center justify-center mb-4">
                  <Crown size={52} className="text-brand-reward" />
                </div>
                <h3 className="text-4xl md:text-5xl font-black text-brand-reward mb-2">
                  🏆 CAMPEÃO DO QUIZ!
                </h3>
                <p className="text-2xl font-bold text-white mb-6">
                  {quizState?.leaderboard?.[0]?.nickname || 'Vencedor'} venceu com{' '}
                  <span className="text-brand-reward font-mono">
                    {quizState?.leaderboard?.[0]?.total_score ?? 0} pontos!
                  </span>
                </p>
                <div className="space-y-2 max-w-md mx-auto">
                  {(quizState?.leaderboard || []).slice(0, 3).map((entry, idx) => (
                    <div key={entry.user_id} className="flex justify-between items-center py-2 px-4 rounded-xl bg-black/30 font-mono">
                      <span>#{idx + 1} {entry.nickname}</span>
                      <span className="text-brand-reward font-bold">{entry.total_score} pts</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ==================================================================== */
          /* ======================== DEBATE COURT STAGE ======================== */
          /* ==================================================================== */
          <div className="w-full max-w-6xl flex flex-col items-center">
            {/* Clock & Phase Banner */}
            <div className="flex flex-col items-center mb-6">
              <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/15 text-brand-reward text-sm font-bold uppercase tracking-wider mb-2">
                <span>FASE: {phase}</span>
              </div>
              <div className="text-7xl md:text-9xl font-black font-mono text-brand-reward tracking-tighter drop-shadow-[0_0_40px_rgba(253,203,110,0.6)]">
                {remaining}s
              </div>
            </div>

            {/* Topic Card */}
            <div className="w-full bg-white/5 border border-white/10 rounded-3xl p-6 mb-8 backdrop-blur-md shadow-2xl text-center">
              <span className="text-xs font-mono uppercase text-brand-reward tracking-widest block mb-1">
                ⚖️ TEMA DO TRIBUNAL
              </span>
              <h2 className="text-2xl md:text-4xl font-black leading-snug">
                "{debateState?.topic || 'Abacaxi na pizza é crime ou alta gastronomia?'}"
              </h2>
            </div>

            {/* Debaters Cards or Results Celebration */}
            {phase === 'RESULTS' ? (
              <div className="w-full max-w-3xl bg-gradient-to-b from-brand-reward/20 to-brand-reward/5 border-2 border-brand-reward/50 rounded-3xl p-10 backdrop-blur-lg shadow-2xl text-center">
                <div className="w-24 h-24 rounded-full bg-brand-reward/20 mx-auto flex items-center justify-center mb-4">
                  <Crown size={52} className="text-brand-reward" />
                </div>
                <h3 className="text-4xl md:text-5xl font-black text-brand-reward mb-2">
                  {debateState?.winner_side === 'side_a'
                    ? '🎉 LADO A É O VENCEDOR!'
                    : debateState?.winner_side === 'side_b'
                    ? '🎉 LADO B É O VENCEDOR!'
                    : '🤝 EMPATE HISTÓRICO!'}
                </h3>
                <p className="text-white/80 font-body text-lg mb-6">
                  {debateState?.winner_side === 'side_a'
                    ? `${debateState.debater_a.nickname} convenceu a maioria dos jurados!`
                    : debateState?.winner_side === 'side_b'
                    ? `${debateState.debater_b.nickname} convenceu a maioria dos jurados!`
                    : 'O júri se dividiu igualmente entre os dois argumentos!'}
                </p>
                <div className="flex justify-center items-center gap-8 text-2xl font-mono font-bold">
                  <span className="text-brand-action">Lado A: {sideAVotes} votos</span>
                  <span className="text-white/30">•</span>
                  <span className="text-brand-mint">Lado B: {sideBVotes} votos</span>
                </div>
              </div>
            ) : (
              <div className="w-full space-y-6">
                {/* Realtime Voting Split Bar */}
                {phase === 'VOTING' && (
                  <div className="w-full space-y-2">
                    <div className="flex justify-between font-mono font-bold text-sm px-1">
                      <span className="text-brand-action">Lado A ({sideAPercent}%)</span>
                      <span className="text-white/60">{totalVotes} votos totais</span>
                      <span className="text-brand-mint">Lado B ({sideBPercent}%)</span>
                    </div>
                    <div className="w-full h-5 rounded-full overflow-hidden flex bg-white/10 p-0.5 border border-white/10 shadow-inner">
                      <div
                        className="bg-brand-action h-full transition-all duration-300 rounded-l-full"
                        style={{ width: `${sideAPercent}%` }}
                      />
                      <div
                        className="bg-brand-mint h-full transition-all duration-300 rounded-r-full"
                        style={{ width: `${sideBPercent}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Debater A & B Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
                  {/* Side A Card (Coral) */}
                  <div
                    className={`rounded-3xl p-8 flex flex-col justify-between text-left shadow-2xl relative overflow-hidden transition-all duration-300 ${
                      phase === 'OPENING_ARGUMENTS'
                        ? 'bg-brand-action/25 border-4 border-brand-action shadow-brand-action/30'
                        : 'bg-brand-action/10 border-2 border-brand-action/30'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <span className="px-3.5 py-1.5 rounded-xl bg-brand-action text-white text-xs font-black uppercase tracking-wider shadow-sm">
                          LADO A
                        </span>
                        <span className="font-mono text-2xl font-black text-brand-action">
                          {sideAVotes} {sideAVotes === 1 ? 'Voto' : 'Votos'}
                        </span>
                      </div>
                      <h3 className="text-2xl md:text-3xl font-black text-white mb-4">
                        {debateState?.debater_a?.nickname || 'Defensor A'}
                      </h3>
                    </div>
                    <div className="bg-black/40 rounded-2xl p-5 font-body text-base text-white/90 min-h-[120px] flex items-center border border-white/5">
                      <p className="leading-relaxed italic">
                        {debateState?.debater_a?.argument
                          ? `"${debateState.debater_a.argument}"`
                          : 'Aguardando o envio da tese de defesa...'}
                      </p>
                    </div>
                  </div>

                  {/* Side B Card (Mint) */}
                  <div
                    className={`rounded-3xl p-8 flex flex-col justify-between text-left shadow-2xl relative overflow-hidden transition-all duration-300 ${
                      phase === 'REBUTTAL'
                        ? 'bg-brand-mint/25 border-4 border-brand-mint shadow-brand-mint/30'
                        : 'bg-brand-mint/10 border-2 border-brand-mint/30'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <span className="px-3.5 py-1.5 rounded-xl bg-brand-mint text-ink-main text-xs font-black uppercase tracking-wider shadow-sm">
                          LADO B
                        </span>
                        <span className="font-mono text-2xl font-black text-brand-mint">
                          {sideBVotes} {sideBVotes === 1 ? 'Voto' : 'Votos'}
                        </span>
                      </div>
                      <h3 className="text-2xl md:text-3xl font-black text-white mb-4">
                        {debateState?.debater_b?.nickname || 'Defensor B'}
                      </h3>
                    </div>
                    <div className="bg-black/40 rounded-2xl p-5 font-body text-base text-white/90 min-h-[120px] flex items-center border border-white/5">
                      <p className="leading-relaxed italic">
                        {debateState?.debater_b?.argument
                          ? `"${debateState.debater_b.argument}"`
                          : 'Aguardando o envio da tese de defesa...'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer Info */}
      <footer className="border-t border-white/10 pt-4 flex items-center justify-between text-xs text-white/50 font-body z-10">
        <p>PORChat Stage Engine v1.0 • Otimizado para Projetores & TVs 4K</p>
        <p className="flex items-center gap-1.5 font-semibold text-brand-reward">
          <Flame size={16} className="text-brand-action" />
          <span>Plateia Interativa: Use o celular para votar e reagir!</span>
        </p>
      </footer>
    </div>
  );
}
