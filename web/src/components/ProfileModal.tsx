'use client';

import React, { useEffect, useState } from 'react';
import { X, Check, User as UserIcon, Lock, Trophy, Target, Flame, Scale, Zap } from 'lucide-react';
import type { PlayerCareerStats } from '@/lib/types';
import {
  updateUserProfile,
  changeUserPassword,
  fetchPlayerCareerStats,
} from '@/lib/apiClient';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: {
    id?: string;
    nickname: string;
    avatar_color?: string;
    status_text?: string;
    bio?: string;
  };
  onSave: (customization: {
    nickname?: string;
    avatar_color: string;
    status_text: string;
    bio?: string;
  }) => void;
}

export const AVATAR_COLOR_OPTIONS = [
  { id: 'violet', bg: '#6C5CE7', label: 'Violeta' },
  { id: 'coral', bg: '#FF7675', label: 'Coral' },
  { id: 'mint', bg: '#00CEC9', label: 'Menta' },
  { id: 'amber', bg: '#F59E0B', label: 'Âmbar' },
  { id: 'blue', bg: '#3B82F6', label: 'Azul' },
  { id: 'emerald', bg: '#10B981', label: 'Esmeralda' },
  { id: 'indigo', bg: '#6366F1', label: 'Índigo' },
  { id: 'slate', bg: '#475569', label: 'Grafite' },
];

export const STATUS_PRESETS = [
  'Disponível no PORChat',
  'Pronto para o próximo debate',
  'Online no controle mobile',
  'No comando do Modo TV',
  'Em reunião',
  'Apenas mensagens',
];

