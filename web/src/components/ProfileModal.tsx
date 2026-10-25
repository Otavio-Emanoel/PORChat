'use client';

import React, { useState } from 'react';
import { X, Sparkles, Smile, Check } from 'lucide-react';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: {
    nickname: string;
    avatar_emoji?: string;
    status_text?: string;
  };
  onSave: (customization: { avatar_emoji: string; status_text: string }) => void;
}

export const AVATAR_OPTIONS = [
  { emoji: '👑', label: 'Líder / Coroa' },
  { emoji: '🦁', label: 'Leão Feroz' },
  { emoji: '🤖', label: 'Robô Dev' },
  { emoji: '🚀', label: 'Foguete' },
  { emoji: '🦊', label: 'Raposa Ágil' },
  { emoji: '⚡', label: 'Raio Veloz' },
  { emoji: '🥑', label: 'Abacate Zen' },
  { emoji: '🎮', label: 'Gamer Pro' },
];

export const STATUS_PRESETS = [
  'Pronto pro debate! ⚔️',
  'Focado no Quiz 🧠',
  'Só observando a treta 🍿',
  'No controle do jogo 📱',
  'Na torcida pelo Lado A 🔥',
  'Café primeiro, argumentos depois ☕',
];

export function ProfileModal({ isOpen, onClose, currentUser, onSave }: ProfileModalProps) {
  const [selectedAvatar, setSelectedAvatar] = useState(currentUser.avatar_emoji || '👑');
  const [statusText, setStatusText] = useState(currentUser.status_text || 'Pronto pro debate! ⚔️');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      avatar_emoji: selectedAvatar,
      status_text: statusText.trim(),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-100 animate-scale-up">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-brand-primary/10 text-brand-primary flex items-center justify-center">
              <Smile className="w-4 h-4" />
            </span>
            <h2 className="font-heading text-lg font-bold text-ink-main">Editar Perfil & Avatar</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-5">
          {/* Avatar Preview */}
          <div className="flex flex-col items-center justify-center">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-brand-primary/20 via-brand-reward/20 to-brand-mint/20 flex items-center justify-center text-4xl shadow-inner border-2 border-brand-primary/30 relative">
              <span>{selectedAvatar}</span>
              <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-brand-primary text-white flex items-center justify-center text-[10px] shadow-xs">
                <Sparkles className="w-3 h-3" />
              </span>
            </div>
            <span className="text-sm font-bold text-ink-main mt-2">{currentUser.nickname}</span>
          </div>

          {/* Select Avatar Emoji */}
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">
              Escolha seu Avatar:
            </label>
            <div className="grid grid-cols-4 gap-2.5">
              {AVATAR_OPTIONS.map((opt) => (
                <button
                  key={opt.emoji}
                  type="button"
                  onClick={() => setSelectedAvatar(opt.emoji)}
                  className={`p-3 rounded-2xl flex flex-col items-center justify-center text-2xl transition-all ${
                    selectedAvatar === opt.emoji
                      ? 'bg-brand-primary/15 border-2 border-brand-primary scale-105 shadow-xs'
                      : 'bg-gray-50 hover:bg-gray-100 border border-gray-200/60'
                  }`}
                  title={opt.label}
                >
                  <span>{opt.emoji}</span>
                  <span className="text-[9px] text-gray-500 font-medium truncate max-w-full mt-1">
                    {opt.label.split(' ')[0]}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Custom Status Text */}
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">
              Mensagem de Status:
            </label>
            <input
              type="text"
              value={statusText}
              onChange={(e) => setStatusText(e.target.value)}
              placeholder="Ex: Focado no Quiz 🧠"
              maxLength={60}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary transition-all"
            />

            {/* Quick Status Presets */}
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {STATUS_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setStatusText(preset)}
                  className="px-2.5 py-1 rounded-full bg-gray-100 hover:bg-gray-200 text-[11px] text-gray-600 transition-all font-medium"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-brand-primary text-white text-xs font-bold hover:bg-brand-primary/90 shadow-xs tactile-btn transition-all"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Salvar Alterações</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
