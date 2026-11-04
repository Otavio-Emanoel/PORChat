'use client';

import { getStoredToken, getStoredUser, setStoredSession } from './auth';
import type {
  Room,
  ChatMessage,
  ChatPoll,
  PinnedMessageInfo,
  RoomLeaderboardEntry,
  MatchHistoryRecord,
  PlayerCareerStats,
  CustomDebateTopic,
  CustomTriviaQuestion,
  QuizOptionKey,
  User,
} from './types';

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8081';

function buildHeaders(includeJson = true): Record<string, string> {
  const headers: Record<string, string> = {};
  if (includeJson) {
    headers['Content-Type'] = 'application/json';
  }
  const token = getStoredToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

function appendUserQuery(url: string): string {
  const user = getStoredUser();
  if (!user?.nickname) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}user=${encodeURIComponent(user.nickname)}`;
}

// --- User Profile, Password & Contact Search ---

export async function updateUserProfile(payload: {
  nickname?: string;
  avatar_color?: string;
  status_text?: string;
  bio?: string;
}): Promise<User> {
  const res = await fetch(`${API_BASE}/api/auth/profile`, {
    method: 'PUT',
    headers: buildHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Falha ao atualizar perfil' }));
    throw new Error(err.error || 'Falha ao atualizar perfil');
  }
  const data = await res.json();
  if (data.user && data.token) {
    setStoredSession(data.user, data.token);
  }
  return data.user;
}

export async function changeUserPassword(currentPassword: string, newPassword: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/auth/password`, {
    method: 'PUT',
    headers: buildHeaders(),
    body: JSON.stringify({
      current_password: currentPassword,
      new_password: newPassword,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Falha ao alterar senha' }));
    throw new Error(err.error || 'Falha ao alterar senha');
  }
  const data = await res.json();
  if (data.user && data.token) {
    setStoredSession(data.user, data.token);
  }
}

export async function searchContacts(query = ''): Promise<User[]> {
  const res = await fetch(`${API_BASE}/api/users/search?q=${encodeURIComponent(query)}`, {
    headers: buildHeaders(false),
  });
  if (!res.ok) return [];
  return res.json();
}

export async function fetchPlayerCareerStats(userIdOrNick: string): Promise<PlayerCareerStats | null> {
  const res = await fetch(`${API_BASE}/api/users/${encodeURIComponent(userIdOrNick)}/stats`, {
    headers: buildHeaders(false),
  });
  if (!res.ok) return null;
  return res.json();
}

// --- Room & Group Management ---

export async function leaveRoomApi(roomId: string): Promise<Room> {
  const res = await fetch(appendUserQuery(`${API_BASE}/api/rooms/${encodeURIComponent(roomId)}/leave`), {
    method: 'POST',
    headers: buildHeaders(),
  });
  if (!res.ok) {
    throw new Error('Não foi possível sair da conversa');
  }
  return res.json();
}

export async function addGroupMembersApi(roomId: string, members: string[]): Promise<Room> {
  const res = await fetch(appendUserQuery(`${API_BASE}/api/rooms/${encodeURIComponent(roomId)}/members`), {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify({ members }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Falha ao adicionar membros' }));
    throw new Error(err.error || 'Falha ao adicionar membros');
  }
  return res.json();
}

export async function removeGroupMemberApi(roomId: string, member: string): Promise<Room> {
  const res = await fetch(
    appendUserQuery(`${API_BASE}/api/rooms/${encodeURIComponent(roomId)}/members/${encodeURIComponent(member)}`),
    {
      method: 'DELETE',
      headers: buildHeaders(false),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Falha ao remover membro' }));
    throw new Error(err.error || 'Falha ao remover membro');
  }
  return res.json();
}

export async function toggleGroupAdminApi(roomId: string, member: string): Promise<Room> {
  const res = await fetch(appendUserQuery(`${API_BASE}/api/rooms/${encodeURIComponent(roomId)}/admins`), {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify({ member }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Falha ao atualizar administrador' }));
    throw new Error(err.error || 'Falha ao atualizar administrador');
  }
  return res.json();
}

export async function updateGroupSettingsApi(
  roomId: string,
  settings: { name: string; description: string }
): Promise<Room> {
  const res = await fetch(appendUserQuery(`${API_BASE}/api/rooms/${encodeURIComponent(roomId)}/settings`), {
    method: 'PUT',
    headers: buildHeaders(),
    body: JSON.stringify(settings),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Falha ao salvar configurações' }));
    throw new Error(err.error || 'Falha ao salvar configurações');
  }
  return res.json();
}

export async function regenerateRoomCodeApi(roomId: string): Promise<Room> {
  const res = await fetch(appendUserQuery(`${API_BASE}/api/rooms/${encodeURIComponent(roomId)}/code/regenerate`), {
    method: 'POST',
    headers: buildHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Falha ao regenerar código' }));
    throw new Error(err.error || 'Falha ao regenerar código');
  }
  return res.json();
}

// --- Messages, Attachments & Polls ---

export async function uploadRoomAttachment(
  roomId: string,
  payload: {
    kind: 'audio' | 'image' | 'document';
    file_name: string;
    mime_type: string;
    data_base64: string;
    caption?: string;
    duration_seconds?: number;
    waveform?: number[];
    reply_to_id?: string;
  }
): Promise<ChatMessage> {
  const res = await fetch(appendUserQuery(`${API_BASE}/api/rooms/${encodeURIComponent(roomId)}/attachments`), {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Falha ao enviar anexo' }));
    throw new Error(err.error || 'Falha ao enviar anexo');
  }
  return res.json();
}

export async function editRoomMessageApi(
  roomId: string,
  messageId: string,
  content: string
): Promise<ChatMessage> {
  const res = await fetch(
    appendUserQuery(`${API_BASE}/api/rooms/${encodeURIComponent(roomId)}/messages/${encodeURIComponent(messageId)}`),
    {
      method: 'PUT',
      headers: buildHeaders(),
      body: JSON.stringify({ content }),
    }
  );
  if (!res.ok) {
    throw new Error('Não foi possível editar a mensagem');
  }
  return res.json();
}

export async function pinRoomMessageApi(roomId: string, messageId: string): Promise<PinnedMessageInfo> {
  const res = await fetch(appendUserQuery(`${API_BASE}/api/rooms/${encodeURIComponent(roomId)}/pin`), {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify({ message_id: messageId }),
  });
  if (!res.ok) {
    throw new Error('Não foi possível fixar a mensagem');
  }
  return res.json();
}

export async function unpinRoomMessageApi(roomId: string): Promise<void> {
  await fetch(appendUserQuery(`${API_BASE}/api/rooms/${encodeURIComponent(roomId)}/pin`), {
    method: 'DELETE',
    headers: buildHeaders(false),
  });
}

export async function createRoomPollApi(
  roomId: string,
  question: string,
  options: string[],
  multiSelect = false
): Promise<ChatMessage> {
  const res = await fetch(appendUserQuery(`${API_BASE}/api/rooms/${encodeURIComponent(roomId)}/polls`), {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify({
      question,
      options,
      multi_select: multiSelect,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Falha ao criar enquete' }));
    throw new Error(err.error || 'Falha ao criar enquete');
  }
  return res.json();
}

export async function voteRoomPollApi(
  roomId: string,
  messageId: string,
  optionId: string
): Promise<ChatPoll> {
  const res = await fetch(
    appendUserQuery(`${API_BASE}/api/rooms/${encodeURIComponent(roomId)}/polls/${encodeURIComponent(messageId)}/vote`),
    {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify({ option_id: optionId }),
    }
  );
  if (!res.ok) {
    throw new Error('Não foi possível registrar voto na enquete');
  }
  return res.json();
}

export async function closeRoomPollApi(roomId: string, messageId: string): Promise<ChatPoll> {
  const res = await fetch(
    appendUserQuery(`${API_BASE}/api/rooms/${encodeURIComponent(roomId)}/polls/${encodeURIComponent(messageId)}/close`),
    {
      method: 'POST',
      headers: buildHeaders(),
    }
  );
  if (!res.ok) {
    throw new Error('Não foi possível encerrar a enquete');
  }
  return res.json();
}

// --- Leaderboards, Match History & Custom Banks ---

export async function fetchRoomLeaderboard(roomId: string): Promise<RoomLeaderboardEntry[]> {
  const res = await fetch(`${API_BASE}/api/rooms/${encodeURIComponent(roomId)}/leaderboard`, {
    headers: buildHeaders(false),
  });
  if (!res.ok) return [];
  return res.json();
}

export async function fetchRoomMatchHistory(roomId: string): Promise<MatchHistoryRecord[]> {
  const res = await fetch(`${API_BASE}/api/rooms/${encodeURIComponent(roomId)}/history`, {
    headers: buildHeaders(false),
  });
  if (!res.ok) return [];
  return res.json();
}

export interface RoomTopicsResponse {
  custom_topics: CustomDebateTopic[];
  curated_topics: Array<{
    topic: string;
    category: string;
    side_a_label: string;
    side_b_label: string;
  }>;
}

export async function fetchRoomTopics(roomId: string): Promise<RoomTopicsResponse> {
  const res = await fetch(`${API_BASE}/api/rooms/${encodeURIComponent(roomId)}/topics`, {
    headers: buildHeaders(false),
  });
  if (!res.ok) {
    return { custom_topics: [], curated_topics: [] };
  }
  return res.json();
}

export async function createCustomDebateTopic(
  roomId: string,
  payload: {
    topic: string;
    category: string;
    side_a_label: string;
    side_b_label: string;
    created_by: string;
  }
): Promise<CustomDebateTopic> {
  const res = await fetch(`${API_BASE}/api/rooms/${encodeURIComponent(roomId)}/topics`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Falha ao criar tema' }));
    throw new Error(err.error || 'Falha ao criar tema');
  }
  return res.json();
}

export interface RoomQuestionsResponse {
  custom_questions: CustomTriviaQuestion[];
  curated_count: number;
  categories: string[];
}

export async function fetchRoomQuestions(roomId: string): Promise<RoomQuestionsResponse> {
  const res = await fetch(`${API_BASE}/api/rooms/${encodeURIComponent(roomId)}/questions`, {
    headers: buildHeaders(false),
  });
  if (!res.ok) {
    return { custom_questions: [], curated_count: 48, categories: [] };
  }
  return res.json();
}

export async function createCustomTriviaQuestion(
  roomId: string,
  payload: {
    prompt: string;
    category: string;
    difficulty: 'Fácil' | 'Média' | 'Difícil';
    options: Record<QuizOptionKey, string>;
    correct_option: QuizOptionKey;
    created_by: string;
  }
): Promise<CustomTriviaQuestion> {
  const res = await fetch(`${API_BASE}/api/rooms/${encodeURIComponent(roomId)}/questions`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Falha ao criar pergunta' }));
    throw new Error(err.error || 'Falha ao criar pergunta');
  }
  return res.json();
}
