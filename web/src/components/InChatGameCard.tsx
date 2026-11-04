'use client';

import React, { useState } from 'react';
import {
  Scale,
  Zap,
  Tv,
  Send,
  CheckCircle2,
  MessageSquarePlus,
  Award,
  ThumbsUp,
  Flame,
  Clock,
} from 'lucide-react';
import type { GameStateUpdatePayload, QuizOptionKey } from '@/lib/types';

interface InChatGameCardProps {
  gameState: GameStateUpdatePayload;
  currentNickname: string;
  currentUserId: string;
  onOpenTV: () => void;
  onCastVote: (side: 'side_a' | 'side_b') => void;
  onSubmitArgument?: (argument: string) => void;
  onPlayerReady?: () => void;
  onAskQuestion?: (question: string, targetSide: 'side_a' | 'side_b' | 'both') => void;
  onTriggerReaction?: (emoji: string) => void;
  onSubmitQuizAnswer?: (choice: QuizOptionKey) => void;
}

const QUIZ_BUTTON_STYLES: Record<
  QuizOptionKey,
  { bg: string; border: string; label: string }
> = {
  A: { bg: 'bg-[#FF6B6B]', border: 'border-[#c84646]', label: 'A' },
  B: { bg: 'bg-[#48DBFB]', border: 'border-[#259db8]', label: 'B' },
  C: { bg: 'bg-[#FECA57]', border: 'border-[#c7972c]', label: 'C' },
  D: { bg: 'bg-[#1DD1A1]', border: 'border-[#129672]', label: 'D' },
};

