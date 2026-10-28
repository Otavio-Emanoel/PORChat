'use client';

import React, { useState } from 'react';
import { Pin, X, ChevronRight } from 'lucide-react';

interface PinnedBannerProps {
  title?: string;
  content: string;
  roomCode?: string;
}

export function PinnedBanner({
  title = 'Aviso Fixado',
  content,
  roomCode,
}: PinnedBannerProps) {
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed) return null;

  return (
    <div className="mx-4 mt-2 px-3.5 py-2 rounded-2xl bg-gradient-to-r from-brand-primary/10 via-brand-mint/10 to-brand-reward/10 border border-brand-primary/20 backdrop-blur-md flex items-center justify-between gap-3 text-xs shadow-2xs animate-in slide-in-from-top-2 duration-200">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-6 h-6 rounded-lg bg-brand-primary/20 text-brand-primary flex items-center justify-center shrink-0">
          <Pin className="w-3.5 h-3.5" />
        </div>
        <div className="min-w-0 truncate">
          <span className="font-bold text-ink-main mr-1.5">{title}:</span>
          <span className="text-ink-muted">{content}</span>
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {roomCode && (
          <span className="px-2 py-0.5 rounded-md bg-white/80 font-mono text-[10px] font-bold text-brand-primary border border-brand-primary/20 shadow-2xs hidden sm:inline">
            PIN: {roomCode}
          </span>
        )}
        <button
          type="button"
          onClick={() => setIsDismissed(true)}
          className="p-1 rounded-lg text-ink-muted hover:text-ink-main hover:bg-black/5 transition-colors"
          title="Fechar aviso fixado"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
