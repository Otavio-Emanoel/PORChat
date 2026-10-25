/**
 * @porchat/shared
 * Shared TypeScript Contracts & Types for PORChat Ecosystem (Web, Mobile & Server sync)
 */

export type ClientType = 'web' | 'mobile' | 'tv';

export type UserRole = 'owner' | 'admin' | 'member';

export type GameRole = 'DEBATER' | 'JUROR' | 'TRIVIA_PLAYER' | 'SPECTATOR';

export type QuizOptionKey = 'A' | 'B' | 'C' | 'D';

export type DebateSide = 'side_a' | 'side_b';

export type ReactionEmoji = '🔥' | '💀' | '🍅' | '👏' | '🤯' | '👑' | '🎯' | '🎉' | '⭐';

export interface User {
  id: string;
  nickname: string;
  email: string;
  avatar_url?: string | null;
  avatar_emoji?: string;
  status_text?: string;
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
  last_message?: string;
  last_message_at?: string;
  unread_count?: number;
}

export interface RoomMember {
  room_id: string;
  user_id: string;
  nickname: string;
  role: UserRole;
  avatar_emoji?: string;
  status_text?: string;
  joined_at?: string;
}

export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read';

export interface ChatMessage {
  id: string;
  room_id: string;
  user_id: string;
  nickname: string;
  content: string;
  type: 'text' | 'game_card' | 'system';
  created_at: string;
  status?: MessageStatus;
  game_data?: {
    game_type: 'debate' | 'quiz';
    topic?: string;
    category?: string;
    action_label?: string;
  };
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
    avatar_emoji?: string;
    status_text?: string;
  };
  client_type: ClientType;
  online_users: Array<{ id: string; nickname: string; client_type?: ClientType; avatar_emoji?: string }>;
  active_game?: GameStateUpdatePayload | null;
}

export interface SysUserJoinedPayload {
  user_id: string;
  nickname: string;
  client_type: ClientType;
  avatar_emoji?: string;
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

export interface ChatTypingPayload {
  user_id: string;
  nickname: string;
  is_typing: boolean;
}

export interface ChatNewMessagePayload extends ChatMessage {}

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
  category?: string;
  debater_a_id?: string;
  debater_b_id?: string;
  round_count?: number;
}

export interface GameTickPayload {
  remaining_seconds: number;
  phase_ends_at: number;
}

export interface DebaterInfo {
  id: string;
  nickname: string;
  avatar?: string;
  argument?: string;
  votes?: number;
}

export interface DebateState {
  topic: string;
  category?: string;
  side_a_label?: string;
  side_b_label?: string;
  debater_a: DebaterInfo;
  debater_b: DebaterInfo;
  juror_ids?: string[];
  current_speaker_id?: string;
  votes_count: {
    side_a: number;
    side_b: number;
  };
  winner_side?: 'side_a' | 'side_b' | 'tie' | null;
  is_paused?: boolean;
}

export interface TriviaQuestion {
  id: string;
  index: number;
  prompt: string;
  category?: string;
  options: Record<QuizOptionKey, string>;
  correct_option?: QuizOptionKey;
  total_time_seconds: number;
}

export interface QuizLeaderboardEntry {
  user_id: string;
  nickname: string;
  round_score: number;
  total_score: number;
  streak?: number;
  streak_multiplier?: number;
  response_time_ms?: number;
  last_answer_correct?: boolean;
  rank?: number;
}

export interface QuizState {
  current_question_index: number;
  total_questions: number;
  current_question?: TriviaQuestion;
  answers_distribution?: Record<QuizOptionKey, number>;
  correct_option?: QuizOptionKey | '';
  leaderboard: QuizLeaderboardEntry[];
  is_paused?: boolean;
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
  choice: DebateSide;
}

export interface DebateReactionPayload {
  emoji: ReactionEmoji | string;
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
  question_index?: number;
  choice: QuizOptionKey;
  client_sent_ms: number;
}

export interface QuizRoundRevealPayload {
  correct_option: QuizOptionKey;
  answers_distribution: Record<QuizOptionKey, number>;
  leaderboard: QuizLeaderboardEntry[];
}

// -------------------------------------------------------------
// Demo Bots Payloads
// -------------------------------------------------------------

export interface BotsTogglePayload {
  enabled: boolean;
  count?: number;
}

export interface BotsStatusPayload {
  active_bots: string[];
}
