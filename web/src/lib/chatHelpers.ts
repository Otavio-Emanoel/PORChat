import type { ChatMessage, ChatPoll, MessageAttachment, ReplyPreview } from './types';

export interface ReplyTarget {
  id: string;
  nickname: string;
  content: string;
  type?: string;
  attachment?: MessageAttachment | null;
  poll?: ChatPoll | null;
}

export type ReplyMediaKind = 'image' | 'voice' | 'file' | 'poll' | 'text';

export interface ReplyPreviewMeta {
  kind: ReplyMediaKind;
  label: string;
  imageUrl: string | null;
}

/**
 * Generates up to two uppercase initials for a participant avatar.
 */
export function getMonogram(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return (parts[0] || '').slice(0, 2).toUpperCase();
}

/**
 * Formats an ISO timestamp into a compact relative or local time label.
 */
export function formatRelativeTime(isoString: string, nowMs: number = Date.now()): string {
  try {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return '';
    const diffSec = Math.floor((nowMs - date.getTime()) / 1000);
    if (diffSec < 15) return 'agora';
    if (diffSec < 60) return `há ${diffSec}s`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `há ${diffMin} min`;
    const nowDate = new Date(nowMs);
    const isToday = nowDate.toDateString() === date.toDateString();
    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return `${date.toLocaleDateString([], { day: '2-digit', month: '2-digit' })} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  } catch {
    return '';
  }
}

/**
 * Resolves a relative API attachment path into a full URL when needed.
 */
export function resolveMediaUrl(rawUrl: string | null | undefined, apiBase: string): string | null {
  if (!rawUrl) return null;
  if (rawUrl.startsWith('http') || rawUrl.startsWith('data:')) {
    return rawUrl;
  }
  return `${apiBase}${rawUrl}`;
}

/**
 * Derives unified media kind, label, and thumbnail URL for reply previews
 * in both the message feed and the composer bar.
 */
export function getReplyPreviewMeta(
  preview: ReplyPreview | ReplyTarget,
  apiBase: string,
  originalMessage?: ChatMessage
): ReplyPreviewMeta {
  const previewMediaUrl = 'media_url' in preview ? preview.media_url : undefined;
  const previewFileName = 'file_name' in preview ? preview.file_name : undefined;
  const previewAttachment = 'attachment' in preview ? preview.attachment : undefined;
  const previewPoll = 'poll' in preview ? preview.poll : undefined;

  const isReplyImage =
    preview.type === 'image' ||
    previewAttachment?.kind === 'image' ||
    originalMessage?.type === 'image' ||
    originalMessage?.attachment?.kind === 'image' ||
    preview.content.startsWith('Imagem:');

  const isReplyVoice =
    preview.type === 'voice' ||
    previewAttachment?.kind === 'audio' ||
    originalMessage?.type === 'voice' ||
    originalMessage?.attachment?.kind === 'audio';

  const isReplyFile =
    preview.type === 'file' ||
    previewAttachment?.kind === 'document' ||
    originalMessage?.type === 'file' ||
    originalMessage?.attachment?.kind === 'document';

  const isReplyPoll =
    preview.type === 'poll' ||
    Boolean(previewPoll) ||
    originalMessage?.type === 'poll' ||
    Boolean(originalMessage?.poll);

  const rawImageUrl =
    previewMediaUrl ||
    previewAttachment?.data_url ||
    previewAttachment?.url ||
    originalMessage?.attachment?.data_url ||
    originalMessage?.attachment?.url;

  const fileName =
    previewFileName || previewAttachment?.file_name || originalMessage?.attachment?.file_name;

  if (isReplyImage) {
    return {
      kind: 'image',
      label: fileName || preview.content || 'Foto',
      imageUrl: resolveMediaUrl(rawImageUrl, apiBase),
    };
  }
  if (isReplyVoice) {
    return {
      kind: 'voice',
      label: 'Mensagem de voz',
      imageUrl: null,
    };
  }
  if (isReplyFile) {
    return {
      kind: 'file',
      label: fileName || preview.content,
      imageUrl: null,
    };
  }
  if (isReplyPoll) {
    return {
      kind: 'poll',
      label: previewPoll?.question || originalMessage?.poll?.question || preview.content,
      imageUrl: null,
    };
  }
  return {
    kind: 'text',
    label: preview.content,
    imageUrl: null,
  };
}
