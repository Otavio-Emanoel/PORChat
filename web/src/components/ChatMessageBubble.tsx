'use client';

import React from 'react';
import { Download, FileText, Lock, Reply, Trophy } from 'lucide-react';
import type { ChatMessage, PinnedMessageInfo } from '@/lib/types';
import { API_BASE } from '@/lib/apiClient';
import { formatRelativeTime, getReplyPreviewMeta, resolveMediaUrl, type ReplyTarget } from '@/lib/chatHelpers';
import { AudioWaveformBubble } from '@/components/AudioWaveformBubble';
import { MessageHoverToolbar, MessageReactionBadges } from '@/components/MessageReactions';
import { PollBubble } from '@/components/PollComponents';
import { ReplyPreviewContent } from '@/components/ReplyPreviewContent';

interface ChatMessageBubbleProps {
  message: ChatMessage;
  prevMessage?: ChatMessage;
  allMessages: ChatMessage[];
  currentNickname: string;
  pinnedMessage: PinnedMessageInfo | null;
  searchQuery: string;
  nowTick: number;
  onReact: (messageId: string, emoji: string) => void;
  onReply: (target: ReplyTarget) => void;
  onEdit: (messageId: string, content: string) => void;
  onTogglePin: (messageId: string) => void;
  onDelete: (messageId: string) => void;
  onVotePoll: (messageId: string, optionId: string) => void;
  onClosePoll: (messageId: string) => void;
  onOpenLeaderboard: () => void;
  onOpenUrl: (url: string) => void;
}

function renderDateDivider(currentDateStr?: string, prevDateStr?: string) {
  if (!currentDateStr) return null;
  try {
    const d1 = new Date(currentDateStr);
    const d1Str = d1.toDateString();
    const d2Str = prevDateStr ? new Date(prevDateStr).toDateString() : null;
    if (d1Str === d2Str) return null;

    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    let label = d1.toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' });
    if (d1Str === today) label = 'Hoje';
    else if (d1Str === yesterday) label = 'Ontem';

    return (
      <div key={`date-divider-${currentDateStr}`} className="flex justify-center my-3 select-none">
        <span className="px-3 py-1 rounded-full bg-white/90 shadow-2xs border border-gray-200/60 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
          {label}
        </span>
      </div>
    );
  } catch {
    return null;
  }
}

/**
 * Renders an individual chat message bubble, system notice, or game result card.
 */
