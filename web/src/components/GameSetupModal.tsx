'use client';

import React, { useEffect, useState } from 'react';
import {
  X,
  Scale,
  Zap,
  Plus,
  Users,
  Clock,
  Check,
  Sliders,
  BookOpen,
  Layers,
} from 'lucide-react';
import type {
  CustomDebateTopic,
  CustomTriviaQuestion,
  GameStartPayload,
  QuizOptionKey,
  TriviaDifficulty,
} from '@/lib/types';
import {
  fetchRoomTopics,
  createCustomDebateTopic,
  fetchRoomQuestions,
  createCustomTriviaQuestion,
} from '@/lib/apiClient';

interface GameSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  currentNickname: string;
  members: string[];
  initialMode?: 'debate' | 'quiz';
  onLaunchGame: (payload: GameStartPayload) => void;
}

const DEBATE_CATEGORIES = ['Todas', 'Tech', 'Cotidiano', 'Gastronomia', 'Cultura Pop', 'Personalizado'];
const QUIZ_CATEGORIES = ['Todas', 'Tecnologia', 'Games', 'Cultura Pop', 'Ciência', 'História', 'Geral', 'Personalizado'];
const QUIZ_DIFFICULTIES: TriviaDifficulty[] = ['Todas', 'Fácil', 'Média', 'Difícil'];

