'use client';

import React from 'react';
import { BarChart3, Edit3, Mic, Paperclip, Send, Square, X } from 'lucide-react';
import { API_BASE } from '@/lib/apiClient';
import { getReplyPreviewMeta, type ReplyTarget } from '@/lib/chatHelpers';
import { ReplyPreviewContent } from '@/components/ReplyPreviewContent';

export interface PendingAttachment {
  name: string;
  size: string;
  mimeType: string;
  dataBase64: string;
  kind: 'image' | 'document';
}

interface ChatComposerProps {
  inputText: string;
  editingMessage: { id: string; content: string } | null;
  replyingTo: ReplyTarget | null;
  attachment: PendingAttachment | null;
  isUploadingMedia: boolean;
  isRecordingVoice: boolean;
  recordingSeconds: number;
  recordingWaveform: number[];
  fileInputRef: React.RefObject<HTMLInputElement>;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onCancelEdit: () => void;
  onCancelReply: () => void;
  onClearAttachment: () => void;
  onAttachmentClick: () => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onOpenCreatePoll: () => void;
  onStartVoiceRecording: () => void;
  onCancelVoiceRecording: () => void;
  onFinishVoiceRecording: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

/**
 * Bottom composer bar supporting text, replies, edits, file attachments, polls, and voice notes.
 */
export const ChatComposer: React.FC<ChatComposerProps> = ({
  inputText,
  editingMessage,
  replyingTo,
  attachment,
  isUploadingMedia,
  isRecordingVoice,
  recordingSeconds,
  recordingWaveform,
  fileInputRef,
  onInputChange,
  onCancelEdit,
  onCancelReply,
  onClearAttachment,
  onAttachmentClick,
  onFileChange,
  onOpenCreatePoll,
  onStartVoiceRecording,
  onCancelVoiceRecording,
  onFinishVoiceRecording,
  onSubmit,
}) => {
  const replyMeta = replyingTo ? getReplyPreviewMeta(replyingTo, API_BASE) : null;

  return (
    <footer className="p-3 bg-white/85 backdrop-blur-md border-t border-gray-200/80">
      {/* Active Editing Banner */}
      {editingMessage && (
        <div className="flex items-center justify-between px-3 py-1.5 mb-2 bg-amber-50 border border-amber-200 border-l-4 border-l-amber-500 rounded-xl text-xs">
          <div className="flex items-center gap-2 truncate">
            <Edit3 className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <div className="truncate">
              <span className="font-bold text-amber-800 block text-[11px]">
                Editando mensagem
              </span>
              <span className="text-amber-700 truncate block text-xs">
                {editingMessage.content}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancelEdit}
            className="p-1 rounded-md hover:bg-amber-100 text-amber-700 ml-2 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Quoted Rich Reply Preview Bar */}
      {replyingTo && replyMeta && (
        <div className="flex items-center justify-between px-3 py-1.5 mb-2 bg-gray-50 border border-gray-200 border-l-4 border-l-brand-primary rounded-xl text-xs animate-in fade-in duration-150">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="min-w-0 flex-1">
              <span className="font-bold text-brand-primary block text-[11px] leading-tight">
                Respondendo a {replyingTo.nickname}
              </span>
              <div className="flex items-center gap-1.5 text-gray-600 truncate text-xs mt-0.5">
                <ReplyPreviewContent meta={replyMeta} iconSizeClass="w-3.5 h-3.5" />
              </div>
            </div>
            {replyMeta.kind === 'image' && replyMeta.imageUrl && (
              <img
                src={replyMeta.imageUrl}
                alt="Thumbnail"
                className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0"
              />
            )}
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            className="p-1 rounded-md hover:bg-gray-200 text-gray-400 hover:text-gray-600 ml-2 cursor-pointer shrink-0"
            title="Cancelar resposta"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Attachment Preview Chip */}
      {attachment && (
        <div className="flex items-center justify-between px-3 py-1.5 mb-2 bg-brand-primary/10 border border-brand-primary/20 rounded-xl text-xs animate-in fade-in duration-150">
          <div className="flex items-center gap-2 truncate text-brand-primary font-medium">
            <Paperclip className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{attachment.name}</span>
            <span className="text-[10px] text-gray-400 font-mono">({attachment.size})</span>
          </div>
          <button
            type="button"
            onClick={onClearAttachment}
            className="p-1 rounded-md hover:bg-brand-primary/20 text-brand-primary ml-2 cursor-pointer"
            title="Remover anexo"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Live Voice Recording Bar */}
      {isRecordingVoice ? (
        <div className="flex items-center justify-between gap-3 px-4 py-2 rounded-2xl bg-red-50 border border-red-200">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
            <span className="text-xs font-mono font-bold text-red-700">
              Gravando {Math.floor(recordingSeconds / 60)}:
              {(recordingSeconds % 60).toString().padStart(2, '0')}
            </span>
          </div>

          <div className="flex flex-1 items-center justify-center gap-1 h-6 max-w-xs overflow-hidden">
            {recordingWaveform.map((bar, idx) => (
              <span
                key={idx}
                className="w-1 rounded-full bg-red-500 transition-all duration-100"
                style={{ height: `${Math.max(20, Math.min(100, bar))}%` }}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCancelVoiceRecording}
              className="px-3 py-1.5 rounded-xl bg-white border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-100"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onFinishVoiceRecording}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-brand-primary text-white text-xs font-bold hover:opacity-90"
            >
              <Square className="w-3 h-3 fill-current" />
              <span>Enviar Áudio</span>
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={onFileChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={onAttachmentClick}
            className="p-2.5 rounded-full hover:bg-gray-100 text-ink-muted hover:text-brand-primary transition-all tactile-btn flex items-center justify-center cursor-pointer"
            title="Anexar imagem ou documento (verificado com SHA-256)"
          >
            <Paperclip className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onOpenCreatePoll}
            className="p-2.5 rounded-full hover:bg-gray-100 text-ink-muted hover:text-brand-primary transition-all tactile-btn flex items-center justify-center cursor-pointer"
            title="Criar Enquete Interativa"
          >
            <BarChart3 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onStartVoiceRecording}
            disabled={isUploadingMedia}
            className="p-2.5 rounded-full hover:bg-gray-100 text-ink-muted hover:text-brand-primary transition-all tactile-btn flex items-center justify-center cursor-pointer"
            title="Gravar Nota de Voz Real"
          >
            <Mic className="w-4 h-4" />
          </button>
          <input
            type="text"
            value={inputText}
            onChange={onInputChange}
            placeholder={editingMessage ? 'Edite sua mensagem...' : 'Digite uma mensagem...'}
            className="flex-1 px-4 py-2.5 rounded-2xl bg-gray-50/90 border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-brand-primary focus:bg-white transition-all"
          />
          <button
            type="submit"
            disabled={(!inputText.trim() && !attachment) || isUploadingMedia}
            className="p-2.5 rounded-full bg-brand-primary text-white font-bold hover:bg-brand-primary/90 disabled:opacity-40 shadow-xs tactile-btn transition-all flex items-center justify-center cursor-pointer"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      )}
    </footer>
  );
};
