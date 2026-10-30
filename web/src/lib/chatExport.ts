/**
 * PORChat Secure Chat Export & Integrity Suite
 * Exports chat conversations to JSON or text format with SHA-256 anti-tamper checksums.
 */

import { ChatMessage, ChatExportArchive, ChatExportOptions } from '@porchat/shared';
import { computeSha256 } from './security';

/**
 * Builds a tamper-evident ChatExportArchive with SHA-256 integrity hash.
 */
export async function buildChatArchive(
  roomId: string,
  roomName: string,
  messages: ChatMessage[],
  exportedBy: string,
  options?: ChatExportOptions
): Promise<ChatExportArchive> {
  const filteredMessages = options?.include_system_events
    ? messages
    : messages.filter((m) => m.type !== 'system');

  // Compute canonical checksum of the message feed
  const canonicalContent = filteredMessages
    .map((m) => `${m.id}|${m.user_id}|${m.created_at}|${m.content}`)
    .join('\n');

  const sha256_checksum = await computeSha256(canonicalContent);

  return {
    version: '1.0.0',
    room_id: roomId,
    room_name: roomName,
    exported_at: new Date().toISOString(),
    exported_by: exportedBy,
    messages_count: filteredMessages.length,
    sha256_checksum,
    messages: filteredMessages,
  };
}

/**
 * Verifies that a previously exported archive's messages match its SHA-256 checksum.
 */
export async function verifyArchiveIntegrity(archive: ChatExportArchive): Promise<boolean> {
  if (!archive || !archive.messages || !archive.sha256_checksum) return false;

  const canonicalContent = archive.messages
    .map((m) => `${m.id}|${m.user_id}|${m.created_at}|${m.content}`)
    .join('\n');

  const actualHash = await computeSha256(canonicalContent);
  return actualHash.toLowerCase() === archive.sha256_checksum.toLowerCase();
}

/**
 * Triggers a browser download of the chat in tamper-evident JSON format.
 */
export async function downloadChatJson(
  roomId: string,
  roomName: string,
  messages: ChatMessage[],
  exportedBy: string,
  options?: ChatExportOptions
): Promise<ChatExportArchive> {
  const archive = await buildChatArchive(roomId, roomName, messages, exportedBy, options);
  const jsonBlob = new Blob([JSON.stringify(archive, null, 2)], {
    type: 'application/json;charset=utf-8',
  });

  const url = URL.createObjectURL(jsonBlob);
  const a = document.createElement('a');
  const safeFilename = roomName.toLowerCase().replace(/[^a-z0-9]/g, '_');
  a.href = url;
  a.download = `porchat_export_${safeFilename}_${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return archive;
}

/**
 * Triggers a browser download of the chat in human-readable plain text format.
 */
export async function downloadChatTxt(
  roomId: string,
  roomName: string,
  messages: ChatMessage[],
  exportedBy: string,
  options?: ChatExportOptions
): Promise<void> {
  const archive = await buildChatArchive(roomId, roomName, messages, exportedBy, options);

  let text = `=====================================================\n`;
  text += `PORChat — Relatório de Conversa Exportada\n`;
  text += `Sala: ${roomName} (${roomId})\n`;
  text += `Data da Exportação: ${new Date(archive.exported_at).toLocaleString('pt-BR')}\n`;
  text += `Exportado por: ${exportedBy}\n`;
  text += `Total de Mensagens: ${archive.messages_count}\n`;
  text += `SHA-256 Checksum: ${archive.sha256_checksum}\n`;
  text += `=====================================================\n\n`;

  for (const m of archive.messages) {
    const time = new Date(m.created_at).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    if (m.type === 'system') {
      text += `[${time}] *** ${m.content} ***\n`;
    } else {
      text += `[${time}] ${m.nickname}: ${m.content}\n`;
    }
  }

  text += `\n=====================================================\n`;
  text += `Fim do Registro de Conversa • PORChat\n`;

  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeFilename = roomName.toLowerCase().replace(/[^a-z0-9]/g, '_');
  a.href = url;
  a.download = `porchat_export_${safeFilename}_${Date.now()}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