export default function GameSetupModal({
  isOpen,
  onClose,
  roomId,
  currentNickname,
  members,
  initialMode = 'debate',
  onLaunchGame,
}: GameSetupModalProps) {
  const [mode, setMode] = useState<'debate' | 'quiz'>(initialMode);

  // Debate Setup State
  const [debateCategory, setDebateCategory] = useState<string>('Todas');
  const [selectedTopic, setSelectedTopic] = useState<string>('');
  const [debaterA, setDebaterA] = useState<string>('');
  const [debaterB, setDebaterB] = useState<string>('');
  const [openingSeconds, setOpeningSeconds] = useState<number>(45);
  const [rebuttalSeconds, setRebuttalSeconds] = useState<number>(30);
  const [votingSeconds, setVotingSeconds] = useState<number>(20);

  // Custom Topic Builder State
  const [showTopicCreator, setShowTopicCreator] = useState(false);
  const [newTopicText, setNewTopicText] = useState('');
  const [newTopicCategory, setNewTopicCategory] = useState('Personalizado');
  const [newSideALabel, setNewSideALabel] = useState('Defesa Coral (A)');
  const [newSideBLabel, setNewSideBLabel] = useState('Defesa Menta (B)');
  const [curatedTopics, setCuratedTopics] = useState<
    Array<{ topic: string; category: string; side_a_label: string; side_b_label: string }>
  >([]);
  const [customTopics, setCustomTopics] = useState<CustomDebateTopic[]>([]);

  // Quiz Setup State
  const [quizCategory, setQuizCategory] = useState<string>('Todas');
  const [quizDifficulty, setQuizDifficulty] = useState<TriviaDifficulty>('Todas');
  const [roundCount, setRoundCount] = useState<number>(5);
  const [questionSeconds, setQuestionSeconds] = useState<number>(15);
  const [includeCustomQuestions, setIncludeCustomQuestions] = useState<boolean>(true);

  // Custom Trivia Question Builder State
  const [showQuestionCreator, setShowQuestionCreator] = useState(false);
  const [newQuestionPrompt, setNewQuestionPrompt] = useState('');
  const [newQuestionCategory, setNewQuestionCategory] = useState('Personalizado');
  const [newQuestionDifficulty, setNewQuestionDifficulty] = useState<'Fácil' | 'Média' | 'Difícil'>('Média');
  const [optionA, setOptionA] = useState('');
  const [optionB, setOptionB] = useState('');
  const [optionC, setOptionC] = useState('');
  const [optionD, setOptionD] = useState('');
  const [correctOpt, setCorrectOpt] = useState<QuizOptionKey>('A');
  const [customQuestions, setCustomQuestions] = useState<CustomTriviaQuestion[]>([]);

  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSavingCustom, setIsSavingCustom] = useState(false);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    if (!isOpen || !roomId) return;
    fetchRoomTopics(roomId).then((res) => {
      setCuratedTopics(res.curated_topics || []);
      setCustomTopics(res.custom_topics || []);
    });
    fetchRoomQuestions(roomId).then((res) => {
      setCustomQuestions(res.custom_questions || []);
    });
  }, [isOpen, roomId]);

  useEffect(() => {
    if (members.length >= 2 && !debaterA && !debaterB) {
      setDebaterA(members[0]);
      setDebaterB(members[1]);
    } else if (members.length === 1 && !debaterA) {
      setDebaterA(members[0]);
    }
  }, [members, debaterA, debaterB]);

  if (!isOpen) return null;

  const availableTopics = [
    ...customTopics.map((ct) => ({
      topic: ct.topic,
      category: ct.category,
      side_a_label: ct.side_a_label,
      side_b_label: ct.side_b_label,
      isCustom: true,
    })),
    ...curatedTopics.map((t) => ({
      ...t,
      isCustom: false,
    })),
  ].filter((t) => debateCategory === 'Todas' || t.category.toLowerCase() === debateCategory.toLowerCase());

  const handleSaveCustomTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newTopicText.trim().length < 5) {
      setStatusMessage('O tema precisa ter pelo menos 5 caracteres.');
      return;
    }
    setIsSavingCustom(true);
    setStatusMessage(null);
    try {
      const created = await createCustomDebateTopic(roomId, {
        topic: newTopicText.trim(),
        category: newTopicCategory,
        side_a_label: newSideALabel.trim() || 'Defesa Coral (A)',
        side_b_label: newSideBLabel.trim() || 'Defesa Menta (B)',
        created_by: currentNickname,
      });
      setCustomTopics((prev) => [created, ...prev]);
      setSelectedTopic(created.topic);
      setNewTopicText('');
      setShowTopicCreator(false);
      setStatusMessage('Tema personalizado salvo na sala.');
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : 'Erro ao salvar tema.');
    } finally {
      setIsSavingCustom(false);
    }
  };

  const handleSaveCustomQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      newQuestionPrompt.trim().length < 5 ||
      !optionA.trim() ||
      !optionB.trim() ||
      !optionC.trim() ||
      !optionD.trim()
    ) {
      setStatusMessage('Preencha o enunciado e todas as 4 alternativas.');
      return;
    }
    setIsSavingCustom(true);
    setStatusMessage(null);
    try {
      const created = await createCustomTriviaQuestion(roomId, {
        prompt: newQuestionPrompt.trim(),
        category: newQuestionCategory,
        difficulty: newQuestionDifficulty,
        options: {
          A: optionA.trim(),
          B: optionB.trim(),
          C: optionC.trim(),
          D: optionD.trim(),
        },
        correct_option: correctOpt,
        created_by: currentNickname,
      });
      setCustomQuestions((prev) => [created, ...prev]);
      setNewQuestionPrompt('');
      setOptionA('');
      setOptionB('');
      setOptionC('');
      setOptionD('');
      setShowQuestionCreator(false);
      setStatusMessage('Pergunta adicionada ao banco da sala.');
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : 'Erro ao salvar pergunta.');
    } finally {
      setIsSavingCustom(false);
    }
  };

  const handleStart = () => {
    if (mode === 'debate') {
      onLaunchGame({
        game_type: 'debate',
        topic: selectedTopic || undefined,
        category: debateCategory === 'Todas' ? undefined : debateCategory,
        debater_a_id: debaterA || undefined,
        debater_a_name: debaterA || undefined,
        debater_b_id: debaterB || undefined,
        debater_b_name: debaterB || undefined,
        opening_seconds: openingSeconds,
        rebuttal_seconds: rebuttalSeconds,
        voting_seconds: votingSeconds,
      });
    } else {
      onLaunchGame({
        game_type: 'quiz',
        category: quizCategory === 'Todas' ? undefined : quizCategory,
        difficulty: quizDifficulty,
        round_count: roundCount,
        question_seconds: questionSeconds,
        include_custom: includeCustomQuestions,
      });
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Configurar Partida"
    >
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-800 bg-[#161925] text-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800/80 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#6C5CE7]/20 text-[#6C5CE7]">
              <Sliders className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-heading text-lg font-bold">Configurar Partida Sincronizada</h2>
              <p className="text-xs text-slate-400">
                Servidor autoritativo em tempo real com suporte ao Modo TV e Controle Mobile
              </p>
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

        {/* Mode Switcher Tabs */}
        <div className="grid grid-cols-2 gap-3 border-b border-slate-800/80 bg-[#11131D] px-6 py-3">
          <button
            type="button"
            onClick={() => setMode('debate')}
            className={`flex items-center justify-center gap-2.5 rounded-2xl py-3 text-sm font-bold transition ${
              mode === 'debate'
                ? 'bg-[#FF7675] text-white shadow-lg shadow-[#FF7675]/20'
                : 'bg-slate-900/70 text-slate-400 hover:text-white'
            }`}
          >
            <Scale className="h-4 w-4" />
            Modo Debate (O Tribunal)
          </button>
          <button
            type="button"
            onClick={() => setMode('quiz')}
            className={`flex items-center justify-center gap-2.5 rounded-2xl py-3 text-sm font-bold transition ${
              mode === 'quiz'
                ? 'bg-[#6C5CE7] text-white shadow-lg shadow-[#6C5CE7]/20'
                : 'bg-slate-900/70 text-slate-400 hover:text-white'
            }`}
          >
            <Zap className="h-4 w-4" />
            Quiz Relâmpago
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 space-y-5 overflow-y-auto p-6">
          {statusMessage && (
            <div className="rounded-2xl border border-[#00CEC9]/40 bg-[#00CEC9]/10 px-4 py-2.5 text-xs font-medium text-[#00CEC9]">
              {statusMessage}
            </div>
          )}

          {mode === 'debate' ? (
            <>
              {/* Debater Selection */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                  <label className="mb-1.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#FF7675]">
                    <Users className="h-3.5 w-3.5" />
                    Debatedor Lado A (Coral)
                  </label>
                  <select
                    value={debaterA}
                    onChange={(e) => setDebaterA(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white focus:border-[#FF7675] focus:outline-none"
                  >
                    <option value="">Automático (Sorteio Online)</option>
                    {members.map((m) => (
                      <option key={`deb-a-${m}`} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                  <label className="mb-1.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#00CEC9]">
                    <Users className="h-3.5 w-3.5" />
                    Debatedor Lado B (Menta)
                  </label>
                  <select
                    value={debaterB}
                    onChange={(e) => setDebaterB(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white focus:border-[#00CEC9] focus:outline-none"
                  >
                    <option value="">Automático (Sorteio Online)</option>
                    {members.map((m) => (
                      <option key={`deb-b-${m}`} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Category Filter */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Categoria de Pauta
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowTopicCreator((v) => !v)}
                    className="flex items-center gap-1.5 rounded-xl bg-slate-800 px-3 py-1.5 text-xs font-semibold text-[#FDCB6E] transition hover:bg-slate-700"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {showTopicCreator ? 'Fechar Criador' : 'Criar Tema Personalizado'}
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {DEBATE_CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => {
                        setDebateCategory(cat);
                        setSelectedTopic('');
                      }}
                      className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                        debateCategory === cat
                          ? 'bg-[#FF7675] text-white'
                          : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Topic Creator Drawer */}
              {showTopicCreator && (
                <form
                  onSubmit={handleSaveCustomTopic}
                  className="space-y-3 rounded-2xl border border-[#FDCB6E]/30 bg-slate-900/90 p-4"
                >
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#FDCB6E]">
                    Nova Pauta Personalizada da Sala
                  </h3>
                  <input
                    type="text"
                    value={newTopicText}
                    onChange={(e) => setNewTopicText(e.target.value)}
                    placeholder="Ex: Arquitetura Monolítica vs Microsserviços para Startups"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white focus:border-[#FDCB6E] focus:outline-none"
                  />
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <input
                      type="text"
                      value={newSideALabel}
                      onChange={(e) => setNewSideALabel(e.target.value)}
                      placeholder="Rótulo Lado A"
                      className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                    />
                    <input
                      type="text"
                      value={newSideBLabel}
                      onChange={(e) => setNewSideBLabel(e.target.value)}
                      placeholder="Rótulo Lado B"
                      className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                    />
                    <select
                      value={newTopicCategory}
                      onChange={(e) => setNewTopicCategory(e.target.value)}
                      className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                    >
                      <option value="Personalizado">Personalizado</option>
                      <option value="Tech">Tech</option>
                      <option value="Cotidiano">Cotidiano</option>
                      <option value="Gastronomia">Gastronomia</option>
                      <option value="Cultura Pop">Cultura Pop</option>
                    </select>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={isSavingCustom}
                      className="rounded-xl bg-[#FDCB6E] px-4 py-2 text-xs font-bold text-slate-950 transition hover:brightness-105 disabled:opacity-50"
                    >
                      {isSavingCustom ? 'Salvando...' : 'Salvar Tema na Sala'}
                    </button>
                  </div>
                </form>
              )}

              {/* Topic Picker */}
              <div>
                <label className="mb-1.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                  <BookOpen className="h-3.5 w-3.5" />
                  Escolher Tópico (ou deixe em Sorteio Automático)
                </label>
                <select
                  value={selectedTopic}
                  onChange={(e) => setSelectedTopic(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white focus:border-[#FF7675] focus:outline-none"
                >
                  <option value="">Sorteio Automático ({availableTopics.length} temas disponíveis)</option>
                  {availableTopics.map((item, idx) => (
                    <option key={`${item.topic}-${idx}`} value={item.topic}>
                      [{item.category}] {item.topic} ({item.side_a_label} vs {item.side_b_label})
                    </option>
                  ))}
                </select>
              </div>

              {/* Phase Timers */}
              <div className="grid grid-cols-3 gap-3 rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
                <div>
                  <label className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
                    <Clock className="h-3 w-3 text-[#FF7675]" />
                    Abertura (seg)
                  </label>
                  <input
                    type="number"
                    min={15}
                    max={120}
                    value={openingSeconds}
                    onChange={(e) => setOpeningSeconds(Number(e.target.value) || 45)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-bold text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
                    <Clock className="h-3 w-3 text-[#FDCB6E]" />
                    Réplica (seg)
                  </label>
                  <input
                    type="number"
                    min={15}
                    max={120}
                    value={rebuttalSeconds}
                    onChange={(e) => setRebuttalSeconds(Number(e.target.value) || 30)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-bold text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
                    <Clock className="h-3 w-3 text-[#00CEC9]" />
                    Votação (seg)
                  </label>
                  <input
                    type="number"
                    min={10}
                    max={90}
                    value={votingSeconds}
                    onChange={(e) => setVotingSeconds(Number(e.target.value) || 20)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-bold text-white"
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Quiz Category Selection */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Categoria de Perguntas
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowQuestionCreator((v) => !v)}
                    className="flex items-center gap-1.5 rounded-xl bg-slate-800 px-3 py-1.5 text-xs font-semibold text-[#00CEC9] transition hover:bg-slate-700"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {showQuestionCreator
                      ? 'Fechar Criador'
                      : `Adicionar Pergunta (${customQuestions.length} na sala)`}
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {QUIZ_CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setQuizCategory(cat)}
                      className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                        quizCategory === cat
                          ? 'bg-[#6C5CE7] text-white'
                          : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Trivia Question Creator */}
              {showQuestionCreator && (
                <form
                  onSubmit={handleSaveCustomQuestion}
                  className="space-y-3 rounded-2xl border border-[#00CEC9]/30 bg-slate-900/90 p-4"
                >
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#00CEC9]">
                    Nova Pergunta Personalizada para a Sala
                  </h3>
                  <input
                    type="text"
                    value={newQuestionPrompt}
                    onChange={(e) => setNewQuestionPrompt(e.target.value)}
                    placeholder="Enunciado da pergunta..."
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white focus:border-[#00CEC9] focus:outline-none"
                  />
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    <input
                      type="text"
                      value={optionA}
                      onChange={(e) => setOptionA(e.target.value)}
                      placeholder="Alternativa A (Coral)"
                      className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                    />
                    <input
                      type="text"
                      value={optionB}
                      onChange={(e) => setOptionB(e.target.value)}
                      placeholder="Alternativa B (Oceano)"
                      className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                    />
                    <input
                      type="text"
                      value={optionC}
                      onChange={(e) => setOptionC(e.target.value)}
                      placeholder="Alternativa C (Mostarda)"
                      className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                    />
                    <input
                      type="text"
                      value={optionD}
                      onChange={(e) => setOptionD(e.target.value)}
                      placeholder="Alternativa D (Esmeralda)"
                      className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2.5">
                    <div>
                      <label className="mb-1 block text-[11px] text-slate-400">Correta</label>
                      <select
                        value={correctOpt}
                        onChange={(e) => setCorrectOpt(e.target.value as QuizOptionKey)}
                        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-bold text-[#00CEC9]"
                      >
                        <option value="A">Opção A</option>
                        <option value="B">Opção B</option>
                        <option value="C">Opção C</option>
                        <option value="D">Opção D</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] text-slate-400">Dificuldade</label>
                      <select
                        value={newQuestionDifficulty}
                        onChange={(e) =>
                          setNewQuestionDifficulty(e.target.value as 'Fácil' | 'Média' | 'Difícil')
                        }
                        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                      >
                        <option value="Fácil">Fácil</option>
                        <option value="Média">Média</option>
                        <option value="Difícil">Difícil</option>
                      </select>
                    </div>
                    <div className="flex items-end">
                      <button
                        type="submit"
                        disabled={isSavingCustom}
                        className="w-full rounded-xl bg-[#00CEC9] py-2 text-xs font-bold text-slate-950 transition hover:brightness-105 disabled:opacity-50"
                      >
                        {isSavingCustom ? 'Salvando...' : 'Salvar Pergunta'}
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {/* Quiz Difficulty & Parameters */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                  <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
                    <Layers className="h-3.5 w-3.5 text-[#6C5CE7]" />
                    Dificuldade
                  </label>
                  <select
                    value={quizDifficulty}
                    onChange={(e) => setQuizDifficulty(e.target.value as TriviaDifficulty)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                  >
                    {QUIZ_DIFFICULTIES.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                  <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
                    Rodadas
                  </label>
                  <select
                    value={roundCount}
                    onChange={(e) => setRoundCount(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-bold text-white"
                  >
                    <option value={3}>3 Perguntas (Rápido)</option>
                    <option value={5}>5 Perguntas (Padrão)</option>
                    <option value={8}>8 Perguntas (Torneio)</option>
                    <option value={10}>10 Perguntas (Maratona)</option>
                  </select>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                  <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
                    <Clock className="h-3.5 w-3.5 text-[#FDCB6E]" />
                    Tempo por Pergunta
                  </label>
                  <select
                    value={questionSeconds}
                    onChange={(e) => setQuestionSeconds(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-bold text-white"
                  >
                    <option value={10}>10 segundos ( Blitz )</option>
                    <option value={15}>15 segundos ( Padrão )</option>
                    <option value={20}>20 segundos</option>
                    <option value={30}>30 segundos</option>
                  </select>
                </div>
              </div>

              <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/50 px-4 py-3">
                <div>
                  <span className="block text-sm font-semibold text-white">
                    Incluir perguntas personalizadas da sala
                  </span>
                  <span className="text-xs text-slate-400">
                    Combina perguntas criadas pelos membros ({customQuestions.length}) com o banco oficial de 48 questões
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIncludeCustomQuestions((v) => !v)}
                  className={`flex h-6 w-11 items-center rounded-full p-1 transition ${
                    includeCustomQuestions ? 'bg-[#00CEC9]' : 'bg-slate-700'
                  }`}
                >
                  <div
                    className={`h-4 w-4 rounded-full bg-white transition-transform ${
                      includeCustomQuestions ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </label>
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-slate-800/80 bg-[#11131D] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-slate-700 px-5 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-slate-800"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleStart}
            className={`flex items-center gap-2 rounded-2xl px-6 py-2.5 text-sm font-bold text-white shadow-lg transition active:translate-y-0.5 ${
              mode === 'debate'
                ? 'bg-[#FF7675] shadow-[#FF7675]/25 hover:brightness-105'
                : 'bg-[#6C5CE7] shadow-[#6C5CE7]/25 hover:brightness-105'
            }`}
          >
            <Check className="h-4 w-4" />
            {mode === 'debate' ? 'Iniciar Sessão do Tribunal' : 'Iniciar Quiz Relâmpago'}
          </button>
        </div>
      </div>
    </div>
  );
}
