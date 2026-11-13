import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getMonogram, formatRelativeTime, resolveMediaUrl, getReplyPreviewMeta } from './chatHelpers';

describe('Web Chat Helpers', () => {
  it('computes two-letter monograms from names', () => {
    assert.equal(getMonogram('Otavio Emanoel'), 'OE');
    assert.equal(getMonogram('Pedro'), 'PE');
    assert.equal(getMonogram('  Raul  Silva '), 'RS');
    assert.equal(getMonogram(''), '');
  });

  it('formats relative timestamps deterministically', () => {
    const base = new Date('2026-11-13T18:00:00.000Z').getTime();
    assert.equal(formatRelativeTime(new Date(base - 5000).toISOString(), base), 'agora');
    assert.equal(formatRelativeTime(new Date(base - 30000).toISOString(), base), 'há 30s');
    assert.equal(formatRelativeTime(new Date(base - 5 * 60000).toISOString(), base), 'há 5 min');
    assert.equal(formatRelativeTime('not-a-date', base), '');
  });

  it('resolves relative and absolute media URLs', () => {
    assert.equal(resolveMediaUrl(null, 'http://localhost:8081'), null);
    assert.equal(resolveMediaUrl('https://cdn.example.com/a.png', 'http://localhost:8081'), 'https://cdn.example.com/a.png');
    assert.equal(resolveMediaUrl('data:image/png;base64,abc', 'http://localhost:8081'), 'data:image/png;base64,abc');
    assert.equal(resolveMediaUrl('/api/attachments/123', 'http://localhost:8081'), 'http://localhost:8081/api/attachments/123');
  });

  it('extracts unified reply preview metadata for images, voice, documents, polls, and text', () => {
    const imgMeta = getReplyPreviewMeta(
      { id: '1', nickname: 'Pedro', content: 'Imagem: foto.png', type: 'image', media_url: '/api/attachments/1', file_name: 'foto.png' },
      'http://localhost:8081'
    );
    assert.deepEqual(imgMeta, {
      kind: 'image',
      label: 'foto.png',
      imageUrl: 'http://localhost:8081/api/attachments/1',
    });

    const voiceMeta = getReplyPreviewMeta(
      { id: '2', nickname: 'Raul', content: '[Mensagem de Voz]', type: 'voice' },
      'http://localhost:8081'
    );
    assert.deepEqual(voiceMeta, { kind: 'voice', label: 'Mensagem de voz', imageUrl: null });

    const textMeta = getReplyPreviewMeta(
      { id: '3', nickname: 'Otavio', content: 'Bora jogar!' },
      'http://localhost:8081'
    );
    assert.deepEqual(textMeta, { kind: 'text', label: 'Bora jogar!', imageUrl: null });
  });
});
