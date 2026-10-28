'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Tv,
  Swords,
  Zap,
  Copy,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Home,
  Check,
} from 'lucide-react';

export interface CommandItem {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  category: 'Ações Rápidas' | 'Navegação' | 'Jogos' | 'Configurações';
  action: () => void;
  shortcut?: string;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  roomId?: string;
  roomCode?: string;
  onStartDebate?: () => void;
  onStartQuiz?: () => void;
  onToggleSound?: () => void;
  isMuted?: boolean;
}

export function CommandPalette({
  isOpen,
  onClose,
  roomId,
  roomCode,
  onStartDebate,
  onStartQuiz,
  onToggleSound,
  isMuted,
}: CommandPaletteProps) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleCopyCode = () => {
    if (roomCode && navigator.clipboard) {
      navigator.clipboard.writeText(roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const commands: CommandItem[] = [
    ...(roomId
      ? [
          {
            id: 'open-tv',
            label: 'Abrir Palco no Telão (TV Mode)',
            description: 'Transmitir placar, temporizador e gráficos no telão',
            icon: <Tv className="w-4 h-4 text-brand-reward" />,
            category: 'Navegação' as const,
            action: () => {
              router.push(`/tv/${roomId}`);
              onClose();
            },
            shortcut: 'TV',
          },
        ]
      : []),
    ...(onStartDebate
      ? [
          {
            id: 'start-debate',
            label: 'Iniciar O Tribunal (Modo Debate)',
            description: 'Sorteia debatedores e abre rodadas de argumentos e votos',
            icon: <Swords className="w-4 h-4 text-brand-action" />,
            category: 'Jogos' as const,
            action: () => {
              onStartDebate();
              onClose();
            },
            shortcut: '⚔️',
          },
        ]
      : []),
    ...(onStartQuiz
      ? [
          {
            id: 'start-quiz',
            label: 'Iniciar Quiz Relâmpago (Trivia)',
            description: 'Perguntas multiplayer sincronizadas com contagem regressiva',
            icon: <Zap className="w-4 h-4 text-brand-mint" />,
            category: 'Jogos' as const,
            action: () => {
              onStartQuiz();
              onClose();
            },
            shortcut: '⚡',
          },
        ]
      : []),
    ...(roomCode
      ? [
          {
            id: 'copy-pin',
            label: copied ? 'Código PIN Copiado!' : `Copiar Código da Sala (${roomCode})`,
            description: 'Compartilhe com seus amigos para entrada rápida',
            icon: copied ? (
              <Check className="w-4 h-4 text-brand-mint" />
            ) : (
              <Copy className="w-4 h-4 text-white/70" />
            ),
            category: 'Ações Rápidas' as const,
            action: handleCopyCode,
            shortcut: 'PIN',
          },
        ]
      : []),
    ...(onToggleSound
      ? [
          {
            id: 'toggle-sound',
            label: isMuted ? 'Ativar Efeitos Sonoros' : 'Silenciar Efeitos Sonoros',
            description: 'Efeitos de contagem regressiva, votos e vitória',
            icon: isMuted ? (
              <VolumeX className="w-4 h-4 text-brand-action" />
            ) : (
              <Volume2 className="w-4 h-4 text-brand-mint" />
            ),
            category: 'Configurações' as const,
            action: () => {
              onToggleSound();
              onClose();
            },
          },
        ]
      : []),
    {
      id: 'toggle-fullscreen',
      label: 'Alternar Tela Cheia',
      description: 'Expandir a visão para monitores ou projetores',
      icon: <Maximize2 className="w-4 h-4 text-white/70" />,
      category: 'Configurações' as const,
      action: () => {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen().catch(() => {});
        }
        onClose();
      },
      shortcut: 'F11',
    },
    {
      id: 'go-home',
      label: 'Voltar para a Página Inicial',
      description: 'Lobby principal, visão geral e seleção de salas',
      icon: <Home className="w-4 h-4 text-white/70" />,
      category: 'Navegação' as const,
      action: () => {
        router.push('/');
        onClose();
      },
    },
  ];

  const filteredCommands = commands.filter((cmd) =>
    cmd.label.toLowerCase().includes(search.toLowerCase()) ||
    cmd.description.toLowerCase().includes(search.toLowerCase()) ||
    cmd.category.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % (filteredCommands.length || 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev === 0 ? Math.max(0, filteredCommands.length - 1) : prev - 1
        );
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].action();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredCommands, selectedIndex, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-surface-tv/95 border border-white/15 rounded-3xl shadow-2xl overflow-hidden text-white font-body backdrop-blur-2xl ring-1 ring-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/10">
          <Search className="w-5 h-5 text-white/40 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="O que você deseja fazer? (ou use as setas do teclado)..."
            className="w-full bg-transparent text-sm text-white placeholder-white/40 outline-none"
          />
          <kbd className="px-2 py-0.5 text-[10px] font-mono font-bold bg-white/10 rounded-md text-white/50 border border-white/10">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {filteredCommands.length === 0 ? (
            <div className="p-8 text-center text-sm text-white/40">
              Nenhuma ação encontrada para &quot;{search}&quot;
            </div>
          ) : (
            filteredCommands.map((cmd, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <button
                  key={cmd.id}
                  onClick={cmd.action}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-left transition-all ${
                    isSelected
                      ? 'bg-brand-primary text-white shadow-md shadow-brand-primary/20'
                      : 'hover:bg-white/5 text-white/80'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`p-2 rounded-xl shrink-0 ${
                        isSelected ? 'bg-white/20' : 'bg-white/10'
                      }`}
                    >
                      {cmd.icon}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs sm:text-sm font-bold truncate">
                        {cmd.label}
                      </div>
                      <div
                        className={`text-[11px] truncate ${
                          isSelected ? 'text-white/80' : 'text-white/40'
                        }`}
                      >
                        {cmd.description}
                      </div>
                    </div>
                  </div>

                  {cmd.shortcut && (
                    <kbd
                      className={`ml-2 px-2 py-0.5 text-[10px] font-mono font-bold rounded-md shrink-0 ${
                        isSelected
                          ? 'bg-white/20 text-white'
                          : 'bg-white/10 text-white/50 border border-white/10'
                      }`}
                    >
                      {cmd.shortcut}
                    </kbd>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-between px-5 py-2.5 bg-white/5 border-t border-white/10 text-[10px] text-white/40 font-mono">
          <div className="flex items-center gap-2">
            <span>↑↓ para navegar</span>
            <span>•</span>
            <span>ENTER para selecionar</span>
          </div>
          <span>PORChat Command Palette</span>
        </div>
      </div>
    </div>
  );
}
