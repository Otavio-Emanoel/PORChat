import React from 'react';
import { Reply, Copy, Trash2, ThumbsUp, Heart, Smile, Sparkles, Check } from 'lucide-react';

export const REACTION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  like: ThumbsUp,
  heart: Heart,
  smile: Smile,
  star: Sparkles,
  check: Check,
  '\uD83D\uDC4D': ThumbsUp,
  '\u2764\uFE0F': Heart,
  '\uD83D\uDE02': Smile,
  '\uD83D\uDE2E': Sparkles,
  '\uD83D\uDE22': Smile,
  '\uD83D\uDE4F': Check,
  '\uD83D\uDD25': Sparkles,
  '\uD83D\uDC51': Sparkles,
};

export const REACTION_LABELS: Record<string, string> = {
  like: 'Curtir',
  heart: 'Amei',
  smile: 'Riso',
  star: 'Destaque',
  check: 'Concordo',
  '\uD83D\uDC4D': 'Curtir',
  '\u2764\uFE0F': 'Amei',
  '\uD83D\uDE02': 'Riso',
  '\uD83D\uDE2E': 'Impressionado',
  '\uD83D\uDE22': 'Triste',
  '\uD83D\uDE4F': 'Agradecido',
  '\uD83D\uDD25': 'Destaque',
  '\uD83D\uDC51': 'Top',
};

const QUICK_REACTIONS = [
  { key: 'like', label: 'Curtir', icon: ThumbsUp },
  { key: 'heart', label: 'Amei', icon: Heart },
  { key: 'smile', label: 'Riso', icon: Smile },
  { key: 'star', label: 'Destaque', icon: Sparkles },
] as const;

interface MessageHoverBarProps {
  messageId: string;
  onReact: (emoji: string) => void;
  isCurrentUser: boolean;
  onReply?: () => void;
  onCopy?: () => void;
  onDelete?: () => void;
}

export function MessageHoverBar({
  messageId,
  onReact,
  isCurrentUser,
  onReply,
  onCopy,
  onDelete,
}: MessageHoverBarProps) {
  return (
    <div
      className={`absolute -top-4 ${
        isCurrentUser ? 'right-2' : 'left-2'
      } z-20 flex items-center gap-0.5 px-2 py-1 rounded-full bg-white/95 backdrop-blur-md border border-gray-200/80 shadow-lg animate-in fade-in zoom-in-95 duration-150 transition-all select-none`}
      onClick={(e) => e.stopPropagation()}
    >
      {QUICK_REACTIONS.map(({ key, label, icon: IconComponent }) => (
        <button
          key={key}
          type="button"
          onClick={() => onReact(key)}
          className="w-7 h-7 flex items-center justify-center rounded-full text-gray-600 hover:text-brand-primary hover:bg-gray-100 hover:scale-110 transition-all active:scale-95 cursor-pointer"
          title={label}
        >
          <IconComponent className="w-3.5 h-3.5" />
        </button>
      ))}

      <div className="h-4 w-px bg-gray-200 mx-1" />

      {onReply && (
        <button
          type="button"
          onClick={onReply}
          className="w-7 h-7 flex items-center justify-center rounded-full text-gray-500 hover:text-brand-primary hover:bg-gray-100 transition-all active:scale-95 cursor-pointer"
          title="Responder mensagem"
        >
          <Reply className="w-3.5 h-3.5" />
        </button>
      )}

      {onCopy && (
        <button
          type="button"
          onClick={onCopy}
          className="w-7 h-7 flex items-center justify-center rounded-full text-gray-500 hover:text-brand-primary hover:bg-gray-100 transition-all active:scale-95 cursor-pointer"
          title="Copiar texto"
        >
          <Copy className="w-3.5 h-3.5" />
        </button>
      )}

      {onDelete && isCurrentUser && (
        <button
          type="button"
          onClick={onDelete}
          className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all active:scale-95 cursor-pointer"
          title="Apagar mensagem"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
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
        const IconComponent = REACTION_ICONS[emoji];

        return (
          <button
            key={emoji}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleReaction(emoji);
            }}
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold transition-all tactile-btn ${
              hasReacted
                ? 'bg-brand-primary/15 text-brand-primary border border-brand-primary/30 shadow-2xs'
                : 'bg-gray-100/90 hover:bg-gray-200/80 text-gray-700 border border-gray-200/60'
            }`}
          >
            {IconComponent ? (
              <IconComponent className="w-3 h-3" />
            ) : (
              <span>{REACTION_LABELS[emoji] || emoji}</span>
            )}
            <span className="font-mono text-[10px]">{users.length}</span>
          </button>
        );
      })}
    </div>
  );
}
