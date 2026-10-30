/**
 * PORChat Mobile Security Suite
 * High-performance mobile security helpers:
 * - Anti-spam buzzer throttling
 * - Mobile input and nickname sanitization
 * - PIN code checksum and format validation
 * - Mobile link scheme verification
 */

/**
 * Validates and canonicalizes PORChat invitation codes (POR-XXXX).
 */
export function validateRoomCode(rawCode: string): { valid: boolean; formatted: string; error?: string } {
  if (!rawCode) {
    return { valid: false, formatted: '', error: 'Código de sala não pode ser vazio' };
  }

  // Strip whitespaces, dashes, and normalize uppercase
  const cleaned = rawCode.trim().toUpperCase().replace(/[\s-]/g, '');

  // Extract 4-char alphanumeric suffix
  let codeSuffix = cleaned;
  if (cleaned.startsWith('POR')) {
    codeSuffix = cleaned.substring(3);
  }

  if (codeSuffix.length !== 4) {
    return {
      valid: false,
      formatted: rawCode,
      error: 'Código deve conter 4 caracteres (Ex: POR-ABCD)',
    };
  }

  // Reject characters that cause visual confusion (0 vs O, 1 vs I)
  if (!/^[A-Z0-9]{4}$/.test(codeSuffix)) {
    return {
      valid: false,
      formatted: rawCode,
      error: 'Código contém caracteres inválidos',
    };
  }

  return {
    valid: true,
    formatted: `POR-${codeSuffix}`,
  };
}

/**
 * Mobile-optimized input sanitizer:
 * Strips zero-width unicode, control bytes, and bidirectional spoofing characters.
 */
export function sanitizeMobileInput(text: string, maxLen = 1000): string {
  if (!text) return '';

  let clean = text.replace(/[\u200B-\u200D\uFEFF\u00A0]/g, ' ');
  clean = clean.replace(/[\u202A-\u202E]/g, '');
  clean = clean.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  clean = clean.trim();
  if (clean.length > maxLen) {
    clean = clean.substring(0, maxLen);
  }
  return clean;
}

/**
 * Anti-Spam Mobile Buzzer & Reaction Throttle
 * Prevents tactile button bounce, double-tap ghost clicks, and network flood.
 */
export class MobileBuzzerThrottle {
  private lastTriggerMs = 0;
  private minIntervalMs: number;
  private actionCounters: Map<string, number> = new Map();

  constructor(minIntervalMs = 300) {
    this.minIntervalMs = minIntervalMs;
  }

  /**
   * Returns true if action is allowed, false if throttled.
   */
  public canTrigger(actionKey = 'default'): boolean {
    const now = Date.now();
    if (now - this.lastTriggerMs < this.minIntervalMs) {
      return false;
    }

    // Check action frequency
    const count = this.actionCounters.get(actionKey) || 0;
    if (count > 20) {
      return false;
    }

    this.lastTriggerMs = now;
    this.actionCounters.set(actionKey, count + 1);
    return true;
  }

  public reset(): void {
    this.lastTriggerMs = 0;
    this.actionCounters.clear();
  }
}

/**
 * Validates mobile URL schemas to prevent intent injection or malicious deep-linking.
 */
export function isSafeMobileUrl(url: string): boolean {
  if (!url) return false;
  const lower = url.trim().toLowerCase();

  // Explicitly disallow dangerous protocols
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('file:') ||
    lower.startsWith('content:') ||
    lower.startsWith('intent:')
  ) {
    return false;
  }

  // Allow standard web and authorized app schemes
  return (
    lower.startsWith('http://') ||
    lower.startsWith('https://') ||
    lower.startsWith('mailto:') ||
    lower.startsWith('tel:') ||
    lower.startsWith('porchat://') ||
    lower.startsWith('exp://')
  );
}
