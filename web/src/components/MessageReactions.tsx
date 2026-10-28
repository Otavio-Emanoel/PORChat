'use client';

import React from 'react';

const QUICK_EMOJIS = ['❤️', '🔥', '😂', '👏', '👑', '👍'] as const;

interface MessageHoverBarProps {
  messageId: string;
  onReact: (emoji: string) => void;
  isCurrentUser: boolean;
}

export function MessageHoverBar({ messageId, onReact, isCurrentUser }: MessageHoverBarProps) {
  return (
    <div
      className={`absolute -top-4 ${
        isCurrentUser ? 'right-2' : 'left-2'
      } z-20 flex items-center gap-0.5 px-2 py-1 rounded-full bg-white/95 backdrop-blur-md border border-gray-200/80 shadow-lg animate-in fade-in zoom-in-95 duration-150 transition-all`}
      onClick={(e) => e.stopPropagation()}
    >
      {QUICK_EMOJIS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onReact(emoji)}
          className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 hover:scale-125 transition-all active:scale-95 text-xs"
          title={`Reagir com ${emoji}`}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}

interface MessageReactionPillsProps {
  reactions?: Record<string, string[]>;
  currentUserId?: string;
  onToggleReaction: (emoji: string) => void;
  isCurrentUser: boolean;
}

export function MessageReactionPills({
  reactions,
  currentUserId,
  onToggleReaction,
  isCurrentUser,
}: MessageReactionPillsProps) {
  if (!reactions || Object.keys(reactions).length === 0) return null;

  return (
    <div
      className={`flex flex-wrap gap-1 mt-1.5 ${
        isCurrentUser ? 'justify-end' : 'justify-start'
      }`}
    >
      {Object.entries(reactions).map(([emoji, users]) => {
        if (!users || users.length === 0) return null;
        const hasReacted = currentUserId ? users.includes(currentUserId) : false;
        return (
          <button
            key={emoji}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleReaction(emoji);
            }}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold transition-all tactile-btn ${
              hasReacted
                ? 'bg-brand-primary/15 text-brand-primary border border-brand-primary/30 shadow-2xs'
                : 'bg-gray-100/90 hover:bg-gray-200/80 text-gray-700 border border-gray-200/60'
            }`}
          >
            <span>{emoji}</span>
            <span className="font-mono text-[10px]">{users.length}</span>
          </button>
        );
      })}
    </div>
  );
}
