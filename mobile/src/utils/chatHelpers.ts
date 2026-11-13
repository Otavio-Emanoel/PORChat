import type { ChatMessage, ChatPoll, MessageAttachment, ReplyPreview } from '../types';
import { colors } from '../theme/colors';

export interface RoomItem {
  id: string;
  name: string;
  description?: string;
  code: string;
  is_group: boolean;
  members?: string[];
  admins?: string[];
  created_by?: string;
  created_at?: string;
  last_message?: string;
  last_message_at?: string;
  avatar_url?: string;
  avatar_color?: string;
}

export interface ContactItem {
  id: string;
  nickname: string;
  email: string;
  avatar_url?: string;
  avatar_color?: string;
  status_text?: string;
  bio?: string;
}

export interface PendingAttachment {
  kind: 'image' | 'document' | 'audio';
  name: string;
  mimeType: string;
  dataBase64: string;
  sizeFormatted: string;
  uri?: string;
}

export interface ReplyTarget {
  id: string;
  nickname: string;
  content: string;
  type?: string;
  attachment?: MessageAttachment | null;
  poll?: ChatPoll | null;
}

export type ReactionIconName =
  | 'thumbs-up'
  | 'heart'
  | 'checkmark-circle'
  | 'flame'
  | 'trophy'
  | 'happy';

export const AVATAR_COLOR_OPTIONS = [
  { id: 'violet', bg: '#6C5CE7', label: 'Violeta' },
  { id: 'coral', bg: '#FF7675', label: 'Coral' },
  { id: 'mint', bg: '#00CEC9', label: 'Menta' },
  { id: 'amber', bg: '#F59E0B', label: 'Âmbar' },
  { id: 'blue', bg: '#3B82F6', label: 'Azul' },
  { id: 'emerald', bg: '#10B981', label: 'Esmeralda' },
  { id: 'indigo', bg: '#6366F1', label: 'Índigo' },
  { id: 'slate', bg: '#475569', label: 'Grafite' },
];

export const AVATAR_PRESETS = [
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=160&q=80',
  'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=160&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=160&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=160&q=80',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=160&q=80',
  'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=160&q=80',
];

export const STATUS_PRESETS = [
  'Disponível no PORChat',
  'Pronto para o Debate',
  'Online no mobile',
  'No comando da TV',
  'Modo Focado',
  'Apenas Ouvindo',
];

export const POLL_PALETTE = [
  { fill: '#FFEAE8', border: '#FF6B6B', text: '#D63031', bar: '#FF7675' },
  { fill: '#E0F9F8', border: '#00CEC9', text: '#009692', bar: '#00CEC9' },
  { fill: '#FFF5DB', border: '#FECA57', text: '#B8860B', bar: '#FDCB6E' },
  { fill: '#E2FBF3', border: '#1DD1A1', text: '#10AC84', bar: '#1DD1A1' },
  { fill: '#EFEBFD', border: '#6C5CE7', text: '#5542D0', bar: '#6C5CE7' },
];

export const REACTION_CONFIG: Record<
  string,
  {
    iconName: ReactionIconName;
    label: string;
    color: string;
    bgColor: string;
  }
> = {
  like: { iconName: 'thumbs-up', label: 'Curtir', color: '#0984E3', bgColor: '#E8F4FD' },
  heart: { iconName: 'heart', label: 'Amei', color: '#FF7675', bgColor: '#FFEFEF' },
  agree: { iconName: 'checkmark-circle', label: 'Concordo', color: '#00CEC9', bgColor: '#E0F9F8' },
  fire: { iconName: 'flame', label: 'Destaque', color: '#FF6B6B', bgColor: '#FFEAE8' },
  applause: { iconName: 'trophy', label: 'Aplausos', color: '#FDCB6E', bgColor: '#FFF8E7' },
  laugh: { iconName: 'happy', label: 'Boa', color: '#FECA57', bgColor: '#FFF9EB' },
  liked: { iconName: 'thumbs-up', label: 'Curtir', color: '#0984E3', bgColor: '#E8F4FD' },
};

export const REACTION_EMOJIS: Record<string, string> = {
  like: '👍',
  heart: '❤️',
  agree: '✅',
  fire: '🔥',
  applause: '👏',
  laugh: '😂',
  liked: '👍',
};

export const QUICK_ACTION_REACTIONS = ['like', 'heart', 'agree', 'fire', 'applause', 'laugh'] as const;

export function getReactionMeta(rawKey: string) {
  const normalized = (rawKey || '').trim().toLowerCase();
  return (
    REACTION_CONFIG[normalized] || {
      iconName: 'thumbs-up' as ReactionIconName,
      label: rawKey,
      color: colors.brand.primary,
      bgColor: '#EFEBFD',
    }
  );
}

export function getAvatarBgColor(idOrName: string): string {
  const palette = ['#6C5CE7', '#FF7675', '#00CEC9', '#FDCB6E', '#A29BFE', '#E17055', '#0984E3', '#00B894'];
  let hash = 0;
  const str = idOrName || 'user';
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return palette[Math.abs(hash) % palette.length];
}

export function getMonogram(name: string): string {
  return (name || '?')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function formatRoomPin(input: string): string {
  let clean = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (clean.startsWith('POR')) {
    clean = clean.slice(3);
  }
  if (clean.length > 0) {
    return `POR-${clean.slice(0, 5)}`;
  }
  return '';
}

export function resolveMobileMediaUrl(
  rawUrl: string | null | undefined,
  serverHost: string
): string | null {
  if (!rawUrl) return null;
  if (rawUrl.startsWith('http') || rawUrl.startsWith('data:')) {
    return rawUrl;
  }
  const host = serverHost.trim() || 'localhost:8081';
  return `http://${host}${rawUrl}`;
}

export type MobileReplyMediaKind = 'image' | 'voice' | 'file' | 'poll' | 'text';

export interface MobileReplyPreviewMeta {
  kind: MobileReplyMediaKind;
  label: string;
  imageUri: string | null;
}

export function getMobileReplyPreviewMeta(
  preview: ReplyPreview | ReplyTarget,
  serverHost: string,
  originalMessage?: ChatMessage
): MobileReplyPreviewMeta {
  const previewMediaUrl = 'media_url' in preview ? preview.media_url : undefined;
  const previewFileName = 'file_name' in preview ? preview.file_name : undefined;
  const previewAttachment = 'attachment' in preview ? preview.attachment : undefined;
  const previewPoll = 'poll' in preview ? preview.poll : undefined;

  const isReplyImage =
    preview.type === 'image' ||
    previewAttachment?.kind === 'image' ||
    originalMessage?.type === 'image' ||
    originalMessage?.attachment?.kind === 'image' ||
    Boolean(preview.content?.startsWith('Imagem:'));

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
      imageUri: resolveMobileMediaUrl(rawImageUrl, serverHost),
    };
  }
  if (isReplyVoice) {
    return {
      kind: 'voice',
      label: 'Mensagem de voz',
      imageUri: null,
    };
  }
  if (isReplyFile) {
    return {
      kind: 'file',
      label: fileName || preview.content,
      imageUri: null,
    };
  }
  if (isReplyPoll) {
    return {
      kind: 'poll',
      label: previewPoll?.question || originalMessage?.poll?.question || preview.content,
      imageUri: null,
    };
  }
  return {
    kind: 'text',
    label: preview.content,
    imageUri: null,
  };
}
