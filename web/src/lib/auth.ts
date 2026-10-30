export interface User {
  id: string;
  nickname: string;
  email: string;
  avatar_url?: string;
  created_at?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8081';
const USER_KEY = 'porchat_user';
const TOKEN_KEY = 'porchat_token';

export function getStoredUser(): User | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredSession(user: User, token: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredSession() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(TOKEN_KEY);
}

export async function logoutUser(): Promise<void> {
  const token = getStoredToken();
  if (token) {
    try {
      await fetch(`${API_BASE}/api/auth/logout`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
    } catch {
      // Ignore network errors on logout
    }
  }
  clearStoredSession();
}

export async function validateSession(): Promise<User | null> {
  const token = getStoredToken();
  if (!token) return null;

  try {
    const res = await fetch(`${API_BASE}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) {
      clearStoredSession();
      return null;
    }
    const data = await res.json();
    return data.user || null;
  } catch {
    return getStoredUser();
  }
}

export async function loginWithCredentials(email: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({ error: 'Falha no login' }));
    throw new Error(errData.error || 'Credenciais inválidas');
  }

  const data: AuthResponse = await res.json();
  setStoredSession(data.user, data.token);
  return data;
}

export async function registerWithCredentials(
  nickname: string,
  email: string,
  password: string
): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nickname, email, password }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({ error: 'Falha no cadastro' }));
    throw new Error(errData.error || 'Não foi possível cadastrar usuário');
  }

  const data: AuthResponse = await res.json();
  setStoredSession(data.user, data.token);
  return data;
}

// 1-Click quick login for pre-seeded demo accounts
export async function loginDemoUser(profile: 'Otavio' | 'Pedro' | 'Raul'): Promise<AuthResponse> {
  const emailMap: Record<string, string> = {
    Otavio: 'otavio@porchat.app',
    Pedro: 'pedro@porchat.app',
    Raul: 'raul@porchat.app',
  };
  return loginWithCredentials(emailMap[profile], '123456');
}
