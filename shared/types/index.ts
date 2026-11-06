/**
 * @porchat/shared
 * Shared TypeScript Contracts & Types for PORChat Ecosystem (Web, Mobile & Server sync)
 */

export type ClientType = 'web' | 'mobile' | 'tv';

export type UserRole = 'owner' | 'admin' | 'member';

export type GameRole = 'DEBATER' | 'JUROR' | 'TRIVIA_PLAYER' | 'SPECTATOR';

export type QuizOptionKey = 'A' | 'B' | 'C' | 'D';

export type DebateSide = 'side_a' | 'side_b';

export type ReactionEmoji = 'like' | 'heart' | 'smile' | 'star' | 'applause' | 'agree' | string;

export type TriviaDifficulty = 'Fácil' | 'Média' | 'Difícil' | 'Todas';

export interface User {
  id: string;
  nickname: string;
  email: string;
  avatar_url?: string | null;
  avatar_color?: string;
  status_text?: string;
  bio?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ProfileUpdateRequest {
  nickname?: string;
  avatar_url?: string;
  avatar_color?: string;
  status_text?: string;
  bio?: string;
}

export interface PasswordChangeRequest {
  current_password: string;
  new_password: string;
}

export interface PinnedMessageInfo {
  message_id: string;
  content: string;
  sender_nickname: string;
  pinned_by: string;
  pinned_at: string;
}

export interface Room {
  id: string;
  name: string;
  code: string;
  description?: string;
  is_group: boolean;
  members?: string[];
  admins?: string[];
  created_by?: string;
  created_at?: string;
  members_count?: number;
  last_message?: string;
  last_message_at?: string;
  unread_count?: number;
  pinned_message?: PinnedMessageInfo | null;
}

export interface RoomMember {
  room_id: string;
  user_id: string;
  nickname: string;
  role: UserRole;
  avatar_color?: string;
  status_text?: string;
  bio?: string;
  is_online?: boolean;
  joined_at?: string;
}

export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read';

export type AttachmentKind = 'audio' | 'image' | 'document';

export interface MessageAttachment {
  id: string;
  room_id: string;
  kind: AttachmentKind;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  sha256: string;
  url: string;
  data_url?: string;
  duration_seconds?: number;
  waveform?: number[];
  created_at: string;
}

export interface ChatPollOption {
  id: string;
  label: string;
  voter_ids: string[];
}

export interface ChatPoll {
  id: string;
  question: string;
  options: ChatPollOption[];
  multi_select?: boolean;
  is_closed?: boolean;
  created_by: string;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  room_id: string;
  user_id: string;
  nickname: string;
  content: string;
  type: 'text' | 'game_card' | 'system' | 'voice' | 'file' | 'poll' | 'image';
  created_at: string;
  edited_at?: string;
  is_edited?: boolean;
  reply_to_id?: string;
  reply_preview?: {
    id: string;
    nickname: string;
    content: string;
  };
  read_by?: string[];
  status?: MessageStatus;
  reactions?: Record<string, string[]>;
  attachment?: MessageAttachment | null;
  poll?: ChatPoll | null;
  game_data?: {
    game_type: 'debate' | 'quiz';
    topic?: string;
    category?: string;
    winner?: string;
    summary?: string;
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
    avatar_color?: string;
    status_text?: string;
  };
  client_type: ClientType;
  online_users: Array<{ id: string; nickname: string; client_type?: ClientType; avatar_color?: string }>;
  active_game?: GameStateUpdatePayload | null;
}

export interface SysUserJoinedPayload {
  user_id: string;
  nickname: string;
  client_type: ClientType;
  avatar_color?: string;
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

export interface ClientPingPayload {
  client_time: number;
}

export interface ServerPongPayload {
  client_time: number;
  server_time: number;
}

// -------------------------------------------------------------
// Chat Payloads
// -------------------------------------------------------------

export interface ChatSendPayload {
  content: string;
  reply_to_id?: string;
  attachment_id?: string;
}

export interface ChatEditMessagePayload {
  message_id: string;
  content: string;
}

export interface ChatMessageEditedPayload {
  message_id: string;
  room_id: string;
  content: string;
  edited_at: string;
  is_edited: boolean;
}

export interface ChatPinMessagePayload {
  message_id: string;
}

export interface ChatPinUpdatedPayload {
  room_id: string;
  pinned_message: PinnedMessageInfo | null;
}

export interface ChatMarkReadPayload {
  message_ids?: string[];
}

export interface ChatReadReceiptPayload {
  room_id: string;
  user_id: string;
  nickname: string;
  message_ids: string[];
  read_at: string;
}

export interface ChatCreatePollPayload {
  question: string;
  options: string[];
  multi_select?: boolean;
}

export interface ChatVotePollPayload {
  message_id: string;
  option_id: string;
}

export interface ChatPollUpdatedPayload {
  room_id: string;
  message_id: string;
  poll: ChatPoll;
}

export interface ChatTypingPayload {
  user_id: string;
  nickname: string;
  is_typing: boolean;
}

export interface ChatReactionPayload {
  message_id: string;
  emoji: string;
  user_id?: string;
  reactions?: Record<string, string[]>;
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
  difficulty?: TriviaDifficulty;
  debater_a_id?: string;
  debater_a_name?: string;
  debater_b_id?: string;
  debater_b_name?: string;
  round_count?: number;
  opening_seconds?: number;
  rebuttal_seconds?: number;
  voting_seconds?: number;
  question_seconds?: number;
  include_custom?: boolean;
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
  opening_argument?: string;
  rebuttal_argument?: string;
  votes?: number;
  ready?: boolean;
}

export interface CourtQuestion {
  id: string;
  user_id: string;
  nickname: string;
  question: string;
  target_side?: 'side_a' | 'side_b' | 'both';
  created_at: string;
}

export interface DebateState {
  topic: string;
  category?: string;
  side_a_label?: string;
  side_b_label?: string;
  debater_a: DebaterInfo;
  debater_b: DebaterInfo;
  juror_ids?: string[];
  ready_players?: string[];
  court_questions?: CourtQuestion[];
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
  difficulty?: string;
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

export interface FastestResponderInfo {
  user_id: string;
  nickname: string;
  response_time_ms: number;
}

export interface QuizState {
  current_question_index: number;
  total_questions: number;
  category?: string;
  difficulty?: string;
  current_question?: TriviaQuestion;
  answers_distribution?: Record<QuizOptionKey, number>;
  correct_option?: QuizOptionKey | '';
  fastest_responder?: FastestResponderInfo | null;
  answered_count?: number;
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
// Debate & Quiz Action Payloads
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

export interface DebateAskQuestionPayload {
  question: string;
  target_side?: 'side_a' | 'side_b' | 'both';
}

export interface TvReactionStreamPayload {
  emoji?: string;
  from?: string;
  reactions?: Array<{
    emoji: string;
    count: number;
  }>;
}

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
// Persistent Leaderboards, Career Stats & Custom Content Banks
// -------------------------------------------------------------

export interface PlayerCareerStats {
  user_id: string;
  nickname: string;
  total_points: number;
  matches_played: number;
  debates_played: number;
  debates_won: number;
  debate_votes_received: number;
  quizzes_played: number;
  quiz_wins: number;
  correct_answers: number;
  total_answers: number;
  accuracy_percent: number;
  best_streak: number;
  fastest_answer_ms: number;
  updated_at: string;
}

export interface RoomLeaderboardEntry {
  rank: number;
  user_id: string;
  nickname: string;
  total_points: number;
  debates_won: number;
  quiz_wins: number;
  matches_played: number;
  best_streak: number;
  accuracy_percent: number;
}

export interface MatchHistoryRecord {
  id: string;
  room_id: string;
  game_type: GameType;
  title: string;
  category: string;
  winner_id: string;
  winner_nickname: string;
  runner_up_nickname?: string;
  summary: string;
  participants_count: number;
  top_scores?: Array<{
    nickname: string;
    score: number;
  }>;
  played_at: string;
}

export interface CustomDebateTopic {
  id: string;
  room_id: string;
  topic: string;
  category: string;
  side_a_label: string;
  side_b_label: string;
  created_by: string;
  created_at: string;
}

export interface CustomTriviaQuestion {
  id: string;
  room_id: string;
  prompt: string;
  category: string;
  difficulty: 'Fácil' | 'Média' | 'Difícil';
  options: Record<QuizOptionKey, string>;
  correct_option: QuizOptionKey;
  created_by: string;
  created_at: string;
}

// -------------------------------------------------------------
// System Metrics, Search & Audio Preferences
// -------------------------------------------------------------

export interface SystemStats {
  active_rooms: number;
  total_connections: number;
  unique_online: number;
  uptime_seconds: number;
  total_registered_users: number;
  total_rooms: number;
  status: string;
}

export interface MessageSearchParams {
  query: string;
  sender_id?: string;
  type?: string;
  before?: string;
  limit?: number;
}

export interface SearchResult {
  matches: ChatMessage[];
  total_found: number;
}

export interface AudioSettings {
  volume: number; // 0.0 to 1.0
  muted: boolean;
  sfx_enabled: boolean;
}

export interface SysRoomDeletedPayload {
  room_id: string;
}

export interface SysRoomUpdatedPayload {
  room: Room;
}

// -------------------------------------------------------------
// Security & Cryptographic Integrity Exports
// -------------------------------------------------------------
export * from './security';
