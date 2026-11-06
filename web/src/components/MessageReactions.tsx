'use client';

import React from 'react';
import {
  ThumbsUp,
  Heart,
  Smile,
  Award,
  Flame,
  CheckCircle2,
  Pencil,
  Pin,
  Trash2,
  Reply,
} from 'lucide-react';

export const QUICK_REACTIONS = ['like', 'heart', 'laugh', 'applause', 'fire', 'agree'] as const;

export const REACTION_META: Record<
  string,
  {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
  }
> = {
  like: { icon: ThumbsUp, label: 'Curtir' },
  heart: { icon: Heart, label: 'Amei' },
  laugh: { icon: Smile, label: 'Boa' },
  applause: { icon: Award, label: 'Aplausos' },
  fire: { icon: Flame, label: 'Destaque' },
  agree: { icon: CheckCircle2, label: 'Concordo' },
};

export interface MessageHoverToolbarProps {
  messageId: string;
  isMe: boolean;
  isPinned?: boolean;
  canEdit?: boolean;
  onReact: (messageId: string, emoji: string) => void;
  onReply?: () => void;
  onEdit?: () => void;
  onPin?: () => void;
  onDelete?: (messageId: string) => void;
}

export function MessageHoverToolbar({
  messageId,
  isMe,
  isPinned = false,
  canEdit = false,
  onReact,
  onReply,
  onEdit,
  onPin,
  onDelete,
}: MessageHoverToolbarProps) {
  return (
    <div
      className={`absolute -top-3.5 ${
        isMe ? 'right-2' : 'left-2'
      } z-20 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-150 flex items-center gap-0.5 rounded-full border border-slate-200/90 bg-white/95 px-1.5 py-0.5 shadow-md backdrop-blur-xs`}
    >
      {QUICK_REACTIONS.map((key) => {
        const meta = REACTION_META[key] || { icon: ThumbsUp, label: key };
        const IconComponent = meta.icon;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onReact(messageId, key)}
            title={meta.label}
            aria-label={`Reagir com ${meta.label}`}
            className="rounded-full p-1 text-slate-500 transition hover:bg-slate-100 hover:text-[#6C5CE7] active:scale-95"
          >
            <IconComponent className="h-3.5 w-3.5" />
          </button>
        );
      })}

      {onReply && (
        <button
          type="button"
          onClick={onReply}
          title="Responder"
          aria-label="Responder mensagem"
          className="ml-0.5 border-l border-slate-100 pl-1.5 pr-1 text-slate-400 transition hover:text-[#6C5CE7]"
        >
          <Reply className="h-3.5 w-3.5" />
        </button>
      )}

      {onPin && (
        <button
          type="button"
          onClick={onPin}
          title={isPinned ? 'Desafixar mensagem' : 'Fixar mensagem no topo'}
          aria-label="Fixar mensagem"
          className={`px-1 text-[10px] font-semibold transition ${
            isPinned ? 'text-[#FDCB6E]' : 'text-slate-400 hover:text-slate-700'
          }`}
        >
          <Pin className="h-3.5 w-3.5" />
        </button>
      )}

      {canEdit && onEdit && (
        <button
          type="button"
          onClick={onEdit}
          title="Editar mensagem"
          aria-label="Editar mensagem"
          className="px-1 text-slate-400 transition hover:text-[#6C5CE7]"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      )}

      {isMe && onDelete && (
        <button
          type="button"
          onClick={() => onDelete(messageId)}
          title="Apagar mensagem"
          aria-label="Apagar mensagem"
          className="px-1 text-slate-400 transition hover:text-red-500"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

export interface MessageReactionBadgesProps {
  messageId: string;
  reactions?: Record<string, string[]>;
  currentUserId: string;
  isMe: boolean;
  onReact: (messageId: string, emoji: string) => void;
}

export function MessageReactionBadges({
  messageId,
  reactions = {},
  currentUserId,
  isMe,
  onReact,
}: MessageReactionBadgesProps) {
  const activeEntries = Object.entries(reactions).filter(([, users]) => users && users.length > 0);
  if (activeEntries.length === 0) return null;

  return (
    <div
      className={`mt-1 flex flex-wrap gap-1 ${isMe ? 'justify-end' : 'justify-start'}`}
      role="group"
      aria-label="Reações da mensagem"
    >
      {activeEntries.map(([key, users]) => {
        const hasReacted = users.includes(currentUserId);
        const meta = REACTION_META[key] || { icon: ThumbsUp, label: key };
        const IconComponent = meta.icon;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onReact(messageId, key)}
            title={meta.label}
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold transition ${
              hasReacted
                ? 'border-[#6C5CE7]/40 bg-[#6C5CE7]/15 text-[#6C5CE7]'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            <IconComponent className="h-3 w-3" />
            <span>{users.length}</span>
          </button>
        );
      })}
    </div>
  );
}

interface MessageReactionsProps {
  messageId: string;
  reactions?: Record<string, string[]>;
  currentUserId: string;
  isMe: boolean;
  isPinned?: boolean;
  canEdit?: boolean;
  onReact: (messageId: string, emoji: string) => void;
  onReply?: () => void;
  onEdit?: () => void;
  onPin?: () => void;
  onDelete?: (messageId: string) => void;
}

export function MessageReactions({
  messageId,
  reactions = {},
  currentUserId,
  isMe,
  isPinned = false,
  canEdit = false,
  onReact,
  onReply,
  onEdit,
  onPin,
  onDelete,
}: MessageReactionsProps) {
  return (
    <>
      <MessageHoverToolbar
        messageId={messageId}
        isMe={isMe}
        isPinned={isPinned}
        canEdit={canEdit}
        onReact={onReact}
        onReply={onReply}
        onEdit={onEdit}
        onPin={onPin}
        onDelete={onDelete}
      />
      <MessageReactionBadges
        messageId={messageId}
        reactions={reactions}
        currentUserId={currentUserId}
        isMe={isMe}
        onReact={onReact}
      />
    </>
  );
}
