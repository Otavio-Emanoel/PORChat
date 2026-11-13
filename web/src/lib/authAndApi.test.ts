import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  getStoredUser,
  getStoredToken,
  setStoredSession,
  clearStoredSession,
  loginWithCredentials,
  validateSession,
  type User,
} from './auth';
import {
  editRoomMessageApi,
  createRoomPollApi,
  fetchRoomLeaderboard,
  fetchRoomQuestions,
  createCustomDebateTopic,
} from './apiClient';

const originalWindow = (globalThis as { window?: unknown }).window;
const originalLocalStorage = (globalThis as { localStorage?: unknown }).localStorage;
const originalFetch = globalThis.fetch;

let storageMap: Map<string, string>;

beforeEach(() => {
  storageMap = new Map<string, string>();
  (globalThis as { window?: unknown }).window = {};
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (key: string) => storageMap.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storageMap.set(key, value);
    },
    removeItem: (key: string) => {
      storageMap.delete(key);
    },
  };
});

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
  globalThis.fetch = originalFetch;
});

const demoUser: User = {
  id: 'usr-1',
  nickname: 'Otavio',
  email: 'otavio@porchat.app',
  avatar_color: '#6C5CE7',
  status_text: 'Pronto pro debate',
};

describe('Web Auth & API Client', () => {
  it('stores, reads, and clears user session in localStorage', () => {
    setStoredSession(demoUser, 'jwt-token-123');
    assert.deepEqual(getStoredUser(), demoUser);
    assert.equal(getStoredToken(), 'jwt-token-123');
    assert.equal(storageMap.get('porchat_avatar_color'), '#6C5CE7');
    assert.equal(storageMap.get('porchat_status_text'), 'Pronto pro debate');

    clearStoredSession();
    assert.equal(getStoredUser(), null);
    assert.equal(getStoredToken(), null);
  });

  it('persists session on loginWithCredentials and throws API error on failure', async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ user: demoUser, token: 'tok-abc' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })) as typeof fetch;

    const res = await loginWithCredentials('otavio@porchat.app', 'secret123');
    assert.equal(res.token, 'tok-abc');
    assert.equal(getStoredToken(), 'tok-abc');

    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ error: 'Credenciais inválidas' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })) as typeof fetch;

    await assert.rejects(() => loginWithCredentials('otavio@porchat.app', 'wrong'), /Credenciais inválidas/);
  });

  it('clears stored session when validateSession receives non-OK response', async () => {
    setStoredSession(demoUser, 'expired-token');
    globalThis.fetch = (async () => new Response(null, { status: 401 })) as typeof fetch;

    const user = await validateSession();
    assert.equal(user, null);
    assert.equal(getStoredToken(), null);
  });

  it('sends Authorization header and encoded user query on room API calls', async () => {
    setStoredSession(demoUser, 'tok-xyz');
    const calls: Array<{ url: string; method: string; auth?: string; body?: string }> = [];

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = (init?.headers ?? {}) as Record<string, string>;
      calls.push({
        url: String(input),
        method: init?.method || 'GET',
        auth: headers.Authorization,
        body: typeof init?.body === 'string' ? init.body : undefined,
      });
      return new Response(JSON.stringify({ id: 'msg-1', content: 'Editada' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;

    await editRoomMessageApi('room 1', 'msg/2', 'Editada');
    assert.equal(calls[0].method, 'PUT');
    assert.equal(calls[0].auth, 'Bearer tok-xyz');
    assert.match(calls[0].url, /\/api\/rooms\/room%201\/messages\/msg%2F2\?user=Otavio$/);

    await createRoomPollApi('room-1', 'Melhor linguagem?', ['Go', 'TypeScript'], true);
    assert.equal(calls[1].method, 'POST');
    assert.deepEqual(JSON.parse(calls[1].body || '{}'), {
      question: 'Melhor linguagem?',
      options: ['Go', 'TypeScript'],
      multi_select: true,
    });
  });

  it('returns safe fallbacks on failed leaderboard/questions requests and surfaces custom topic errors', async () => {
    globalThis.fetch = (async () => new Response(null, { status: 500 })) as typeof fetch;
    assert.deepEqual(await fetchRoomLeaderboard('room-1'), []);
    assert.deepEqual(await fetchRoomQuestions('room-1'), {
      custom_questions: [],
      curated_count: 48,
      categories: [],
    });

    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ error: 'Tema duplicado' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })) as typeof fetch;

    await assert.rejects(
      () =>
        createCustomDebateTopic('room-1', {
          topic: 'Tabs vs Espaços',
          category: 'Dev',
          side_a_label: 'Tabs',
          side_b_label: 'Espaços',
          created_by: 'Otavio',
        }),
      /Tema duplicado/
    );
  });
});
