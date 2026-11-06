'use client';

import React, { useState } from 'react';
import { Pin, X, PinOff } from 'lucide-react';
import type { PinnedMessageInfo } from '@/lib/types';

interface PinnedBannerProps {
  title?: string;
  content: string;
  roomCode?: string;
  pinnedMessage?: PinnedMessageInfo | null;
  onUnpin?: () => void;
  onJumpToMessage?: (messageId: string) => void;
}

export function PinnedBanner({
  title = 'Aviso Fixado',
  content,
  roomCode,
  pinnedMessage,
  onUnpin,
  onJumpToMessage,
}: PinnedBannerProps) {
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed && !pinnedMessage) return null;

  const displayTitle = pinnedMessage
    ? `Fixado por ${pinnedMessage.pinned_by} (${pinnedMessage.sender_nickname})`
    : title;
  const displayContent = pinnedMessage ? pinnedMessage.content : content;

  return (
    <div className="mx-4 mt-2 px-3.5 py-2 rounded-2xl bg-gradient-to-r from-brand-primary/10 via-brand-mint/10 to-brand-reward/10 border border-brand-primary/20 backdrop-blur-md flex items-center justify-between gap-3 text-xs shadow-2xs animate-in slide-in-from-top-2 duration-200">
      <div
        onClick={() => {
          if (pinnedMessage && onJumpToMessage) {
            onJumpToMessage(pinnedMessage.message_id);
          }
        }}
        className={`flex items-center gap-2.5 min-w-0 ${
          pinnedMessage && onJumpToMessage ? 'cursor-pointer hover:opacity-80' : ''
        }`}
      >
        <div className="w-6 h-6 rounded-lg bg-brand-primary/20 text-brand-primary flex items-center justify-center shrink-0">
          <Pin className="w-3.5 h-3.5" />
        </div>
        <div className="min-w-0 truncate">
          <span className="font-bold text-ink-main mr-1.5">{displayTitle}:</span>
          <span className="text-ink-muted">{displayContent}</span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {roomCode && (
          <span className="px-2 py-0.5 rounded-md bg-white/80 font-mono text-[10px] font-bold text-brand-primary border border-brand-primary/20 shadow-2xs hidden sm:inline">
            PIN: {roomCode}
          </span>
        )}
        {pinnedMessage && onUnpin && (
          <button
            type="button"
            onClick={onUnpin}
            className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-brand-action/15 text-brand-action hover:bg-brand-action/25 font-bold text-[10px] transition-colors"
            title="Desafixar mensagem"
          >
            <PinOff className="w-3 h-3" />
            <span>Desafixar</span>
          </button>
        )}
        {!pinnedMessage && (
          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            className="p-1 rounded-lg text-ink-muted hover:text-ink-main hover:bg-black/5 transition-colors"
            title="Fechar aviso fixado"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
