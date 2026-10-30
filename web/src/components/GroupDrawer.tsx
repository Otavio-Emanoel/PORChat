'use client';

import React from 'react';
import { X, Users, Copy, Check, LogOut, Trash2, Bell, BellOff, ShieldCheck } from 'lucide-react';

interface GroupDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  roomName: string;
  roomCode?: string;
  isGroup: boolean;
  members: string[];
  onlineUsers: Array<{ id: string; nickname: string }>;
  createdBy?: string;
  createdAt?: string;
  onLeave: () => void;
  onDelete: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
}

export function GroupDrawer({
  isOpen,
  onClose,
  roomName,
  roomCode,
  isGroup,
  members,
  onlineUsers,
  createdBy,
  createdAt,
  onLeave,
  onDelete,
  isMuted,
  onToggleMute,
}: GroupDrawerProps) {
  const [copied, setCopied] = React.useState(false);

  if (!isOpen) return null;

  const handleCopyCode = () => {
    if (!roomCode) return;
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getMonogram = (name: string) => {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden font-body animate-in fade-in duration-200">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      <div className="absolute inset-y-0 right-0 max-w-sm w-full bg-white shadow-2xl flex flex-col justify-between border-l border-gray-200 animate-in slide-in-from-right duration-300">
        <div>
          {/* Header */}
          <div className="p-4 bg-[#F0F2F5] border-b border-gray-200 flex items-center justify-between">
            <h3 className="font-heading font-bold text-sm text-ink-main">
              {isGroup ? 'Dados do Grupo' : 'Dados do Contato'}
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-gray-200 text-gray-500 hover:text-gray-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 overflow-y-auto max-h-[calc(100vh-140px)] space-y-6">
            {/* Group Banner / Avatar */}
            <div className="flex flex-col items-center text-center">
              <div className="w-24 h-24 rounded-3xl bg-brand-primary text-white font-heading font-extrabold text-3xl flex items-center justify-center shadow-md mb-3">
                {isGroup ? <Users className="w-10 h-10" /> : getMonogram(roomName)}
              </div>
              <h2 className="font-heading text-xl font-bold text-ink-main leading-tight">
                {roomName}
              </h2>
              <span className="text-xs text-gray-400 mt-1">
                {isGroup ? `Grupo • ${members.length} participantes` : 'Conversa Privada'}
              </span>
            </div>

            {/* PIN Code Card */}
            {roomCode && (
              <div className="p-4 rounded-2xl bg-[#F0F2F5] border border-gray-200 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                    Código de Convite
                  </span>
                  <span className="font-mono font-bold text-sm text-ink-main tracking-widest">
                    {roomCode}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="px-3 py-1.5 rounded-xl bg-white hover:bg-gray-100 border border-gray-200 text-xs font-bold text-ink-main flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copiado!' : 'Copiar'}</span>
                </button>
              </div>
            )}

            {/* Mute Notifications Toggle */}
            <div className="flex items-center justify-between p-3 rounded-2xl hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center text-gray-600">
                  {isMuted ? <BellOff className="w-4 h-4 text-amber-600" /> : <Bell className="w-4 h-4" />}
                </div>
                <div>
                  <span className="text-xs font-bold text-ink-main block">Silenciar Notificações</span>
                  <span className="text-[10px] text-gray-400 block">
                    {isMuted ? 'Notificações silenciadas' : 'Receber alertas sonoros'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={onToggleMute}
                className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                  isMuted ? 'bg-brand-primary' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full bg-white shadow-xs absolute top-0.5 transition-transform ${
                    isMuted ? 'right-0.5' : 'left-0.5'
                  }`}
                />
              </button>
            </div>

            {/* Members Section */}
            {isGroup && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                    Participantes ({members.length})
                  </span>
                  <span className="text-[10px] text-emerald-600 font-bold">
                    {onlineUsers.length} online
                  </span>
                </div>

                <div className="divide-y divide-gray-100 border border-gray-100 rounded-2xl overflow-hidden bg-gray-50/50">
                  {members.map((member) => {
                    const isOnline = onlineUsers.some((u) => u.nickname === member);
                    const isCreator = createdBy && createdBy.toLowerCase() === member.toLowerCase();
                    return (
                      <div
                        key={member}
                        className="p-3 flex items-center justify-between bg-white hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="relative">
                            <div className="w-8 h-8 rounded-full bg-brand-primary/10 text-brand-primary font-bold text-xs flex items-center justify-center">
                              {member[0].toUpperCase()}
                            </div>
                            {isOnline && (
                              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white absolute -bottom-0.5 -right-0.5" />
                            )}
                          </div>
                          <div>
                            <span className="text-xs font-bold text-ink-main block">{member}</span>
                            <span className="text-[10px] text-gray-400 block">
                              {isOnline ? 'Online agora' : 'Ausente'}
                            </span>
                          </div>
                        </div>

                        {isCreator && (
                          <span className="px-2 py-0.5 rounded bg-brand-primary/10 text-brand-primary text-[9px] font-bold uppercase">
                            Admin
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Privacy notice */}
            <div className="p-3 rounded-2xl bg-emerald-50/60 border border-emerald-200/50 flex items-start gap-2.5 text-xs text-emerald-800">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span className="text-[11px] leading-tight">
                Todas as conversas e mídias trocadas neste grupo são restritas aos participantes autorizados.
              </span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-[#F0F2F5] border-t border-gray-200 space-y-2">
          <button
            type="button"
            onClick={onLeave}
            className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-gray-100 text-gray-700 text-xs font-bold border border-gray-200 flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4 text-gray-500" />
            <span>Sair do Grupo</span>
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="w-full py-2.5 px-4 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold border border-red-200/60 flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <Trash2 className="w-4 h-4 text-red-500" />
            <span>Excluir Grupo Permanentemente</span>
          </button>
        </div>
      </div>
    </div>
  );
}
