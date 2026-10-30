'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useWebSocket } from '@/lib/useWebSocket';
import { soundEffects } from '@/lib/soundEffects';
import { launchConfetti } from '@/lib/confetti';
import { QRCodeDisplay } from '@/components/QRCodeDisplay';
import {
  Flame,
  Trophy,
  Users,
  Swords,
  Crown,
  Zap,
  CheckCircle2,
  Share2,
  Copy,
  Check,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Smartphone,
  Award,
  Clock,
  Tv,
} from 'lucide-react';

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
  const [volume, setVolume] = useState(80);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [originUrl, setOriginUrl] = useState('');
  const [currentTime, setCurrentTime] = useState('');

  // Update live stage clock
  useEffect(() => {
    const updateClock = () => {
      const d = new Date();
      setCurrentTime(d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const prevPhaseRef = useRef<string>('');

  const { onlineUsers, gameState, sendAction } = useWebSocket({
    roomId,
    nickname: 'TV_Stage_Display',
    clientType: 'tv',
  });

  const isQuiz = gameState?.game_type === 'quiz';
  const debateState = gameState?.debate_state;
  const quizState = gameState?.quiz_state;
  const phase = gameState?.phase || 'CHAT';
  const remaining = gameState?.remaining_seconds ?? 0;

  // Set Origin on Client
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOriginUrl(`${window.location.origin}/room/${roomId}`);
    }
  }, [roomId]);

  // Debate stats
  const sideAVotes = debateState?.votes_count?.side_a ?? 0;
  const sideBVotes = debateState?.votes_count?.side_b ?? 0;
  const totalVotes = sideAVotes + sideBVotes;
  const sideAPercent = totalVotes > 0 ? Math.round((sideAVotes / totalVotes) * 100) : 50;
  const sideBPercent = totalVotes > 0 ? 100 - sideAPercent : 50;

  // Copy Stage Invitation Link
  const handleCopyLink = () => {
    const link = originUrl || (typeof window !== 'undefined' ? `${window.location.origin}/room/${roomId}` : '');
    if (link && navigator.clipboard) {
      navigator.clipboard.writeText(link);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  // TV Volume & Mute control (Item 24)
  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    soundEffects.setVolume(newVol / 100);
    setIsMuted(newVol === 0);
  };

  const handleToggleMute = () => {
    if (isMuted) {
      soundEffects.setVolume(volume > 0 ? volume / 100 : 0.8);
      setIsMuted(false);
      if (volume === 0) setVolume(80);
    } else {
      soundEffects.setVolume(0);
      setIsMuted(true);
    }
  };

  // Toggle Fullscreen
  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Reaction burst particle animation (Item 25)
  const triggerReactionBurst = (count: number = 18) => {
    const symbols = ['+', '★', '●', '▲', '◆'];
    const newParticles: Particle[] = [];
    for (let i = 0; i < count; i++) {
      newParticles.push({
        id: Date.now() + Math.random(),
        emoji: symbols[Math.floor(Math.random() * symbols.length)],
        left: Math.floor(Math.random() * 88) + 6,
        size: Math.floor(Math.random() * 26) + 34,
      });
    }
    setParticles((prev) => [...prev, ...newParticles]);
  };

  // Audio & Confetti Triggers on Phase Transitions
  useEffect(() => {
    if (prevPhaseRef.current !== phase) {
      if (phase === 'OPENING_ARGUMENTS' || phase === 'LOBBY') {
        soundEffects.playGong();
      } else if (phase === 'RESULTS' || phase === 'FINAL_RESULTS') {
        soundEffects.playFanfare();
        launchConfetti(canvasRef.current, 5000);
        triggerReactionBurst(24);
      }
      prevPhaseRef.current = phase;
    }
  }, [phase]);

  // Countdown Audio Ticking (Item 14)
  useEffect(() => {
    if (remaining <= 5 && remaining > 0 && (phase === 'QUESTION' || phase === 'VOTING' || phase === 'REBUTTAL')) {
      soundEffects.playTick();
    }
  }, [remaining, phase]);

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

    if (phase === 'RESULTS' || phase === 'FINAL_RESULTS') {
      const interval = setInterval(() => {
        handleReaction('Voto Registrado');
      }, 800);
      return () => clearInterval(interval);
    }
  }, [phase]);

  return (
    <div className="min-h-screen bg-surface-tv text-white flex flex-col justify-between p-4 sm:p-8 md:p-10 font-heading overflow-hidden relative select-none">
      {/* Canvas Confetti Layer (Item 17) */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 pointer-events-none z-50 w-full h-full"
      />

      {/* Floating Reaction Particles */}
      <div className="absolute inset-0 pointer-events-none z-40 overflow-hidden">
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
      <header className="flex items-center justify-between border-b border-white/10 pb-4 z-10">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 md:w-14 md:h-14 rounded-3xl bg-brand-primary flex items-center justify-center text-white text-2xl md:text-3xl font-black shadow-xl shadow-brand-primary/40">
            P
          </div>
          <div>
            <h1 className="text-xl md:text-3xl font-black tracking-tight flex items-center gap-2">
              <span>PORChat Arena</span>
              <span className="text-[11px] font-mono px-2.5 py-0.5 bg-brand-reward/20 text-brand-reward rounded-full border border-brand-reward/30">
                TV MODE
              </span>
            </h1>
            <p className="text-xs text-white/50 font-body">Telão cinematográfico sincronizado em tempo real</p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Live Stage Clock */}
          {currentTime && (
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-white/10 border border-white/10 text-xs font-mono text-white/80">
              <Clock size={13} className="text-brand-reward" />
              <span>{currentTime}</span>
            </div>
          )}

          {/* TV Volume Slider Control (Item 24) */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-white/10 border border-white/10">
            <button
              onClick={handleToggleMute}
              className="p-1 text-white hover:text-brand-reward transition-colors tactile-btn"
              title={isMuted || volume === 0 ? 'Desmutar Áudio' : 'Mutar Áudio'}
            >
              {isMuted || volume === 0 ? (
                <VolumeX size={18} className="text-red-400" />
              ) : (
                <Volume2 size={18} className="text-brand-reward" />
              )}
            </button>
            <input
              type="range"
              min="0"
              max="100"
              value={isMuted ? 0 : volume}
              onChange={(e) => handleVolumeChange(Number(e.target.value))}
              className="w-14 sm:w-20 accent-brand-reward h-1.5 bg-white/20 rounded-lg cursor-pointer"
              title={`Volume: ${isMuted ? 0 : volume}%`}
            />
            <span className="font-mono text-[10px] text-white/70 w-6 text-right">
              {isMuted ? '0%' : `${volume}%`}
            </span>
          </div>

          {/* Fullscreen API Toggle (Item 18) */}
          <button
            onClick={handleToggleFullscreen}
            className="p-2.5 rounded-2xl bg-white/10 hover:bg-white/15 text-white transition-all tactile-btn"
            title={isFullscreen ? 'Sair da Tela Cheia' : 'Modo Tela Cheia (TV/Projetor)'}
          >
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>

          {/* Share/Copy Room Link Button */}
          <button
            onClick={handleCopyLink}
            className={`hidden sm:flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs font-bold transition-all tactile-btn ${
              copiedLink
                ? 'bg-brand-mint text-ink-main shadow-lg shadow-brand-mint/20'
                : 'bg-white/10 hover:bg-white/15 text-white border border-white/10'
            }`}
          >
            {copiedLink ? <Check size={16} /> : <Share2 size={16} />}
            <span>{copiedLink ? 'Link Copiado!' : 'Compartilhar'}</span>
          </button>

          {/* Connected Jurors / Audience Spectator Counter (Item 25) */}
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-white/10 border border-white/15 text-xs sm:text-sm text-white shadow-inner">
            <Users size={16} className="text-brand-mint animate-pulse" />
            <span className="font-bold">{onlineUsers.length}</span>
            <span className="text-[10px] uppercase font-mono text-white/60 hidden md:inline">
              {onlineUsers.length === 1 ? 'espectador' : 'espectadores'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-brand-mint/15 text-brand-mint text-xs font-bold border border-brand-mint/20">
            <span className="w-2 h-2 rounded-full bg-brand-mint animate-ping" />
            <span className="hidden sm:inline">AO VIVO</span>
          </div>
        </div>
      </header>

      {/* Main TV Stage Area */}
      <main className="flex-1 flex flex-col items-center justify-center my-4 sm:my-6 z-10 w-full max-w-6xl mx-auto">
        {phase === 'CHAT' ? (
          /* ==================================================================== */
          /* ======================== TV LOBBY & QR CODE ======================== */
          /* ==================================================================== */
          <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-8 items-center bg-white/5 border border-white/10 rounded-3xl p-8 md:p-12 backdrop-blur-md shadow-2xl">
            {/* Left: Instructions */}
            <div className="text-left space-y-4">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-brand-reward/20 text-brand-reward text-xs font-bold uppercase tracking-wider">
                <Tv size={14} />
                <span>Palco Aberto • Aguardando Início</span>
              </div>
              <h2 className="text-3xl md:text-5xl font-black leading-tight text-white">
                Entre no Jogo pelo Celular!
              </h2>
              <p className="text-white/60 text-sm md:text-base font-body leading-relaxed">
                Aponte a câmera para o QR Code ou digite o código da sala no seu celular para participar como debatedor, responder ao quiz e votar no júri em tempo real!
              </p>
              <div className="pt-2 flex flex-wrap gap-3">
                <button
                  onClick={handleCopyLink}
                  className="px-4 py-2.5 rounded-2xl bg-brand-primary text-white text-xs font-bold flex items-center gap-2 tactile-btn hover:brightness-110 shadow-lg shadow-brand-primary/30"
                >
                  {copiedLink ? <Check size={16} /> : <Copy size={16} />}
                  <span>{copiedLink ? 'Link do Telão Copiado!' : 'Copiar Link de Entrada'}</span>
                </button>
              </div>
            </div>

            {/* Right: Dynamic QR Code Display (Item 13) */}
            <div className="flex justify-center">
              <QRCodeDisplay
                roomCode={roomId.slice(0, 8).toUpperCase()}
                url={originUrl || `http://localhost:3001/room/${roomId}`}
                size={180}
              />
            </div>
          </div>
        ) : isQuiz ? (
          /* ==================================================================== */
          /* ======================== TRIVIA QUIZ STAGE ========================= */
          /* ==================================================================== */
          <div className="w-full flex flex-col items-center">
            {/* Clock & Phase Banner */}
            <div className="flex flex-col items-center mb-6">
              <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-reward/20 border border-brand-reward/30 text-brand-reward text-xs sm:text-sm font-bold uppercase tracking-wider mb-4">
                <Zap size={16} />
                <span>QUIZ RELÂMPAGO • {phase.replace('_', ' ')}</span>
              </div>
              {/* Circular Countdown Timer Ring (Item 64) */}
              <div className="relative w-28 h-28 sm:w-36 sm:h-36 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90 drop-shadow-[0_0_20px_rgba(253,203,110,0.4)]" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    stroke="currentColor"
                    strokeWidth="7"
                    className="text-white/10"
                    fill="transparent"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    stroke={remaining > 5 ? '#00CEC9' : remaining > 2 ? '#FDCB6E' : '#FF7675'}
                    strokeWidth="7"
                    strokeDasharray={264}
                    strokeDashoffset={264 - (264 * Math.max(0, Math.min(15, remaining))) / 15}
                    strokeLinecap="round"
                    className="transition-all duration-1000 ease-linear"
                    fill="transparent"
                  />
                </svg>
                <div className="absolute flex flex-col items-center justify-center">
                  <span className={`text-3xl sm:text-4xl font-black font-mono tracking-tighter ${
                    remaining <= 3 ? 'text-brand-action animate-ping' : 'text-brand-reward'
                  }`}>
                    {remaining}s
                  </span>
                </div>
              </div>
            </div>

            {/* Quiz Views based on Phase */}
            {phase === 'LOBBY' && (
              <div className="w-full max-w-3xl bg-white/5 border border-white/10 rounded-3xl p-8 md:p-10 backdrop-blur-md shadow-2xl text-center">
                <h2 className="text-2xl sm:text-4xl md:text-5xl font-black mb-3 text-brand-reward">
                  Preparem seus Celulares!
                </h2>
                <p className="text-base sm:text-lg text-white/80 font-body">
                  O Quiz Relâmpago vai começar em {remaining} segundos! Quanto mais rápido você responder corretamente, mais pontos acumulará com multiplicadores de streak!
                </p>
              </div>
            )}

            {(phase === 'QUESTION' || phase === 'REVEAL') && (
              <div className="w-full space-y-6">
                {/* Question Prompt Card */}
                <div className="w-full bg-white/5 border border-white/10 rounded-3xl p-6 sm:p-8 backdrop-blur-md shadow-2xl text-center">
                  <span className="text-xs font-mono uppercase text-brand-reward tracking-widest block mb-2">
                    Pergunta {(quizState?.current_question_index ?? 0) + 1} de {quizState?.total_questions ?? 5}
                  </span>
                  <h2 className="text-xl sm:text-3xl md:text-4xl font-black leading-snug">
                    "{quizState?.current_question?.prompt || 'Carregando pergunta...'}"
                  </h2>
                </div>

                {/* 4 Colored Options Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 w-full">
                  {(['A', 'B', 'C', 'D'] as const).map((opt) => {
                    const optionText = quizState?.current_question?.options?.[opt] || '';
                    const isCorrect = phase === 'REVEAL' && quizState?.correct_option === opt;
                    const answersCount = quizState?.answers_distribution?.[opt] ?? 0;
                    const colorScheme = QUIZ_OPTION_COLORS[opt];

                    return (
                      <div
                        key={opt}
                        className={`rounded-3xl p-5 sm:p-6 flex items-center justify-between border-2 transition-all duration-300 shadow-xl ${
                          isCorrect
                            ? 'bg-emerald-500/30 border-emerald-400 scale-[1.02] shadow-emerald-500/30'
                            : phase === 'REVEAL'
                            ? 'opacity-40 bg-white/5 border-white/10'
                            : `${colorScheme.bg} ${colorScheme.border}`
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className={`w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center font-black text-lg sm:text-xl border-2 ${
                              isCorrect
                                ? 'bg-emerald-400 text-ink-main border-emerald-300'
                                : `${colorScheme.border} ${colorScheme.text} bg-black/20`
                            }`}
                          >
                            {opt}
                          </div>
                          <span className="text-lg sm:text-xl md:text-2xl font-bold text-white">
                            {optionText}
                          </span>
                        </div>

                        {phase === 'REVEAL' && (
                          <div className="flex items-center gap-2">
                            {isCorrect && <CheckCircle2 size={24} className="text-emerald-400" />}
                            <span className="font-mono text-base sm:text-lg font-bold text-white/80">
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
              <div className="w-full max-w-3xl bg-white/5 border border-white/10 rounded-3xl p-6 sm:p-8 backdrop-blur-md shadow-2xl">
                <h3 className="text-2xl sm:text-3xl font-black text-brand-reward mb-6 text-center flex items-center justify-center gap-2">
                  <Award className="w-7 h-7" />
                  <span>Placar Geral Parcial</span>
                </h3>
                <div className="space-y-3">
                  {(quizState?.leaderboard || []).slice(0, 5).map((entry, idx) => (
                    <div
                      key={entry.user_id}
                      className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/10 animate-scale-up"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-xl bg-brand-primary/30 flex items-center justify-center font-mono font-bold text-brand-reward">
                          #{idx + 1}
                        </span>
                        <span className="text-lg sm:text-xl font-bold text-white">{entry.nickname}</span>
                        {entry.streak && entry.streak > 1 ? (
                          <span className="px-2 py-0.5 rounded-md bg-brand-action/20 text-brand-action text-[11px] font-bold">
                            {entry.streak}x Streak
                          </span>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-4 font-mono">
                        <span className="text-emerald-400 font-bold">+{entry.round_score} pts</span>
                        <span className="text-xl sm:text-2xl font-black text-brand-reward">
                          {entry.total_score} pts
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {phase === 'FINAL_RESULTS' && (
              /* 3-Tier Olympic Winner Podium (Item 17) */
              <div className="w-full max-w-4xl bg-gradient-to-b from-brand-reward/25 to-brand-reward/5 border-2 border-brand-reward/50 rounded-3xl p-6 sm:p-10 backdrop-blur-lg shadow-2xl text-center">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-brand-reward/20 mx-auto flex items-center justify-center mb-3">
                  <Crown size={48} className="text-brand-reward animate-bounce" />
                </div>
                <h3 className="text-3xl sm:text-5xl font-black text-brand-reward mb-1">
                  CAMPEÕES DO QUIZ!
                </h3>
                <p className="text-base sm:text-xl font-bold text-white mb-8">
                  Parabéns aos maiores conhecedores da rodada!
                </p>

                {/* Podium Grid */}
                <div className="flex items-end justify-center gap-3 sm:gap-6 pt-6 pb-2">
                  {/* 2nd Place */}
                  {quizState?.leaderboard?.[1] && (
                    <div className="flex flex-col items-center">
                      <span className="text-sm sm:text-base font-bold text-white mb-1">
                        {quizState.leaderboard[1].nickname}
                      </span>
                      <span className="text-xs font-mono text-gray-400 mb-2">
                        {quizState.leaderboard[1].total_score} pts
                      </span>
                      <div className="w-20 sm:w-28 h-28 sm:h-36 bg-gray-400/20 border-2 border-gray-300 rounded-t-3xl flex flex-col items-center justify-center shadow-lg">
                        <span className="text-2xl sm:text-3xl font-black text-gray-300">2º</span>
                        <span className="text-[10px] font-bold uppercase text-gray-400">Prata</span>
                      </div>
                    </div>
                  )}

                  {/* 1st Place */}
                  {quizState?.leaderboard?.[0] && (
                    <div className="flex flex-col items-center">
                      <span className="text-base sm:text-xl font-black text-brand-reward mb-1">
                        {quizState.leaderboard[0].nickname}
                      </span>
                      <span className="text-sm font-mono text-brand-reward font-bold mb-2">
                        {quizState.leaderboard[0].total_score} pts
                      </span>
                      <div className="w-24 sm:w-36 h-36 sm:h-48 bg-brand-reward/30 border-2 border-brand-reward rounded-t-3xl flex flex-col items-center justify-center shadow-xl shadow-brand-reward/20">
                        <span className="text-3xl sm:text-5xl font-black text-brand-reward">1º</span>
                        <span className="text-xs font-black uppercase text-brand-reward">Ouro</span>
                      </div>
                    </div>
                  )}

                  {/* 3rd Place */}
                  {quizState?.leaderboard?.[2] && (
                    <div className="flex flex-col items-center">
                      <span className="text-sm sm:text-base font-bold text-white mb-1">
                        {quizState.leaderboard[2].nickname}
                      </span>
                      <span className="text-xs font-mono text-gray-400 mb-2">
                        {quizState.leaderboard[2].total_score} pts
                      </span>
                      <div className="w-20 sm:w-28 h-20 sm:h-28 bg-amber-700/20 border-2 border-amber-600 rounded-t-3xl flex flex-col items-center justify-center shadow-lg">
                        <span className="text-2xl sm:text-3xl font-black text-amber-500">3º</span>
                        <span className="text-[10px] font-bold uppercase text-amber-500">Bronze</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ==================================================================== */
          /* ======================== DEBATE COURT STAGE ======================== */
          /* ==================================================================== */
          <div className="w-full flex flex-col items-center">
            {/* Clock & Phase Banner */}
            <div className="flex flex-col items-center mb-6">
              <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/15 text-brand-reward text-xs sm:text-sm font-bold uppercase tracking-wider mb-4">
                <Swords size={16} />
                <span>MODO DEBATE • {phase.replace('_', ' ')}</span>
              </div>
              {/* Circular Countdown Timer Ring (Item 64) */}
              <div className="relative w-28 h-28 sm:w-36 sm:h-36 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90 drop-shadow-[0_0_20px_rgba(253,203,110,0.4)]" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    stroke="currentColor"
                    strokeWidth="7"
                    className="text-white/10"
                    fill="transparent"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    stroke={remaining > 10 ? '#00CEC9' : remaining > 5 ? '#FDCB6E' : '#FF7675'}
                    strokeWidth="7"
                    strokeDasharray={264}
                    strokeDashoffset={264 - (264 * Math.max(0, Math.min(30, remaining))) / 30}
                    strokeLinecap="round"
                    className="transition-all duration-1000 ease-linear"
                    fill="transparent"
                  />
                </svg>
                <div className="absolute flex flex-col items-center justify-center">
                  <span className={`text-3xl sm:text-4xl font-black font-mono tracking-tighter ${
                    remaining <= 5 ? 'text-brand-action animate-ping' : 'text-brand-reward'
                  }`}>
                    {remaining}s
                  </span>
                </div>
              </div>
            </div>

            {/* Topic Card */}
            <div className="w-full bg-white/5 border border-white/10 rounded-3xl p-6 mb-6 backdrop-blur-md shadow-2xl text-center">
              <span className="text-xs font-mono uppercase text-brand-reward tracking-widest block mb-1">
                TEMA DA DISPUTA
              </span>
              <h2 className="text-xl sm:text-3xl md:text-4xl font-black leading-snug">
                "{debateState?.topic || 'Abacaxi na pizza é crime ou alta gastronomia?'}"
              </h2>
            </div>

            {/* Debaters Cards or Results Celebration */}
            {phase === 'RESULTS' ? (
              <div className="w-full max-w-3xl bg-gradient-to-b from-brand-reward/20 to-brand-reward/5 border-2 border-brand-reward/50 rounded-3xl p-8 sm:p-10 backdrop-blur-lg shadow-2xl text-center">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-brand-reward/20 mx-auto flex items-center justify-center mb-4">
                  <Crown size={52} className="text-brand-reward animate-bounce" />
                </div>
                <h3 className="text-3xl sm:text-5xl font-black text-brand-reward mb-2">
                  {debateState?.winner_side === 'side_a'
                    ? 'LADO CORAL É O VENCEDOR!'
                    : debateState?.winner_side === 'side_b'
                    ? 'LADO MENTA É O VENCEDOR!'
                    : 'EMPATE ENTRE OS DEBATEDORES!'}
                </h3>
                <p className="text-white/80 font-body text-base sm:text-lg mb-6">
                  {debateState?.winner_side === 'side_a'
                    ? `${debateState.debater_a.nickname} convenceu a maioria dos jurados com seus argumentos!`
                    : debateState?.winner_side === 'side_b'
                    ? `${debateState.debater_b.nickname} convenceu a maioria dos jurados com seus argumentos!`
                    : 'O júri popular se dividiu igualmente entre os dois debatedores!'}
                </p>
                <div className="flex justify-center items-center gap-8 text-xl sm:text-2xl font-mono font-bold">
                  <span className="text-brand-action">Lado A: {sideAVotes} votos</span>
                  <span className="text-white/30">•</span>
                  <span className="text-brand-mint">Lado B: {sideBVotes} votos</span>
                </div>
              </div>
            ) : (
              <div className="w-full space-y-6">
                {/* Tug-of-War Crowd Meter (Item 15) */}
                <div className="w-full bg-white/5 border border-white/10 rounded-3xl p-5 shadow-xl">
                  <div className="flex justify-between font-mono font-bold text-xs sm:text-sm px-2 mb-2">
                    <span className="text-brand-action flex items-center gap-1.5">
                      <span>{debateState?.side_a_label || 'Lado Coral'}</span>
                      <span>({sideAPercent}%)</span>
                    </span>
                    <span className="text-white/50">{totalVotes} votos dos jurados</span>
                    <span className="text-brand-mint flex items-center gap-1.5">
                      <span>({sideBPercent}%)</span>
                      <span>{debateState?.side_b_label || 'Lado Menta'}</span>
                    </span>
                  </div>

                  {/* Tug-of-War Bar with Dynamic Rope Knot */}
                  <div className="relative w-full h-7 rounded-full overflow-hidden flex bg-white/10 p-1 border border-white/10 shadow-inner">
                    <div
                      className="bg-brand-action h-full transition-all duration-500 rounded-l-full flex items-center justify-start pl-3 text-[10px] font-black text-white"
                      style={{ width: `${sideAPercent}%` }}
                    >
                      {sideAPercent > 15 && `${sideAVotes} votos`}
                    </div>
                    {/* Rope Knot Indicator */}
                    <div className="absolute top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white shadow-md border-2 border-brand-reward flex items-center justify-center text-[10px] font-black text-ink-main pointer-events-none transition-all duration-500"
                      style={{ left: `calc(${sideAPercent}% - 12px)` }}
                    >
                      VS
                    </div>
                    <div
                      className="bg-brand-mint h-full transition-all duration-500 rounded-r-full flex items-center justify-end pr-3 text-[10px] font-black text-ink-main"
                      style={{ width: `${sideBPercent}%` }}
                    >
                      {sideBPercent > 15 && `${sideBVotes} votos`}
                    </div>
                  </div>
                </div>

                {/* Live Argument Teleprompter Cards (Item 16) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 w-full">
                  {/* Side A Card (Coral) */}
                  <div
                    className={`rounded-3xl p-6 sm:p-8 flex flex-col justify-between text-left shadow-2xl relative overflow-hidden transition-all duration-300 ${
                      phase === 'OPENING_ARGUMENTS'
                        ? 'bg-brand-action/25 border-4 border-brand-action shadow-brand-action/30 scale-102 ring-4 ring-brand-action/20'
                        : 'bg-brand-action/10 border-2 border-brand-action/30'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <span className="px-3.5 py-1.5 rounded-xl bg-brand-action text-white text-xs font-black uppercase tracking-wider shadow-sm">
                          LADO A (CORAL)
                        </span>
                        <span className="font-mono text-xl sm:text-2xl font-black text-brand-action">
                          {sideAVotes} {sideAVotes === 1 ? 'Voto' : 'Votos'}
                        </span>
                      </div>
                      <h3 className="text-2xl sm:text-3xl font-black text-white mb-4">
                        {debateState?.debater_a?.nickname || 'Defensor A'}
                      </h3>
                    </div>
                    <div className="bg-black/40 rounded-2xl p-5 font-body text-base text-white/90 min-h-[130px] flex items-center border border-white/5">
                      <p className="leading-relaxed italic">
                        {debateState?.debater_a?.argument
                          ? `"${debateState.debater_a.argument}"`
                          : 'Aguardando o debatedor redigir seu argumento no celular...'}
                      </p>
                    </div>
                  </div>

                  {/* Side B Card (Mint) */}
                  <div
                    className={`rounded-3xl p-6 sm:p-8 flex flex-col justify-between text-left shadow-2xl relative overflow-hidden transition-all duration-300 ${
                      phase === 'REBUTTAL'
                        ? 'bg-brand-mint/25 border-4 border-brand-mint shadow-brand-mint/30 scale-102 ring-4 ring-brand-mint/20'
                        : 'bg-brand-mint/10 border-2 border-brand-mint/30'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <span className="px-3.5 py-1.5 rounded-xl bg-brand-mint text-ink-main text-xs font-black uppercase tracking-wider shadow-sm">
                          LADO B (MENTA)
                        </span>
                        <span className="font-mono text-xl sm:text-2xl font-black text-brand-mint">
                          {sideBVotes} {sideBVotes === 1 ? 'Voto' : 'Votos'}
                        </span>
                      </div>
                      <h3 className="text-2xl sm:text-3xl font-black text-white mb-4">
                        {debateState?.debater_b?.nickname || 'Defensor B'}
                      </h3>
                    </div>
                    <div className="bg-black/40 rounded-2xl p-5 font-body text-base text-white/90 min-h-[130px] flex items-center border border-white/5">
                      <p className="leading-relaxed italic">
                        {debateState?.debater_b?.argument
                          ? `"${debateState.debater_b.argument}"`
                          : 'Aguardando a tréplica do debatedor no celular...'}
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
        <p>PORChat Stage Engine v2.0 • Sincronizado para Projetores & TVs 4K</p>
        <p className="flex items-center gap-1.5 font-semibold text-brand-reward">
          <Flame size={16} className="text-brand-action" />
          <span>Plateia Interativa: Use o celular para votar e reagir!</span>
        </p>
      </footer>
    </div>
  );
}