export function InChatGameCard({
  gameState,
  currentNickname,
  currentUserId,
  onOpenTV,
  onCastVote,
  onSubmitArgument,
  onPlayerReady,
  onAskQuestion,
  onTriggerReaction,
  onSubmitQuizAnswer,
}: InChatGameCardProps) {
  const [argumentInput, setArgumentInput] = useState('');
  const [questionInput, setQuestionInput] = useState('');
  const [questionTarget, setQuestionTarget] = useState<'both' | 'side_a' | 'side_b'>('both');
  const [selectedVote, setSelectedVote] = useState<'side_a' | 'side_b' | null>(null);
  const [selectedQuizChoice, setSelectedQuizChoice] = useState<QuizOptionKey | null>(null);
  const [lastAnsweredQuestionIdx, setLastAnsweredQuestionIdx] = useState<number>(-1);

  if (!gameState || gameState.phase === 'CHAT') return null;

  const isDebate = gameState.game_type === 'debate';
  const deb = gameState.debate_state;
  const quiz = gameState.quiz_state;

  const isDebaterA =
    Boolean(deb?.debater_a) &&
    (deb!.debater_a.id.toLowerCase() === currentUserId.toLowerCase() ||
      deb!.debater_a.nickname.toLowerCase() === currentNickname.toLowerCase());

  const isDebaterB =
    Boolean(deb?.debater_b) &&
    (deb!.debater_b.id.toLowerCase() === currentUserId.toLowerCase() ||
      deb!.debater_b.nickname.toLowerCase() === currentNickname.toLowerCase());

  const isDebater = isDebaterA || isDebaterB;

  const handleArgumentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!argumentInput.trim() || !onSubmitArgument) return;
    onSubmitArgument(argumentInput.trim());
    setArgumentInput('');
  };

  const handleQuestionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!questionInput.trim() || !onAskQuestion) return;
    onAskQuestion(questionInput.trim(), questionTarget);
    setQuestionInput('');
  };

  const handleVoteClick = (side: 'side_a' | 'side_b') => {
    setSelectedVote(side);
    onCastVote(side);
  };

  const currentQIdx = quiz?.current_question_index ?? 0;
  const hasAnsweredCurrentQuiz = lastAnsweredQuestionIdx === currentQIdx && selectedQuizChoice !== null;

  const handleQuizClick = (key: QuizOptionKey) => {
    if (hasAnsweredCurrentQuiz || !onSubmitQuizAnswer) return;
    setSelectedQuizChoice(key);
    setLastAnsweredQuestionIdx(currentQIdx);
    onSubmitQuizAnswer(key);
  };

  return (
    <div className="my-3 overflow-hidden rounded-3xl border border-slate-800 bg-[#1A1D2D] text-white shadow-xl">
      {/* Top Status Banner */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 bg-[#121521] px-5 py-3">
        <div className="flex items-center gap-2.5">
          <span
            className={`flex h-8 w-8 items-center justify-center rounded-xl ${
              isDebate ? 'bg-[#FF7675]/20 text-[#FF7675]' : 'bg-[#6C5CE7]/20 text-[#6C5CE7]'
            }`}
          >
            {isDebate ? <Scale className="h-4 w-4" /> : <Zap className="h-4 w-4" />}
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-heading text-xs font-extrabold uppercase tracking-wider text-white">
                {isDebate ? 'Modo Debate • O Tribunal' : 'Quiz Relâmpago'}
              </span>
              <span className="rounded-md bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-[#FDCB6E]">
                {gameState.phase}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              {isDebate
                ? isDebaterA
                  ? 'Seu papel: Debatedor Lado A (Coral)'
                  : isDebaterB
                  ? 'Seu papel: Debatedor Lado B (Menta)'
                  : 'Seu papel: Jurado do Tribunal'
                : `Pergunta ${(quiz?.current_question_index ?? 0) + 1} de ${quiz?.total_questions ?? 5}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-extrabold text-[#FDCB6E]">
            <Clock className="h-3.5 w-3.5" />
            <span>{gameState.remaining_seconds}s</span>
          </div>
          <button
            type="button"
            onClick={onOpenTV}
            className="flex items-center gap-1.5 rounded-xl bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-200 transition hover:bg-slate-700"
          >
            <Tv className="h-3.5 w-3.5 text-[#00CEC9]" />
            Abrir Modo TV
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="space-y-4 p-5">
        {isDebate && deb ? (
          <>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-center">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#FF7675]">
                Pauta em Julgamento ({deb.category || 'Geral'})
              </span>
              <h3 className="mt-1 font-heading text-base font-extrabold text-white">{deb.topic}</h3>
            </div>

            {/* Side A vs Side B Cards */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-[#FF7675]/30 bg-[#FF7675]/10 p-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#FF7675]">
                    {deb.side_a_label || 'Lado A (Coral)'}
                  </span>
                  <span className="text-xs font-bold text-white">{deb.debater_a.nickname}</span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-200">
                  {deb.debater_a.opening_argument ||
                    deb.debater_a.argument ||
                    'Aguardando argumento inicial...'}
                </p>
                {deb.debater_a.rebuttal_argument && (
                  <p className="mt-2 border-t border-[#FF7675]/20 pt-2 text-xs italic text-[#FDCB6E]">
                    Réplica: {deb.debater_a.rebuttal_argument}
                  </p>
                )}
              </div>

              <div className="rounded-2xl border border-[#00CEC9]/30 bg-[#00CEC9]/10 p-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#00CEC9]">
                    {deb.side_b_label || 'Lado B (Menta)'}
                  </span>
                  <span className="text-xs font-bold text-white">{deb.debater_b.nickname}</span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-200">
                  {deb.debater_b.opening_argument ||
                    deb.debater_b.argument ||
                    'Aguardando argumento inicial...'}
                </p>
                {deb.debater_b.rebuttal_argument && (
                  <p className="mt-2 border-t border-[#00CEC9]/20 pt-2 text-xs italic text-[#FDCB6E]">
                    Réplica: {deb.debater_b.rebuttal_argument}
                  </p>
                )}
              </div>
            </div>

            {/* Phase-specific interactive controls */}
            {gameState.phase === 'LOBBY' && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/80 p-3.5">
                <div className="text-xs text-slate-300">
                  Jogadores prontos:{' '}
                  <strong className="text-[#00CEC9]">
                    {deb.ready_players && deb.ready_players.length > 0
                      ? deb.ready_players.join(', ')
                      : 'Aguardando confirmação...'}
                  </strong>
                </div>
                {onPlayerReady && (
                  <button
                    type="button"
                    onClick={onPlayerReady}
                    className="flex items-center gap-1.5 rounded-xl bg-[#00CEC9] px-4 py-2 text-xs font-extrabold text-slate-950 transition hover:brightness-105"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Confirmar Presença
                  </button>
                )}
              </div>
            )}

            {(gameState.phase === 'OPENING_ARGUMENTS' || gameState.phase === 'REBUTTAL') &&
              (isDebater ? (
                <form onSubmit={handleArgumentSubmit} className="flex gap-2">
                  <input
                    type="text"
                    value={argumentInput}
                    onChange={(e) => setArgumentInput(e.target.value)}
                    placeholder={
                      gameState.phase === 'REBUTTAL'
                        ? 'Escreva sua réplica / contra-argumento para o telão...'
                        : 'Escreva seu argumento de abertura para o telão...'
                    }
                    className="flex-1 rounded-2xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-xs text-white focus:border-[#FF7675] focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 rounded-2xl bg-[#FF7675] px-4 py-2.5 text-xs font-bold text-white transition hover:brightness-105"
                  >
                    <Send className="h-3.5 w-3.5" />
                    Enviar ao Telão
                  </button>
                </form>
              ) : (
                onAskQuestion && (
                  <form onSubmit={handleQuestionSubmit} className="flex flex-wrap gap-2">
                    <select
                      value={questionTarget}
                      onChange={(e) =>
                        setQuestionTarget(e.target.value as 'both' | 'side_a' | 'side_b')
                      }
                      className="rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-300"
                    >
                      <option value="both">Pergunta para Ambos</option>
                      <option value="side_a">Para {deb.debater_a.nickname}</option>
                      <option value="side_b">Para {deb.debater_b.nickname}</option>
                    </select>
                    <input
                      type="text"
                      value={questionInput}
                      onChange={(e) => setQuestionInput(e.target.value)}
                      placeholder="Enviar pergunta do júri para o telão..."
                      className="min-w-[180px] flex-1 rounded-2xl border border-slate-700 bg-slate-950 px-4 py-2 text-xs text-white focus:border-[#00CEC9] focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="flex items-center gap-1.5 rounded-2xl bg-slate-800 px-4 py-2 text-xs font-bold text-[#00CEC9] transition hover:bg-slate-700"
                    >
                      <MessageSquarePlus className="h-3.5 w-3.5" />
                      Perguntar
                    </button>
                  </form>
                )
              ))}

            {gameState.phase === 'VOTING' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleVoteClick('side_a')}
                    className={`rounded-2xl border-b-4 p-3.5 text-center font-heading text-xs font-extrabold transition active:translate-y-0.5 ${
                      selectedVote === 'side_a'
                        ? 'border-[#b83b3a] bg-[#FF7675] text-white ring-2 ring-white'
                        : 'border-[#c44d4c] bg-[#FF7675]/90 text-white hover:bg-[#FF7675]'
                    }`}
                  >
                    Votar em {deb.debater_a.nickname} ({deb.votes_count?.side_a ?? 0})
                  </button>

                  <button
                    type="button"
                    onClick={() => handleVoteClick('side_b')}
                    className={`rounded-2xl border-b-4 p-3.5 text-center font-heading text-xs font-extrabold transition active:translate-y-0.5 ${
                      selectedVote === 'side_b'
                        ? 'border-[#008f8b] bg-[#00CEC9] text-slate-950 ring-2 ring-white'
                        : 'border-[#009c98] bg-[#00CEC9]/90 text-slate-950 hover:bg-[#00CEC9]'
                    }`}
                  >
                    Votar em {deb.debater_b.nickname} ({deb.votes_count?.side_b ?? 0})
                  </button>
                </div>

                {onTriggerReaction && (
                  <div className="flex items-center justify-center gap-2">
                    {[
                      { key: 'APPLAUSE', label: 'Aplausos', icon: Award },
                      { key: 'CONVINCING', label: 'Convincente', icon: ThumbsUp },
                      { key: 'FIRE', label: 'Argumento Forte', icon: Flame },
                    ].map((r) => {
                      const Icon = r.icon;
                      return (
                        <button
                          key={r.key}
                          type="button"
                          onClick={() => onTriggerReaction(r.label)}
                          className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-[11px] font-bold text-slate-300 transition hover:border-[#FDCB6E] hover:text-[#FDCB6E]"
                        >
                          <Icon className="h-3.5 w-3.5" />
                          {r.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {gameState.phase === 'RESULTS' && (
              <div className="rounded-2xl border border-[#FDCB6E]/40 bg-[#FDCB6E]/10 p-4 text-center">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#FDCB6E]">
                  Veredito Oficial do Júri
                </span>
                <p className="mt-1 font-heading text-base font-extrabold text-white">
                  {deb.winner_side === 'side_a'
                    ? `Vitória de ${deb.debater_a.nickname}!`
                    : deb.winner_side === 'side_b'
                    ? `Vitória de ${deb.debater_b.nickname}!`
                    : 'Empate Técnico no Tribunal!'}
                </p>
              </div>
            )}
          </>
        ) : quiz ? (
          <>
            {quiz.current_question ? (
              <div className="space-y-3">
                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[#00CEC9]">
                    <span>{quiz.current_question.category || quiz.category || 'Geral'}</span>
                    <span>{quiz.current_question.difficulty || quiz.difficulty || 'Média'}</span>
                  </div>
                  <h3 className="mt-1 font-heading text-sm font-bold text-white">
                    {quiz.current_question.prompt}
                  </h3>
                </div>

                {gameState.phase === 'QUESTION' && (
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    {(['A', 'B', 'C', 'D'] as QuizOptionKey[]).map((key) => {
                      const style = QUIZ_BUTTON_STYLES[key];
                      const text = quiz.current_question?.options?.[key] || '';
                      const isChosen = hasAnsweredCurrentQuiz && selectedQuizChoice === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          disabled={hasAnsweredCurrentQuiz}
                          onClick={() => handleQuizClick(key)}
                          className={`flex items-center gap-3 rounded-2xl border-b-4 p-3 text-left text-xs font-extrabold text-slate-950 transition ${
                            style.bg
                          } ${style.border} ${
                            isChosen
                              ? 'ring-2 ring-white'
                              : hasAnsweredCurrentQuiz
                              ? 'opacity-50'
                              : 'hover:brightness-105 active:translate-y-0.5'
                          }`}
                        >
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-black/20 text-xs font-black text-white">
                            {key}
                          </span>
                          <span className="line-clamp-2 flex-1">{text}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {gameState.phase !== 'QUESTION' && quiz.correct_option && (
                  <div className="rounded-2xl border border-[#00CEC9]/40 bg-[#00CEC9]/10 p-3 text-center text-xs font-bold text-[#00CEC9]">
                    Resposta Correta: Alternativa {quiz.correct_option} —{' '}
                    {quiz.current_question.options[quiz.correct_option as QuizOptionKey]}
                    {quiz.fastest_responder && (
                      <span className="mt-1 block text-[11px] text-[#FDCB6E]">
                        Mais rápido: {quiz.fastest_responder.nickname} (
                        {quiz.fastest_responder.response_time_ms} ms)
                      </span>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 text-center text-xs text-slate-300">
                Preparando perguntas do Quiz Relâmpago...
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
