'use client';

import React, { useState } from 'react';
import { X, Check, User as UserIcon } from 'lucide-react';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: {
    nickname: string;
    avatar_color?: string;
    status_text?: string;
  };
  onSave: (customization: { avatar_color: string; status_text: string }) => void;
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
  'Disponível',
  'Em reunião',
  'Ocupado',
  'No computador',
  'Apenas mensagens',
  'Ausente',
];

export function ProfileModal({ isOpen, onClose, currentUser, onSave }: ProfileModalProps) {
  const [selectedColor, setSelectedColor] = useState(currentUser.avatar_color || '#6C5CE7');
  const [statusText, setStatusText] = useState(currentUser.status_text || 'Disponível');

  if (!isOpen) return null;

  const getMonogram = (name: string) => {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      avatar_color: selectedColor,
      status_text: statusText.trim(),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200 font-body">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-100 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-brand-primary/10 text-brand-primary flex items-center justify-center">
              <UserIcon className="w-4 h-4" />
            </span>
            <h2 className="font-heading text-lg font-bold text-ink-main">Editar Perfil & Status</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-5">
          {/* Avatar Preview */}
          <div className="flex flex-col items-center justify-center">
            <div
              className="w-20 h-20 rounded-3xl flex items-center justify-center text-white text-2xl font-heading font-black shadow-md border-2 border-white relative transition-colors"
              style={{ backgroundColor: selectedColor }}
            >
              <span>{getMonogram(currentUser.nickname)}</span>
              <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-white text-emerald-600 flex items-center justify-center text-[10px] shadow-xs border border-gray-100">
                <Check className="w-3.5 h-3.5" />
              </span>
            </div>
            <span className="text-sm font-bold text-ink-main mt-2">{currentUser.nickname}</span>
          </div>

          {/* Select Avatar Color Theme */}
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">
              Cor do Avatar:
            </label>
            <div className="grid grid-cols-4 gap-2.5">
              {AVATAR_COLOR_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSelectedColor(opt.bg)}
                  className={`p-3 rounded-2xl flex flex-col items-center justify-center transition-all cursor-pointer ${
                    selectedColor === opt.bg
                      ? 'border-2 border-brand-primary scale-105 shadow-xs bg-gray-50'
                      : 'bg-gray-50 hover:bg-gray-100 border border-gray-200/60'
                  }`}
                  title={opt.label}
                >
                  <span
                    className="w-6 h-6 rounded-full shadow-2xs block"
                    style={{ backgroundColor: opt.bg }}
                  />
                  <span className="text-[10px] text-gray-600 font-bold mt-1.5">
                    {opt.label}
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
              placeholder="Ex: Disponível para contato"
              maxLength={60}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary transition-all font-medium"
            />

            {/* Quick Status Presets */}
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {STATUS_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setStatusText(preset)}
                  className="px-2.5 py-1 rounded-full bg-gray-100 hover:bg-gray-200 text-[11px] text-gray-600 transition-all font-semibold cursor-pointer"
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
              className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition-all cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-brand-primary text-white text-xs font-bold hover:bg-brand-primary/90 shadow-xs tactile-btn transition-all cursor-pointer"
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
