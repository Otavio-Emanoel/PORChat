import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatRoomPin,
  getAvatarBgColor,
  getMobileReplyPreviewMeta,
  getMonogram,
  getReactionMeta,
  resolveMobileMediaUrl,
} from './chatHelpers';

describe('Mobile Chat Helpers', () => {
  it('computes monograms and deterministic avatar colors', () => {
    assert.equal(getMonogram('Otavio Emanoel'), 'OE');
    assert.equal(getMonogram('Pedro'), 'P');
    assert.equal(getMonogram(''), '?');

    const c1 = getAvatarBgColor('room-123');
    const c2 = getAvatarBgColor('room-123');
    assert.equal(c1, c2);
    assert.match(c1, /^#[0-9A-F]{6}$/i);
  });

  it('formats room PIN codes cleanly', () => {
    assert.equal(formatRoomPin('1234'), 'POR-1234');
    assert.equal(formatRoomPin('por-ab12'), 'POR-AB12');
    assert.equal(formatRoomPin('por!@#987654'), 'POR-98765');
    assert.equal(formatRoomPin('POR'), '');
  });

  it('resolves mobile media URLs against serverHost', () => {
    assert.equal(resolveMobileMediaUrl(null, '192.168.1.10:8081'), null);
    assert.equal(
      resolveMobileMediaUrl('/api/attachments/abc', '192.168.1.10:8081'),
      'http://192.168.1.10:8081/api/attachments/abc'
    );
    assert.equal(
      resolveMobileMediaUrl('https://cdn.example.com/pic.jpg', '192.168.1.10:8081'),
      'https://cdn.example.com/pic.jpg'
    );
  });

  it('returns reaction metadata with fallback', () => {
    assert.equal(getReactionMeta('FIRE').iconName, 'flame');
    assert.equal(getReactionMeta('custom').iconName, 'thumbs-up');
  });

  it('derives unified reply preview metadata for mobile bubbles and composer bar', () => {
    const imageMeta = getMobileReplyPreviewMeta(
      {
        id: 'm1',
        nickname: 'Pedro',
        content: 'Imagem: foto.jpg',
        type: 'image',
        media_url: '/api/attachments/img1',
        file_name: 'foto.jpg',
      },
      '10.0.2.2:8081'
    );
    assert.deepEqual(imageMeta, {
      kind: 'image',
      label: 'foto.jpg',
      imageUri: 'http://10.0.2.2:8081/api/attachments/img1',
    });

    const voiceMeta = getMobileReplyPreviewMeta(
      { id: 'm2', nickname: 'Raul', content: '[Voz]', type: 'voice' },
      '10.0.2.2:8081'
    );
    assert.deepEqual(voiceMeta, {
      kind: 'voice',
      label: 'Mensagem de voz',
      imageUri: null,
    });
  });
});
