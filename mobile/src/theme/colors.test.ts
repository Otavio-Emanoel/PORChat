import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { colors } from './colors';

describe('Mobile Design System Tokens', () => {
  it('defines canonical PORChat brand colors', () => {
    assert.equal(colors.brand.primary, '#6C5CE7');
    assert.equal(colors.brand.action, '#FF7675');
    assert.equal(colors.brand.reward, '#FDCB6E');
    assert.equal(colors.brand.mint, '#00CEC9');
  });

  it('defines canonical surface and ink colors', () => {
    assert.equal(colors.surface.light, '#F8F9FA');
    assert.equal(colors.surface.tv, '#1E1E2E');
    assert.equal(colors.ink.main, '#2D3436');
  });

  it('defines canonical quiz controller button colors', () => {
    assert.equal(colors.quiz.a, '#FF6B6B');
    assert.equal(colors.quiz.b, '#48DBFB');
    assert.equal(colors.quiz.c, '#FECA57');
    assert.equal(colors.quiz.d, '#1DD1A1');
  });
});