export function ProfileModal({ isOpen, onClose, currentUser, onSave }: ProfileModalProps) {
  const [tab, setTab] = useState<'profile' | 'security' | 'career'>('profile');
  const [selectedColor, setSelectedColor] = useState(currentUser.avatar_color || '#6C5CE7');
  const [statusText, setStatusText] = useState(currentUser.status_text || 'Disponível no PORChat');
  const [bio, setBio] = useState(currentUser.bio || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [careerStats, setCareerStats] = useState<PlayerCareerStats | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedColor(currentUser.avatar_color || '#6C5CE7');
    setStatusText(currentUser.status_text || 'Disponível no PORChat');
    setBio(currentUser.bio || '');
    setFeedback(null);
    fetchPlayerCareerStats(currentUser.nickname).then((st) => setCareerStats(st));
  }, [isOpen, currentUser]);

  if (!isOpen) return null;

  const getMonogram = (name: string) => {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      await updateUserProfile({
        avatar_color: selectedColor,
        status_text: statusText.trim(),
        bio: bio.trim(),
      });
    } catch {
      // Fallback to local callback if unauthenticated guest session
    } finally {
      onSave({
        avatar_color: selectedColor,
        status_text: statusText.trim(),
        bio: bio.trim(),
      });
      setSaving(false);
      onClose();
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || newPassword.length < 6) {
      setFeedback({ type: 'err', text: 'A nova senha deve ter no mínimo 6 caracteres.' });
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      await changeUserPassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setFeedback({
        type: 'ok',
        text: 'Senha atualizada com sucesso e sessões anteriores revogadas.',
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Erro ao atualizar senha.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label="Perfil e Conta"
    >
      <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-slate-800 bg-[#161925] text-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#6C5CE7]/20 text-[#6C5CE7]">
              <UserIcon className="h-4 w-4" />
            </span>
            <h2 className="font-heading text-lg font-bold">Conta, Perfil & Carreira</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="grid grid-cols-3 gap-2 border-b border-slate-800 bg-[#11131D] px-6 py-2.5">
          <button
            type="button"
            onClick={() => setTab('profile')}
            className={`rounded-xl py-2 text-xs font-bold transition ${
              tab === 'profile' ? 'bg-[#6C5CE7] text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Perfil & Status
          </button>
          <button
            type="button"
            onClick={() => setTab('career')}
            className={`rounded-xl py-2 text-xs font-bold transition ${
              tab === 'career' ? 'bg-[#FDCB6E] text-slate-950' : 'text-slate-400 hover:text-white'
            }`}
          >
            Estatísticas
          </button>
          <button
            type="button"
            onClick={() => setTab('security')}
            className={`rounded-xl py-2 text-xs font-bold transition ${
              tab === 'security' ? 'bg-[#00CEC9] text-slate-950' : 'text-slate-400 hover:text-white'
            }`}
          >
            Segurança
          </button>
        </div>

        <div className="p-6">
          {feedback && (
            <div
              className={`mb-4 rounded-2xl border px-4 py-2.5 text-xs font-semibold ${
                feedback.type === 'ok'
                  ? 'border-[#00CEC9]/40 bg-[#00CEC9]/10 text-[#00CEC9]'
                  : 'border-[#FF7675]/40 bg-[#FF7675]/10 text-[#FF7675]'
              }`}
            >
              {feedback.text}
            </div>
          )}

          {tab === 'profile' ? (
            <form onSubmit={handleProfileSubmit} className="space-y-4">
              <div className="flex items-center gap-4">
                <div
                  className="flex h-16 w-16 items-center justify-center rounded-3xl font-heading text-xl font-black text-white shadow-lg"
                  style={{ backgroundColor: selectedColor }}
                >
                  {getMonogram(currentUser.nickname)}
                </div>
                <div>
                  <h3 className="font-heading text-base font-bold text-white">
                    {currentUser.nickname}
                  </h3>
                  <p className="text-xs text-slate-400">{statusText}</p>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">
                  Cor do Avatar
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {AVATAR_COLOR_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSelectedColor(opt.bg)}
                      className={`flex items-center gap-2 rounded-xl border p-2 text-xs font-semibold transition ${
                        selectedColor === opt.bg
                          ? 'border-[#6C5CE7] bg-slate-800 text-white'
                          : 'border-slate-800 bg-slate-900/50 text-slate-400 hover:text-white'
                      }`}
                    >
                      <span
                        className="h-4 w-4 rounded-full"
                        style={{ backgroundColor: opt.bg }}
                      />
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">
                  Recado / Status Atual
                </label>
                <input
                  type="text"
                  value={statusText}
                  onChange={(e) => setStatusText(e.target.value)}
                  maxLength={100}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-white"
                />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {STATUS_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setStatusText(preset)}
                      className="rounded-lg bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-300 hover:bg-slate-700"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">
                  Biografia
                </label>
                <textarea
                  rows={2}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Conte um pouco sobre você..."
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-bold text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-1.5 rounded-xl bg-[#6C5CE7] px-5 py-2 text-xs font-bold text-white"
                >
                  <Check className="h-3.5 w-3.5" />
                  {saving ? 'Salvando...' : 'Salvar Perfil'}
                </button>
              </div>
            </form>
          ) : tab === 'career' ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3.5">
                  <span className="flex items-center gap-1.5 text-[11px] font-bold text-[#FDCB6E]">
                    <Trophy className="h-3.5 w-3.5" />
                    Pontuação Total
                  </span>
                  <div className="mt-1 font-heading text-xl font-extrabold text-white">
                    {(careerStats?.total_points ?? 0).toLocaleString('pt-BR')}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3.5">
                  <span className="flex items-center gap-1.5 text-[11px] font-bold text-[#FF7675]">
                    <Scale className="h-3.5 w-3.5" />
                    Tribunal (Vitórias)
                  </span>
                  <div className="mt-1 font-heading text-xl font-extrabold text-white">
                    {careerStats?.debates_won ?? 0} / {careerStats?.debates_played ?? 0}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3.5">
                  <span className="flex items-center gap-1.5 text-[11px] font-bold text-[#6C5CE7]">
                    <Zap className="h-3.5 w-3.5" />
                    Quiz (1º Lugar)
                  </span>
                  <div className="mt-1 font-heading text-xl font-extrabold text-white">
                    {careerStats?.quiz_wins ?? 0} / {careerStats?.quizzes_played ?? 0}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3.5">
                  <span className="flex items-center gap-1.5 text-[11px] font-bold text-[#00CEC9]">
                    <Target className="h-3.5 w-3.5" />
                    Precisão no Quiz
                  </span>
                  <div className="mt-1 font-heading text-xl font-extrabold text-white">
                    {careerStats?.accuracy_percent ?? 0}%
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3.5">
                  <span className="flex items-center gap-1.5 text-[11px] font-bold text-[#FDCB6E]">
                    <Flame className="h-3.5 w-3.5" />
                    Maior Streak
                  </span>
                  <div className="mt-1 font-heading text-xl font-extrabold text-white">
                    {careerStats?.best_streak ?? 0}x
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3.5">
                  <span className="text-[11px] font-bold text-slate-400">Resposta Mais Rápida</span>
                  <div className="mt-1 font-heading text-xl font-extrabold text-white">
                    {careerStats?.fastest_answer_ms ? `${careerStats.fastest_answer_ms} ms` : '—'}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
                  <Lock className="h-3.5 w-3.5 text-[#00CEC9]" />
                  Senha Atual
                </label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white"
                />
              </div>
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
                  <Lock className="h-3.5 w-3.5 text-[#00CEC9]" />
                  Nova Senha (mín. 6 caracteres)
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white"
                />
              </div>
              <p className="text-[11px] text-slate-400">
                Ao rotacionar sua senha, todos os tokens JWT emitidos anteriormente são automaticamente revogados na blacklist do servidor.
              </p>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-[#00CEC9] px-5 py-2.5 text-xs font-extrabold text-slate-950 transition hover:brightness-105"
                >
                  {saving ? 'Atualizando...' : 'Rotacionar Senha'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