export const ChatMessageBubble: React.FC<ChatMessageBubbleProps> = ({
  message: msg,
  prevMessage,
  allMessages,
  currentNickname,
  pinnedMessage,
  searchQuery,
  nowTick,
  onReact,
  onReply,
  onEdit,
  onTogglePin,
  onDelete,
  onVotePoll,
  onClosePoll,
  onOpenLeaderboard,
  onOpenUrl,
}) => {
  const isMe = msg.nickname === currentNickname;
  const isSystem = msg.type === 'system';
  const isGameCard = msg.type === 'game_card';
  const isPoll = msg.type === 'poll' || Boolean(msg.poll);
  const isVoice =
    msg.type === 'voice' ||
    msg.attachment?.kind === 'audio' ||
    msg.content.startsWith('[Mensagem de Voz') ||
    msg.content.includes('Mensagem de Voz');
  const isImage = msg.attachment?.kind === 'image';
  const isFile = msg.type === 'file' || msg.attachment?.kind === 'document';
  const readCount = (msg.read_by || []).filter(
    (r) => r.toLowerCase() !== msg.nickname.toLowerCase()
  ).length;

  const renderHighlightedText = (text: string) => {
    if (!searchQuery.trim()) return text;
    const parts = text.split(
      new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
    );
    return parts.map((part, i) =>
      part.toLowerCase() === searchQuery.toLowerCase() ? (
        <mark key={i} className="bg-amber-200 text-ink-main rounded px-0.5 font-medium">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  const renderWithLinks = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    return parts.map((part, i) => {
      if (part.match(urlRegex)) {
        return (
          <a
            key={i}
            href={part}
            onClick={(e) => {
              e.preventDefault();
              onOpenUrl(part);
            }}
            className="text-brand-primary underline break-all hover:opacity-80 transition-opacity"
          >
            {part}
          </a>
        );
      }
      return renderHighlightedText(part);
    });
  };

  const renderMessageContent = (content: string) => {
    if (content.startsWith('> [')) {
      const newlineIndex = content.indexOf('\n');
      if (newlineIndex !== -1) {
        const quoteHeader = content.substring(0, newlineIndex);
        const actualBody = content.substring(newlineIndex + 1);
        return (
          <div className="space-y-1">
            <div className="px-2 py-1 rounded-lg bg-black/5 border-l-2 border-brand-primary text-xs text-gray-600 mb-1">
              {quoteHeader.replace(/^>\s*/, '')}
            </div>
            <div>{renderWithLinks(actualBody)}</div>
          </div>
        );
      }
    }
    return renderWithLinks(content);
  };

  if (isSystem) {
    return (
      <>
        {renderDateDivider(msg.created_at, prevMessage?.created_at)}
        <div className="flex justify-center my-2 animate-message-in">
          <span className="px-3 py-1 rounded-full bg-white/80 backdrop-blur-xs text-gray-600 text-[11px] font-medium shadow-2xs border border-gray-200/50 flex items-center gap-1.5">
            <Lock className="w-3 h-3 text-brand-primary" />
            {msg.content}
          </span>
        </div>
      </>
    );
  }

  if (isGameCard) {
    return (
      <>
        {renderDateDivider(msg.created_at, prevMessage?.created_at)}
        <div className="flex justify-center my-3 animate-message-in">
          <div className="max-w-lg w-full rounded-2xl bg-[#1E1E2E] text-white px-4 py-3 shadow-md border border-brand-reward/30 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-brand-reward/20 text-brand-reward flex items-center justify-center shrink-0">
                <Trophy className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-brand-reward block">
                  Resultado Oficial da Partida
                </span>
                <p className="text-xs text-slate-200 mt-0.5">{msg.content}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onOpenLeaderboard}
              className="px-2.5 py-1.5 rounded-xl bg-brand-reward text-[#1E1E2E] text-[10px] font-bold shrink-0 hover:opacity-90 transition"
            >
              Ver Ranking
            </button>
          </div>
        </div>
      </>
    );
  }

  const replyTarget: ReplyTarget = {
    id: msg.id,
    nickname: msg.nickname,
    content: msg.content,
    type: msg.type,
    attachment: msg.attachment,
    poll: msg.poll,
  };

  const repliedOriginal = msg.reply_preview
    ? allMessages.find((m) => m.id === msg.reply_preview?.id) ||
      allMessages.find((m) => m.id === msg.reply_to_id)
    : undefined;
  const replyMeta = msg.reply_preview
    ? getReplyPreviewMeta(msg.reply_preview, API_BASE, repliedOriginal)
    : null;

  const attachmentUrl = resolveMediaUrl(msg.attachment?.url, API_BASE) || '';

  return (
    <>
      {renderDateDivider(msg.created_at, prevMessage?.created_at)}
      <div
        id={`msg-${msg.id}`}
        className={`group relative flex flex-col ${
          isMe ? 'items-end' : 'items-start'
        } animate-message-in`}
      >
        {!isMe && (
          <span className="text-[11px] font-bold text-brand-primary ml-2 mb-0.5">
            {msg.nickname}
          </span>
        )}

        <div
          className={`max-w-md px-3.5 py-2 rounded-2xl text-sm leading-relaxed shadow-xs relative transition-all ${
            isMe
              ? 'bg-[#E7FFDB] text-ink-main rounded-tr-none border border-emerald-200/40'
              : 'bg-white text-ink-main rounded-tl-none border border-gray-200/70'
          }`}
        >
          <MessageHoverToolbar
            messageId={msg.id}
            isMe={isMe}
            isPinned={pinnedMessage?.message_id === msg.id}
            canEdit={isMe && msg.type === 'text'}
            onReact={onReact}
            onReply={() => onReply(replyTarget)}
            onEdit={() => onEdit(msg.id, msg.content)}
            onPin={() => onTogglePin(msg.id)}
            onDelete={onDelete}
          />

          {/* Structured Rich Reply Preview */}
          {msg.reply_preview && replyMeta && (
            <div
              onClick={() => {
                const el = document.getElementById(`msg-${msg.reply_preview?.id}`);
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  el.classList.add('ring-2', 'ring-brand-primary');
                  setTimeout(() => el.classList.remove('ring-2', 'ring-brand-primary'), 1500);
                }
              }}
              className="mb-1.5 flex items-center justify-between gap-2 rounded-xl bg-black/5 hover:bg-black/10 transition-colors border-l-3 border-brand-primary px-2.5 py-1.5 text-xs cursor-pointer select-none"
              title="Clique para ver a mensagem original"
            >
              <div className="min-w-0 flex-1">
                <span className="font-bold text-brand-primary block text-[10px] leading-tight">
                  {msg.reply_preview.nickname}
                </span>
                <div className="flex items-center gap-1.5 text-gray-600 truncate mt-0.5">
                  <ReplyPreviewContent meta={replyMeta} iconSizeClass="w-3 h-3" />
                </div>
              </div>
              {replyMeta.kind === 'image' && replyMeta.imageUrl && (
                <img
                  src={replyMeta.imageUrl}
                  alt="Preview"
                  className="w-9 h-9 rounded-md object-cover border border-black/10 shrink-0 ml-1.5"
                />
              )}
            </div>
          )}

          {/* Message Content by Type */}
          {isPoll && msg.poll ? (
            <PollBubble
              messageId={msg.id}
              poll={msg.poll}
              currentNickname={currentNickname}
              onVote={onVotePoll}
              onClosePoll={onClosePoll}
            />
          ) : isVoice ? (
            <AudioWaveformBubble isMe={isMe} attachment={msg.attachment} />
          ) : isImage && msg.attachment ? (
            <div className="space-y-1.5">
              <img
                src={attachmentUrl}
                alt={msg.attachment.file_name}
                className="max-h-64 rounded-xl object-cover border border-black/10"
              />
              <div className="flex items-center justify-between text-[10px] text-gray-500">
                <span className="truncate max-w-[180px]">{msg.attachment.file_name}</span>
                {msg.attachment.sha256 && (
                  <span className="font-mono">SHA256: {msg.attachment.sha256.slice(0, 8)}</span>
                )}
              </div>
            </div>
          ) : isFile && msg.attachment ? (
            <div className="flex items-center justify-between gap-3 rounded-xl bg-black/5 p-2.5 border border-black/10">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-brand-primary/15 text-brand-primary flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-ink-main truncate">
                    {msg.attachment.file_name}
                  </p>
                  <p className="text-[10px] text-gray-500 font-mono">
                    {(msg.attachment.size_bytes / 1024).toFixed(1)} KB
                    {msg.attachment.sha256 ? ` • SHA256 ${msg.attachment.sha256.slice(0, 8)}` : ''}
                  </p>
                </div>
              </div>
              <a
                href={attachmentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-lg bg-brand-primary text-white hover:opacity-90 shrink-0"
                title="Baixar arquivo verificado"
              >
                <Download className="w-3.5 h-3.5" />
              </a>
            </div>
          ) : (
            renderMessageContent(msg.content)
          )}

          <div className="flex items-center gap-1.5 float-right ml-3 mt-1 text-[10px] text-gray-400 font-mono">
            {msg.edited_at && <span className="italic text-gray-400">(editada)</span>}
            <button
              type="button"
              onClick={() => onReply(replyTarget)}
              className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-brand-primary transition-opacity"
              title="Responder mensagem"
            >
              <Reply className="w-3 h-3" />
            </button>
            <span>{formatRelativeTime(msg.created_at, nowTick)}</span>
            {isMe && (
              <span
                className={readCount > 0 ? 'text-brand-primary font-bold' : 'text-gray-400'}
                title={
                  readCount > 0
                    ? `Lida por ${readCount} participante(s)`
                    : 'Entregue no servidor'
                }
              >
                <svg className="w-3.5 h-3.5 inline" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M12.354 4.354a.5.5 0 0 0-.708-.708L5 10.293 1.854 7.146a.5.5 0 1 0-.708.708l3.5 3.5a.5.5 0 0 0 .708 0l7-7zm-3 0a.5.5 0 0 0-.708-.708L5 7.293 3.854 6.146a.5.5 0 1 0-.708.708l1.5 1.5a.5.5 0 0 0 .708 0l4-4z" />
                </svg>
                {readCount > 0 && <span className="ml-0.5 text-[9px]">{readCount}</span>}
              </span>
            )}
          </div>
        </div>

        {msg.reactions && Object.keys(msg.reactions).length > 0 && (
          <MessageReactionBadges
            messageId={msg.id}
            reactions={msg.reactions}
            currentUserId={currentNickname}
            isMe={isMe}
            onReact={onReact}
          />
        )}
      </div>
    </>
  );
};
