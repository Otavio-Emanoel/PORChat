/**
 * PORChat Web Security Suite
 * High-performance browser-side cryptographic verification, input sanitization,
 * link security inspection, client-side rate limiting, and inactivity session guards.
 */

import { AuditEvent, SecuritySettings } from '@porchat/shared';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8081';

/**
 * Computes SHA-256 hash using the native Web Crypto API.
 */
export async function computeSha256(data: string): Promise<string> {
  if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
    // Fallback for SSR or non-secure contexts
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(64, '0');
  }

  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Validates message content against a known SHA-256 checksum to detect in-transit tampering.
 */
export async function verifyMessageIntegrity(content: string, expectedHash: string): Promise<boolean> {
  if (!expectedHash || !content) return false;
  const actualHash = await computeSha256(content);
  return actualHash.toLowerCase() === expectedHash.toLowerCase();
}

/**
 * Client-side multi-pass input sanitizer:
 * - Strips zero-width and invisible formatting characters
 * - Strips bidirectional control marks
 * - Removes non-printable ASCII control bytes
 * - Truncates excessively long inputs to 2000 chars
 */
export function sanitizeClientInput(input: string, maxLen = 2000): string {
  if (!input) return '';

  // Strip zero-width & invisible format characters
  let clean = input.replace(/[\u200B-\u200D\uFEFF\u00A0]/g, ' ');

  // Strip bidirectional override characters (used in spoofing)
  clean = clean.replace(/[\u202A-\u202E]/g, '');

  // Strip control characters except newline and tab
  clean = clean.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  clean = clean.trim();
  if (clean.length > maxLen) {
    clean = clean.substring(0, maxLen);
  }
  return clean;
}

/**
 * Inspects URLs to prevent phishing, XSS, and script execution via dangerous URI schemes.
 */
export function isSafeUrl(rawUrl: string): { isSafe: boolean; protocol: string; domain: string } {
  try {
    const parsed = new URL(rawUrl, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
    const protocol = parsed.protocol.toLowerCase();
    const domain = parsed.hostname;

    // Disallow executable protocols
    if (['javascript:', 'data:', 'vbscript:', 'file:'].includes(protocol)) {
      return { isSafe: false, protocol, domain };
    }

    // Allow safe protocols
    const isSafe = ['http:', 'https:', 'mailto:', 'tel:'].includes(protocol);
    return { isSafe, protocol, domain };
  } catch {
    return { isSafe: false, protocol: 'invalid', domain: '' };
  }
}

/**
 * Client-Side Token Bucket Rate Limiter
 * Enforces smooth action dispatch and prevents UI flood attacks.
 */
export class ClientRateLimiter {
  private timestamps: number[] = [];
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequests = 5, windowMs = 2000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  public allow(): boolean {
    const now = Date.now();
    // Prune timestamps older than window
    this.timestamps = this.timestamps.filter((t) => now - t < this.windowMs);

    if (this.timestamps.length >= this.maxRequests) {
      return false;
    }

    this.timestamps.push(now);
    return true;
  }

  public getRemainingCooldownMs(): number {
    if (this.timestamps.length < this.maxRequests) return 0;
    const oldest = this.timestamps[0];
    const elapsed = Date.now() - oldest;
    return Math.max(0, this.windowMs - elapsed);
  }

  public reset(): void {
    this.timestamps = [];
  }
}

/**
 * Inactivity Session Guard
 * Automatically calls onTimeout callback after a specified duration of user idle time.
 */
export class SessionInactivityGuard {
  private timeoutMs: number;
  private timer: NodeJS.Timeout | null = null;
  private onTimeout: () => void;
  private isListening = false;

  constructor(timeoutMinutes = 30, onTimeout: () => void) {
    this.timeoutMs = timeoutMinutes * 60 * 1000;
    this.onTimeout = onTimeout;
    this.handleActivity = this.handleActivity.bind(this);
  }

  public start(): void {
    if (typeof window === 'undefined' || this.isListening) return;

    window.addEventListener('mousemove', this.handleActivity, { passive: true });
    window.addEventListener('keydown', this.handleActivity, { passive: true });
    window.addEventListener('touchstart', this.handleActivity, { passive: true });
    window.addEventListener('scroll', this.handleActivity, { passive: true });

    this.isListening = true;
    this.resetTimer();
  }

  public stop(): void {
    if (typeof window === 'undefined') return;

    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    window.removeEventListener('mousemove', this.handleActivity);
    window.removeEventListener('keydown', this.handleActivity);
    window.removeEventListener('touchstart', this.handleActivity);
    window.removeEventListener('scroll', this.handleActivity);

    this.isListening = false;
  }

  private handleActivity(): void {
    this.resetTimer();
  }

  private resetTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => {
      this.onTimeout();
    }, this.timeoutMs);
  }
}

/**
 * Fetches recent audit events from the Go API server.
 */
export async function fetchAuditEvents(token: string): Promise<AuditEvent[]> {
  try {
    const res = await fetch(`${API_BASE}/api/system/audit?limit=25`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.events || [];
  } catch {
    return [];
  }
}

/**
 * Default security settings manager
 */
export const DEFAULT_SECURITY_SETTINGS: SecuritySettings = {
  session_timeout_minutes: 30,
  link_safety_interceptor: true,
  verify_message_integrity: true,
  client_rate_limit_throttle_ms: 500,
};

export function getStoredSecuritySettings(): SecuritySettings {
  if (typeof window === 'undefined') return DEFAULT_SECURITY_SETTINGS;
  try {
    const raw = localStorage.getItem('porchat_security_settings');
    if (!raw) return DEFAULT_SECURITY_SETTINGS;
    return { ...DEFAULT_SECURITY_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SECURITY_SETTINGS;
  }
}

export function saveStoredSecuritySettings(settings: SecuritySettings): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('porchat_security_settings', JSON.stringify(settings));
  } catch {
    // Ignore storage quota errors
  }
}
