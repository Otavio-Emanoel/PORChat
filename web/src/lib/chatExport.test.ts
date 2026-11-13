import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { ChatMessage } from '@porchat/shared';
import { buildChatArchive, verifyArchiveIntegrity } from './chatExport';

const sampleMessages: ChatMessage[] = [
  {
    id: 'msg-1',
    room_id: 'room-1',
    user_id: 'u1',
    nickname: 'Otavio',
    content: 'Bora começar o debate!',
    type: 'text',
    created_at: '2026-11-13T20:00:01.000Z',
  },
  {
    id: 'msg-sys',
    room_id: 'room-1',
    user_id: 'system',
    nickname: 'Sistema',
    content: 'Pedro entrou na sala',
    type: 'system',
    created_at: '2026-11-13T20:00:02.000Z',
  },
  {
    id: 'msg-2',
    room_id: 'room-1',
    user_id: 'u2',
    nickname: 'Pedro',
    content: 'Fechado!',
    type: 'text',
    created_at: '2026-11-13T20:00:03.000Z',
  },
];

describe('Chat Export & Integrity Suite', () => {
  it('excludes system messages by default and computes verifiable checksum', async () => {
    const archive = await buildChatArchive('room-1', 'Arena Principal', sampleMessages, 'Otavio');

    assert.equal(archive.version, '1.0.0');
    assert.equal(archive.room_id, 'room-1');
    assert.equal(archive.room_name, 'Arena Principal');
    assert.equal(archive.exported_by, 'Otavio');
    assert.equal(archive.messages_count, 2);
    assert.equal(archive.messages.every((m) => m.type !== 'system'), true);
    assert.equal(await verifyArchiveIntegrity(archive), true);
  });

  it('includes system messages when include_system_events is enabled', async () => {
    const archive = await buildChatArchive('room-1', 'Arena Principal', sampleMessages, 'Otavio', {
      format: 'json',
      include_system_events: true,
    });

    assert.equal(archive.messages_count, 3);
    assert.equal(await verifyArchiveIntegrity(archive), true);
  });

  it('detects tampering in exported messages', async () => {
    const archive = await buildChatArchive('room-1', 'Arena Principal', sampleMessages, 'Otavio');
    const tampered = {
      ...archive,
      messages: archive.messages.map((m, idx) =>
        idx === 0 ? { ...m, content: 'Mensagem adulterada' } : m
      ),
    };

    assert.equal(await verifyArchiveIntegrity(tampered), false);
  });
});
