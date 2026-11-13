import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeSha256,
  verifyMessageIntegrity,
  sanitizeClientInput,
  isSafeUrl,
  ClientRateLimiter,
  DEFAULT_SECURITY_SETTINGS,
  getStoredSecuritySettings,
  saveStoredSecuritySettings,
} from './security';

const originalWindow = (globalThis as { window?: unknown }).window;
const originalLocalStorage = (globalThis as { localStorage?: unknown }).localStorage;

afterEach(() => {
  if (originalWindow === undefined) {
    delete (globalThis as { window?: unknown }).window;
  } else {
    (globalThis as { window?: unknown }).window = originalWindow;
  }
  if (originalLocalStorage === undefined) {
    delete (globalThis as { localStorage?: unknown }).localStorage;
  } else {
    (globalThis as { localStorage?: unknown }).localStorage = originalLocalStorage;
  }
});

describe('Web Security Suite', () => {
  it('computes deterministic hashes and verifies message integrity', async () => {
    const hashA = await computeSha256('porchat-message-1');
    const hashB = await computeSha256('porchat-message-1');
    const hashC = await computeSha256('porchat-message-2');

    assert.equal(hashA, hashB);
    assert.notEqual(hashA, hashC);
    assert.equal(await verifyMessageIntegrity('porchat-message-1', hashA), true);
    assert.equal(await verifyMessageIntegrity('tampered', hashA), false);
    assert.equal(await verifyMessageIntegrity('', hashA), false);
    assert.equal(await verifyMessageIntegrity('porchat-message-1', ''), false);
  });

  it('sanitizes invisible unicode, bidi overrides, control bytes and enforces maxLen', () => {
    assert.equal(sanitizeClientInput('  Olá\u200BMundo  '), 'Olá Mundo');
    assert.equal(sanitizeClientInput('Test\u202EReverse'), 'TestReverse');
    assert.equal(sanitizeClientInput('line1\n\tline2\x00\x07'), 'line1\n\tline2');
    assert.equal(sanitizeClientInput(''), '');
    assert.equal(sanitizeClientInput('x'.repeat(100), 12), 'x'.repeat(12));
  });

  it('validates safe vs dangerous URL schemes', () => {
    assert.equal(isSafeUrl('https://porchat.app/room/123').isSafe, true);
    assert.equal(isSafeUrl('http://localhost:3001').isSafe, true);
    assert.equal(isSafeUrl('mailto:oi@porchat.app').isSafe, true);
    assert.equal(isSafeUrl('tel:+5511999999999').isSafe, true);

    assert.equal(isSafeUrl('javascript:alert(1)').isSafe, false);
    assert.equal(isSafeUrl('data:text/html,<script>alert(1)</script>').isSafe, false);
    assert.equal(isSafeUrl('vbscript:msgbox(1)').isSafe, false);
    assert.equal(isSafeUrl('file:///etc/passwd').isSafe, false);
  });

  it('enforces token bucket rate limiting and resets cleanly', () => {
    const limiter = new ClientRateLimiter(2, 60000);
    assert.equal(limiter.allow(), true);
    assert.equal(limiter.allow(), true);
    assert.equal(limiter.allow(), false);
    assert.ok(limiter.getRemainingCooldownMs() > 0);

    limiter.reset();
    assert.equal(limiter.getRemainingCooldownMs(), 0);
    assert.equal(limiter.allow(), true);
  });

  it('returns default security settings on SSR and persists updates in localStorage', () => {
    delete (globalThis as { window?: unknown }).window;
    assert.deepEqual(getStoredSecuritySettings(), DEFAULT_SECURITY_SETTINGS);

    const store = new Map<string, string>();
    const mockStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
    };

    (globalThis as { window?: unknown }).window = {};
    (globalThis as { localStorage?: unknown }).localStorage = mockStorage;

    const custom = { ...DEFAULT_SECURITY_SETTINGS, session_timeout_minutes: 15, link_safety_interceptor: false };
    saveStoredSecuritySettings(custom);
    assert.deepEqual(getStoredSecuritySettings(), custom);
  });
});
