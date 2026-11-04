'use client';

import React, { useState } from 'react';
import { BarChart3, Check, Lock, Plus, Trash2, X } from 'lucide-react';
import type { ChatPoll } from '@/lib/types';

interface PollBubbleProps {
  messageId: string;
  poll: ChatPoll;
  currentNickname: string;
  onVote: (messageId: string, optionId: string) => void;
  onClosePoll?: (messageId: string) => void;
}

export function PollBubble({
  messageId,
  poll,
  currentNickname,
  onVote,
  onClosePoll,
}: PollBubbleProps) {
  const totalVotes = poll.options.reduce((acc, opt) => acc + (opt.voter_ids?.length || 0), 0);
  const canClose =
    !poll.is_closed &&
    poll.created_by.toLowerCase() === currentNickname.toLowerCase() &&
    Boolean(onClosePoll);

  return (
    <div className="mt-1 w-full min-w-[260px] max-w-md rounded-2xl border border-slate-700/80 bg-[#151824] p-4 text-white shadow-inner">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#00CEC9]">
          <BarChart3 className="h-3.5 w-3.5" />
          {poll.multi_select ? 'Enquete Múltipla Escolha' : 'Enquete da Sala'}
        </span>
        {poll.is_closed ? (
          <span className="flex items-center gap-1 rounded-lg bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-400">
            <Lock className="h-3 w-3" />
            Encerrada
          </span>
        ) : (
          <span className="rounded-lg bg-[#00CEC9]/15 px-2 py-0.5 text-[10px] font-bold text-[#00CEC9]">
            Ativa
          </span>
        )}
      </div>

      <h4 className="mb-3 font-heading text-sm font-bold leading-snug text-white">
        {poll.question}
      </h4>

      <div className="space-y-2">
        {poll.options.map((opt) => {
          const votes = opt.voter_ids?.length || 0;
          const pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
          const hasVoted = (opt.voter_ids || []).some(
            (v) => v.toLowerCase() === currentNickname.toLowerCase()
          );

          return (
            <button
              key={opt.id}
              type="button"
              disabled={poll.is_closed}
              onClick={() => onVote(messageId, opt.id)}
              className={`relative w-full overflow-hidden rounded-xl border p-2.5 text-left transition ${
                hasVoted
                  ? 'border-[#00CEC9] bg-[#00CEC9]/10'
                  : 'border-slate-800 bg-slate-900/70 hover:border-slate-700'
              } ${poll.is_closed ? 'cursor-default opacity-90' : 'active:scale-[0.99]'}`}
            >
              <div
                className={`absolute inset-y-0 left-0 transition-all duration-300 ${
                  hasVoted ? 'bg-[#00CEC9]/20' : 'bg-[#6C5CE7]/20'
                }`}
                style={{ width: `${pct}%` }}
              />
              <div className="relative flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 font-semibold text-white">
                  <span
                    className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                      hasVoted
                        ? 'border-[#00CEC9] bg-[#00CEC9] text-slate-950'
                        : 'border-slate-600'
                    }`}
                  >
                    {hasVoted && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                  </span>
                  <span>{opt.label}</span>
                </div>
                <span className="font-bold text-slate-300">
                  {pct}% ({votes})
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-slate-800/80 pt-2.5 text-[11px] text-slate-400">
        <span>
          {totalVotes} {totalVotes === 1 ? 'voto computado' : 'votos computados'}
        </span>
        {canClose && (
          <button
            type="button"
            onClick={() => onClosePoll?.(messageId)}
            className="font-semibold text-[#FF7675] hover:underline"
          >
            Encerrar enquete
          </button>
        )}
      </div>
    </div>
  );
}

interface CreatePollModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitPoll: (question: string, options: string[], multiSelect: boolean) => void;
}

export function CreatePollModal({ isOpen, onClose, onSubmitPoll }: CreatePollModalProps) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [multiSelect, setMultiSelect] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleOptionChange = (index: number, value: string) => {
    setOptions((prev) => prev.map((item, i) => (i === index ? value : item)));
  };

  const handleAddOption = () => {
    if (options.length >= 6) return;
    setOptions((prev) => [...prev, '']);
  };

  const handleRemoveOption = (index: number) => {
    if (options.length <= 2) return;
    setOptions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanQ = question.trim();
    const cleanOpts = options.map((o) => o.trim()).filter(Boolean);
    if (cleanQ.length < 3) {
      setError('Digite uma pergunta para a enquete.');
      return;
    }
    if (cleanOpts.length < 2) {
      setError('Informe pelo menos 2 opções distintas.');
      return;
    }
    onSubmitPoll(cleanQ, cleanOpts, multiSelect);
    setQuestion('');
    setOptions(['', '']);
    setMultiSelect(false);
    setError(null);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Criar Enquete"
    >
      <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-[#161925] p-6 text-white shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#00CEC9]/20 text-[#00CEC9]">
              <BarChart3 className="h-5 w-5" />
            </div>
            <h2 className="font-heading text-lg font-bold">Nova Enquete no Grupo</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-xl border border-[#FF7675]/40 bg-[#FF7675]/10 px-3 py-2 text-xs text-[#FF7675]">
              {error}
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-400">
              Pergunta da Enquete
            </label>
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ex: Qual tema vamos debater hoje à noite?"
              className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white focus:border-[#00CEC9] focus:outline-none"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Opções de Voto
              </label>
              {options.length < 6 && (
                <button
                  type="button"
                  onClick={handleAddOption}
                  className="flex items-center gap-1 text-xs font-bold text-[#00CEC9] hover:underline"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Adicionar opção
                </button>
              )}
            </div>
            {options.map((opt, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="text"
                  value={opt}
                  onChange={(e) => handleOptionChange(idx, e.target.value)}
                  placeholder={`Opção ${idx + 1}`}
                  className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-white focus:border-[#00CEC9] focus:outline-none"
                />
                {options.length > 2 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveOption(idx)}
                    className="rounded-xl p-2 text-slate-500 hover:bg-slate-800 hover:text-[#FF7675]"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-2.5">
            <span className="text-xs font-semibold text-slate-300">
              Permitir votar em mais de uma opção
            </span>
            <input
              type="checkbox"
              checked={multiSelect}
              onChange={(e) => setMultiSelect(e.target.checked)}
              className="h-4 w-4 accent-[#00CEC9]"
            />
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-slate-700 px-4 py-2 text-xs font-bold text-slate-300 hover:bg-slate-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="rounded-2xl bg-[#00CEC9] px-5 py-2 text-xs font-bold text-slate-950 shadow-lg shadow-[#00CEC9]/20 hover:brightness-105"
            >
              Publicar Enquete
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
