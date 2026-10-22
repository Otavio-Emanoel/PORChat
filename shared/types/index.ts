/**
 * @porchat/shared
 * Shared TypeScript Contracts & Types for PORChat Ecosystem (Web, Mobile & Server sync)
 */

export type ClientType = 'web' | 'mobile' | 'tv';

export type UserRole = 'owner' | 'admin' | 'member';

export type GameRole = 'DEBATER' | 'JUROR' | 'TRIVIA_PLAYER' | 'SPECTATOR';

export interface User {
  id: string;
  nickname: string;
  email: string;
  avatar_url?: string | null;
  created_at?: string;
}

export interface Room {
  id: string;
  name: string;
  code: string;
  is_group: boolean;
  created_by?: string;
  created_at?: string;
  members_count?: number;
}

export interface RoomMember {
  room_id: string;
  user_id: string;
  nickname: string;
  role: UserRole;
  joined_at?: string;
}

export interface ChatMessage {
  id: string;
  room_id: string;
  user_id: string;
  nickname: string;
  content: string;
  type: 'text' | 'game_card' | 'system';
  created_at: string;
  metadata?: Record<string, unknown>;
}

// -------------------------------------------------------------
// WebSocket Standard Envelope
// -------------------------------------------------------------

export interface WebSocketEnvelope<T = unknown> {
  event: string;
  room_id: string;
  timestamp: number;
  payload: T;
}

// -------------------------------------------------------------
// System & Presence Payloads
// -------------------------------------------------------------

export interface SysConnectedPayload {
  user: {
    id: string;
    nickname: string;
    avatar_url?: string | null;
  };
  client_type: ClientType;
  online_users: Array<{ id: string; nickname: string; client_type?: ClientType }>;
  active_game?: GameStateUpdatePayload | null;
}

export interface SysUserJoinedPayload {
  user_id: string;
  nickname: string;
  client_type: ClientType;
}

export interface SysUserLeftPayload {
  user_id: string;
  nickname: string;
  client_type: ClientType;
}

export interface SysErrorPayload {
  code: string;
  message: string;
}

// -------------------------------------------------------------
// Chat Payloads
// -------------------------------------------------------------

export interface ChatSendPayload {
  content: string;
}

export interface ChatNewMessagePayload {
  id: string;
  user_id: string;
  nickname: string;
  content: string;
  type: 'text' | 'game_card' | 'system';
  created_at: string;
}

// -------------------------------------------------------------
// Game Common Payloads & FSM
// -------------------------------------------------------------

export type GameType = 'debate' | 'quiz';

export type DebatePhase =
  | 'LOBBY'
  | 'OPENING_ARGUMENTS'
  | 'REBUTTAL'
  | 'VOTING'
  | 'RESULTS'
  | 'CHAT';

export type QuizPhase =
  | 'LOBBY'
  | 'QUESTION'
  | 'REVEAL'
  | 'LEADERBOARD'
  | 'FINAL_RESULTS'
  | 'CHAT';

export interface GameStartPayload {
  game_type: GameType;
  topic?: string;
  debater_a_id?: string;
  debater_b_id?: string;
}

export interface GameTickPayload {
  remaining_seconds: number;
  phase_ends_at: number;
}

export interface DebaterInfo {
  id: string;
  nickname: string;
  argument?: string;
  votes?: number;
}

export interface DebateState {
  topic: string;
  debater_a: DebaterInfo;
  debater_b: DebaterInfo;
  current_speaker_id?: string;
  votes_count: {
    side_a: number;
    side_b: number;
  };
  winner_side?: 'side_a' | 'side_b' | 'tie' | null;
}

export interface QuizQuestion {
  id: string;
  index: number;
  prompt: string;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  total_time_seconds: number;
}

export interface QuizLeaderboardEntry {
  user_id: string;
  nickname: string;
  round_score: number;
  total_score: number;
  rank?: number;
}

export interface QuizState {
  current_question_index: number;
  total_questions: number;
  current_question?: QuizQuestion;
  answers_distribution?: Record<'A' | 'B' | 'C' | 'D', number>;
  correct_option?: 'A' | 'B' | 'C' | 'D';
  leaderboard: QuizLeaderboardEntry[];
}

export interface GameStateUpdatePayload {
  game_type: GameType;
  phase: DebatePhase | QuizPhase;
  phase_ends_at: number;
  remaining_seconds: number;
  debate_state?: DebateState;
  quiz_state?: QuizState;
}

// -------------------------------------------------------------
// Debate Action Payloads
// -------------------------------------------------------------

export interface DebateSubmitArgumentPayload {
  argument: string;
}

export interface DebateCastVotePayload {
  choice: 'side_a' | 'side_b';
}

export interface DebateReactionPayload {
  emoji: '🔥' | '🍅' | '👏' | '🤯' | string;
}

export interface TvReactionStreamPayload {
  reactions: Array<{
    emoji: string;
    count: number;
  }>;
}

// -------------------------------------------------------------
// Quiz Action Payloads
// -------------------------------------------------------------

export interface QuizSubmitAnswerPayload {
  question_index: number;
  choice: 'A' | 'B' | 'C' | 'D';
  client_sent_ms: number;
}

export interface QuizRoundRevealPayload {
  correct_option: 'A' | 'B' | 'C' | 'D';
  answers_distribution: Record<'A' | 'B' | 'C' | 'D', number>;
  leaderboard: QuizLeaderboardEntry[];
}
