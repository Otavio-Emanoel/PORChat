'use client';

import React from 'react';
import Link from 'next/link';
import {
  Check,
  Clock,
  Copy,
  LogOut,
  MoreVertical,
  Pause,
  Play,
  Search,
  ShieldCheck,
  SkipForward,
  Swords,
  Trash2,
  Trophy,
  Tv,
  Users,
  Volume2,
  VolumeX,
  XOctagon,
  Zap,
} from 'lucide-react';
import type { GameStateUpdatePayload, Room } from '@/lib/types';

interface RoomHeaderProps {
  roomId: string;
  roomInfo: Room | null;
  onlineCount: number;
  latency: number | null;
  copied: boolean;
  isMuted: boolean;
  isSearchingMessages: boolean;
  isGameActive: boolean;
  gameState: GameStateUpdatePayload | null;
  isRoomMenuOpen: boolean;
  onOpenDrawer: () => void;
  onCopyInvite: () => void;
  onToggleMute: () => void;
  onOpenLeaderboard: () => void;
  onOpenCommandPalette: () => void;
  onToggleSearch: () => void;
  onOpenGameSetup: (mode: 'debate' | 'quiz') => void;
  onPauseGame: () => void;
  onResumeGame: () => void;
  onSkipPhase: () => void;
  onAbortGame: () => void;
  onToggleRoomMenu: () => void;
  onCloseRoomMenu: () => void;
  onOpenSecurityAudit: () => void;
  onLeaveRoom: () => void;
  onDeleteRoom: () => void;
}

/**
 * Top bar for the active conversation with room metadata, game host controls, and room menu.
 */
