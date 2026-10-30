/**
 * @porchat/shared - Security & Integrity Contracts
 * Standard types for client-server cryptographic audit, origin verification, and message integrity.
 */

import { ChatMessage } from './index';

export type AuditEventType =
  | 'auth:login_success'
  | 'auth:login_failed'
  | 'auth:lockout'
  | 'auth:token_revoked'
  | 'auth:logout'
  | 'ws:connected'
  | 'ws:rejected'
  | 'ws:rate_limited'
  | 'chat:message_sent'
  | 'chat:message_deleted'
  | 'game:state_transition'
  | 'security:xss_blocked'
  | 'security:integrity_failure';

export interface AuditEvent {
  id: string;
  type: AuditEventType;
  user_id?: string;
  ip?: string;
  details?: Record<string, unknown>;
  timestamp: number;
}

export interface SecurityAuditSummary {
  total_events: number;
  lockouts_active: number;
  blacklisted_tokens_count: number;
  recent_events: AuditEvent[];
}

export interface SecurityStatus {
  is_secure_context: boolean;
  is_origin_trusted: boolean;
  rate_limit_remaining: number;
  last_heartbeat_ms: number;
  active_session_valid: boolean;
}

export interface SignedPayload<T = unknown> {
  data: T;
  signature: string;
  timestamp: number;
  sender_id: string;
}

export interface MessageSignatureInfo {
  message_id: string;
  room_id: string;
  user_id: string;
  hash: string;
  timestamp: number;
  is_valid: boolean;
}

export interface ChatExportOptions {
  format: 'json' | 'txt';
  include_system_events?: boolean;
  include_signatures?: boolean;
  passphrase?: string;
}

export interface ChatExportArchive {
  version: string;
  room_id: string;
  room_name: string;
  exported_at: string;
  exported_by: string;
  messages_count: number;
  sha256_checksum: string;
  messages: ChatMessage[];
}

export interface SecuritySettings {
  session_timeout_minutes: number;
  link_safety_interceptor: boolean;
  verify_message_integrity: boolean;
  client_rate_limit_throttle_ms: number;
}

export interface RoomPinValidationResult {
  valid: boolean;
  pin: string;
  error?: string;
}
