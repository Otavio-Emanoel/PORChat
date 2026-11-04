'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Users,
  Copy,
  Check,
  Shield,
  UserPlus,
  UserMinus,
  RefreshCw,
  LogOut,
  Trophy,
  Save,
  Trash2,
} from 'lucide-react';
import type { Room } from '@/lib/types';

interface GroupDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  room: Room | null;
  currentNickname: string;
  onlineUsers: Array<{ id: string; nickname: string }>;
  onAddMembers?: (members: string[]) => Promise<void>;
  onRemoveMember?: (member: string) => Promise<void>;
  onToggleAdmin?: (member: string) => Promise<void>;
  onUpdateSettings?: (name: string, description: string) => Promise<void>;
  onRegenerateCode?: () => Promise<void>;
  onOpenLeaderboard?: () => void;
  onLeaveRoom?: () => Promise<void>;
  onDeleteRoom?: () => Promise<void>;
}

export function GroupDrawer({
  isOpen,
  onClose,
  room,
  currentNickname,
  onlineUsers,
  onAddMembers,
  onRemoveMember,
  onToggleAdmin,
  onUpdateSettings,
  onRegenerateCode,
  onOpenLeaderboard,
  onLeaveRoom,
  onDeleteRoom,
}: GroupDrawerProps) {
  const [copiedCode, setCopiedCode] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [newMemberInput, setNewMemberInput] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (room) {
      setEditName(room.name || '');
      setEditDesc(room.description || '');
    }
  }, [room]);

  if (!isOpen || !room) return null;

  const members = room.members || [];
  const admins = room.admins || (room.created_by ? [room.created_by] : []);
  const isCurrentUserAdmin =
    room.created_by?.toLowerCase() === currentNickname.toLowerCase() ||
    admins.some((a) => a.toLowerCase() === currentNickname.toLowerCase());

  const handleCopyCode = () => {
    navigator.clipboard.writeText(room.code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onUpdateSettings || !editName.trim()) return;
    setBusy(true);
    setFeedback(null);
    try {
      await onUpdateSettings(editName.trim(), editDesc.trim());
      setFeedback('Dados da conversa atualizados.');
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Erro ao atualizar conversa.');
    } finally {
      setBusy(false);
    }
  };

  const handleAddMemberSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onAddMembers || !newMemberInput.trim()) return;
    setBusy(true);
    setFeedback(null);
    try {
      const names = newMemberInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      await onAddMembers(names);
      setNewMemberInput('');
      setFeedback('Participante adicionado ao grupo.');
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Erro ao adicionar participante.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label="Detalhes da Conversa"
    >
      <div className="flex h-full w-full max-w-md flex-col border-l border-slate-800 bg-[#141722] text-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <Users className="h-5 w-5 text-[#6C5CE7]" />
            <h2 className="font-heading text-base font-bold">
              {room.is_group ? 'Dados e Administração do Grupo' : 'Dados da Conversa Direta'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          {feedback && (
            <div className="rounded-2xl border border-[#00CEC9]/40 bg-[#00CEC9]/10 px-4 py-2.5 text-xs font-medium text-[#00CEC9]">
              {feedback}
            </div>
          )}

          {/* Room Identity & Settings */}
          <form onSubmit={handleSaveSettings} className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Nome {room.is_group ? 'do Grupo' : 'da Conversa'}
              </label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                disabled={!room.is_group}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm font-bold text-white disabled:opacity-60"
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Descrição / Regras da Sala
              </label>
              <textarea
                rows={2}
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                placeholder="Adicione uma descrição para os participantes..."
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs text-white"
              />
            </div>

            {onUpdateSettings && (
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={busy}
                  className="flex items-center gap-1.5 rounded-xl bg-[#6C5CE7] px-4 py-2 text-xs font-bold text-white transition hover:brightness-105 disabled:opacity-50"
                >
                  <Save className="h-3.5 w-3.5" />
                  Salvar Dados
                </button>
              </div>
            )}
          </form>

          {/* Invite PIN Code & Ranking Button */}
          <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Código de Convite / PIN da TV
                </span>
                <span className="font-mono text-lg font-extrabold text-[#FDCB6E]">{room.code}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-bold text-white hover:bg-slate-700"
                >
                  {copiedCode ? <Check className="h-3.5 w-3.5 text-[#00CEC9]" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiedCode ? 'Copiado' : 'Copiar'}
                </button>
                {room.is_group && isCurrentUserAdmin && onRegenerateCode && (
                  <button
                    type="button"
                    onClick={onRegenerateCode}
                    title="Gerar novo código de convite"
                    className="rounded-xl border border-slate-700 bg-slate-800 p-2 text-slate-300 hover:bg-slate-700 hover:text-white"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {onOpenLeaderboard && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenLeaderboard();
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#FDCB6E]/40 bg-[#FDCB6E]/15 py-2.5 text-xs font-extrabold text-[#FDCB6E] transition hover:bg-[#FDCB6E]/25"
              >
                <Trophy className="h-4 w-4" />
                Abrir Ranking & Histórico de Partidas
              </button>
            )}
          </div>

          {/* Add Member to Group */}
          {room.is_group && onAddMembers && (
            <form
              onSubmit={handleAddMemberSubmit}
              className="space-y-2 rounded-2xl border border-slate-800 bg-slate-900/50 p-4"
            >
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Adicionar Participante ao Grupo
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMemberInput}
                  onChange={(e) => setNewMemberInput(e.target.value)}
                  placeholder="Nome de usuário (ex: Pedro, Marina)"
                  className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs text-white"
                />
                <button
                  type="submit"
                  disabled={busy}
                  className="flex items-center gap-1.5 rounded-xl bg-[#00CEC9] px-3.5 py-2 text-xs font-extrabold text-slate-950 hover:brightness-105"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Adicionar
                </button>
              </div>
            </form>
          )}

          {/* Member List with Online Status & Admin Controls */}
          <div>
            <h3 className="mb-2.5 text-xs font-bold uppercase tracking-wider text-slate-400">
              Participantes ({members.length})
            </h3>
            <div className="space-y-2">
              {members.map((member) => {
                const isOnline = onlineUsers.some(
                  (u) => u.nickname.toLowerCase() === member.toLowerCase() || u.id.toLowerCase() === member.toLowerCase()
                );
                const isAdmin =
                  room.created_by?.toLowerCase() === member.toLowerCase() ||
                  admins.some((a) => a.toLowerCase() === member.toLowerCase());
                const isSelf = member.toLowerCase() === currentNickname.toLowerCase();

                return (
                  <div
                    key={member}
                    className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/60 px-3.5 py-2.5"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-[#6C5CE7]/25 font-heading text-xs font-bold text-white">
                        {member.slice(0, 2).toUpperCase()}
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#141722] ${
                            isOnline ? 'bg-[#00CEC9]' : 'bg-slate-600'
                          }`}
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-white">
                            {member} {isSelf && '(Você)'}
                          </span>
                          {isAdmin && (
                            <span className="flex items-center gap-0.5 rounded-md bg-[#6C5CE7]/20 px-1.5 py-0.5 text-[10px] font-bold text-[#6C5CE7]">
                              <Shield className="h-2.5 w-2.5" />
                              Admin
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400">
                          {isOnline ? 'Online agora' : 'Offline'}
                        </span>
                      </div>
                    </div>

                    {room.is_group && isCurrentUserAdmin && !isSelf && (
                      <div className="flex items-center gap-1">
                        {onToggleAdmin && (
                          <button
                            type="button"
                            onClick={() => onToggleAdmin(member)}
                            title={isAdmin ? 'Remover admin' : 'Tornar admin'}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-[#6C5CE7]"
                          >
                            <Shield className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {onRemoveMember && (
                          <button
                            type="button"
                            onClick={() => onRemoveMember(member)}
                            title="Remover do grupo"
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-[#FF7675]"
                          >
                            <UserMinus className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer Leave / Delete */}
        <div className="space-y-2 border-t border-slate-800 bg-[#10121B] p-4">
          {onLeaveRoom && (
            <button
              type="button"
              onClick={onLeaveRoom}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-700 py-2.5 text-xs font-bold text-slate-300 transition hover:bg-slate-800 hover:text-white"
            >
              <LogOut className="h-4 w-4" />
              Sair desta Conversa
            </button>
          )}
          {isCurrentUserAdmin && onDeleteRoom && (
            <button
              type="button"
              onClick={onDeleteRoom}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[#FF7675]/30 bg-[#FF7675]/10 py-2.5 text-xs font-bold text-[#FF7675] transition hover:bg-[#FF7675]/20"
            >
              <Trash2 className="h-4 w-4" />
              Excluir Sala Permanentemente
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