export const RoomHeader: React.FC<RoomHeaderProps> = ({
  roomId,
  roomInfo,
  onlineCount,
  latency,
  copied,
  isMuted,
  isSearchingMessages,
  isGameActive,
  gameState,
  isRoomMenuOpen,
  onOpenDrawer,
  onCopyInvite,
  onToggleMute,
  onOpenLeaderboard,
  onOpenCommandPalette,
  onToggleSearch,
  onOpenGameSetup,
  onPauseGame,
  onResumeGame,
  onSkipPhase,
  onAbortGame,
  onToggleRoomMenu,
  onCloseRoomMenu,
  onOpenSecurityAudit,
  onLeaveRoom,
  onDeleteRoom,
}) => {
  return (
    <header className="h-16 px-4 bg-[#F0F2F5] border-b border-gray-200 flex items-center justify-between z-10 shadow-xs">
      <div
        onClick={onOpenDrawer}
        className="flex items-center gap-3 cursor-pointer group"
        title="Toque para ver membros, administração e detalhes"
      >
        <div
          className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white font-heading font-bold text-base shadow-xs group-hover:scale-105 transition-transform ${
            roomInfo?.is_group
              ? 'bg-gradient-to-br from-brand-primary to-purple-800'
              : 'bg-brand-action'
          }`}
        >
          {roomInfo?.is_group ? (
            <Users className="w-5 h-5" />
          ) : (
            roomInfo?.name[0].toUpperCase() || 'P'
          )}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-heading text-base font-bold text-ink-main tracking-tight leading-none group-hover:text-brand-primary transition-colors">
              {roomInfo?.name || 'Conversa'}
            </h2>
            {roomInfo?.code && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCopyInvite();
                }}
                className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-gray-200 text-gray-600 text-[10px] font-mono font-bold hover:bg-gray-50 transition-all"
                title="Copiar código de convite"
              >
                <span>{roomInfo.code}</span>
                {copied ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
              </button>
            )}
          </div>
          <div className="text-[11px] text-gray-500 flex items-center gap-2 mt-0.5">
            <span>
              {roomInfo?.is_group
                ? `${onlineCount} online • ${roomInfo.members?.length || 1} membros`
                : `${onlineCount} participante online`}
            </span>
            {latency !== null && (
              <span
                className="text-[10px] font-mono text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200/50 hidden sm:inline"
                title="Latência WebSocket com o servidor"
              >
                {latency}ms
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Header Action Buttons */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleMute}
          className={`p-2 rounded-xl border border-gray-200 transition-all tactile-btn ${
            isMuted
              ? 'bg-amber-50 text-amber-600 border-amber-200'
              : 'bg-white hover:bg-gray-100 text-gray-600'
          }`}
          title={isMuted ? 'Ativar sons de notificações' : 'Silenciar notificações'}
        >
          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>

        <button
          type="button"
          onClick={onOpenLeaderboard}
          className="p-2 rounded-xl bg-white hover:bg-amber-50 text-amber-600 border border-gray-200 transition-all tactile-btn"
          title="Ranking e Histórico de Partidas da Sala"
        >
          <Trophy className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white hover:bg-gray-100 text-ink-muted border border-gray-200 text-xs font-mono font-bold transition-all shadow-2xs tactile-btn"
          title="Abrir Command Palette (Cmd+K ou Ctrl+K)"
        >
          <kbd className="text-[10px] bg-gray-100 px-1 py-0.5 rounded border border-gray-200">Ctrl+K</kbd>
        </button>

        <button
          type="button"
          onClick={onToggleSearch}
          title="Buscar mensagens nesta conversa"
          className={`p-2 rounded-xl transition-all tactile-btn ${
            isSearchingMessages
              ? 'bg-brand-primary text-white shadow-xs'
              : 'bg-white hover:bg-gray-100 text-gray-600 border border-gray-200'
          }`}
        >
          <Search className="w-4 h-4" />
        </button>

        {roomInfo?.is_group && (
          <>
            {isGameActive && gameState ? (
              <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-xl shadow-2xs border border-gray-200">
                <span className="text-[10px] font-bold text-brand-action uppercase mr-1 flex items-center gap-1">
                  <Clock className="w-3 h-3 animate-spin" />
                  {gameState.phase}
                </span>
                <button
                  type="button"
                  onClick={onPauseGame}
                  title="Pausar Temporizador"
                  className="p-1 hover:bg-gray-100 rounded-md text-gray-600 hover:text-ink-main"
                >
                  <Pause className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={onResumeGame}
                  title="Retomar Temporizador"
                  className="p-1 hover:bg-gray-100 rounded-md text-gray-600 hover:text-ink-main"
                >
                  <Play className="w-3.5 h-3.5 text-green-600" />
                </button>
                <button
                  type="button"
                  onClick={onSkipPhase}
                  title="Pular para Próxima Fase"
                  className="p-1 hover:bg-gray-100 rounded-md text-gray-600 hover:text-brand-primary"
                >
                  <SkipForward className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={onAbortGame}
                  title="Encerrar Partida"
                  className="p-1 hover:bg-red-50 rounded-md text-red-500 hover:text-red-700"
                >
                  <XOctagon className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => onOpenGameSetup('debate')}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-brand-action text-white text-xs font-bold hover:bg-brand-action/90 shadow-xs tactile-btn transition-all"
                >
                  <Swords className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Debate</span>
                </button>

                <button
                  type="button"
                  onClick={() => onOpenGameSetup('quiz')}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-brand-primary text-white text-xs font-bold hover:bg-brand-primary/90 shadow-xs tactile-btn transition-all"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Quiz</span>
                </button>
              </>
            )}

            <Link
              href={`/tv/${roomId}`}
              target="_blank"
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-surface-tv text-white text-xs font-bold hover:bg-surface-tv/90 shadow-xs tactile-btn transition-all"
            >
              <Tv className="w-3.5 h-3.5 text-brand-reward" />
              <span className="hidden sm:inline">Telão (TV)</span>
            </Link>
          </>
        )}

        {/* Room Options Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={onToggleRoomMenu}
            className="p-2 rounded-xl bg-white hover:bg-gray-100 text-gray-600 border border-gray-200 transition-all tactile-btn"
            title="Opções da Sala"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {isRoomMenuOpen && (
            <div className="absolute right-0 top-11 w-52 bg-white rounded-2xl shadow-xl border border-gray-100 p-1.5 z-50 animate-pop-in text-xs font-bold">
              <button
                type="button"
                onClick={() => {
                  onCloseRoomMenu();
                  onOpenLeaderboard();
                }}
                className="w-full flex items-center gap-2 p-2 rounded-xl hover:bg-amber-50 text-amber-700 transition-colors text-left"
              >
                <Trophy className="w-3.5 h-3.5 text-amber-500" />
                <span>Ranking & Histórico</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onCloseRoomMenu();
                  onOpenSecurityAudit();
                }}
                className="w-full flex items-center gap-2 p-2 rounded-xl hover:bg-emerald-50 text-emerald-800 transition-colors text-left"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Segurança & Exportar</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onCloseRoomMenu();
                  onLeaveRoom();
                }}
                className="w-full flex items-center gap-2 p-2 rounded-xl hover:bg-gray-50 text-gray-700 transition-colors text-left"
              >
                <LogOut className="w-3.5 h-3.5 text-gray-400" />
                <span>Sair da Sala</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onCloseRoomMenu();
                  onDeleteRoom();
                }}
                className="w-full flex items-center gap-2 p-2 rounded-xl hover:bg-red-50 text-red-600 transition-colors text-left"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-500" />
                <span>Excluir Sala</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
