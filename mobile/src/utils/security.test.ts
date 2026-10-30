/**
 * Unit Tests for Mobile Security Suite
 */

import {
  validateRoomCode,
  sanitizeMobileInput,
  MobileBuzzerThrottle,
  isSafeMobileUrl,
} from './security';

export function runMobileSecurityTests(): { passed: number; failed: number } {
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      passed++;
    } else {
      failed++;
      console.error(`[TEST FAILED] ${testName}`);
    }
  }

  // 1. PIN Code Validation Tests
  const v1 = validateRoomCode('POR-1234');
  assert(v1.valid && v1.formatted === 'POR-1234', 'Valid code POR-1234');

  const v2 = validateRoomCode('por-abcd');
  assert(v2.valid && v2.formatted === 'POR-ABCD', 'Lowercase code normalized to uppercase');

  const v3 = validateRoomCode('1234');
  assert(v3.valid && v3.formatted === 'POR-1234', 'Suffix without prefix normalized');

  const v4 = validateRoomCode('INVALID_CODE');
  assert(!v4.valid, 'Invalid long code rejected');

  const v5 = validateRoomCode('');
  assert(!v5.valid, 'Empty code rejected');

  // 2. Mobile Input Sanitizer Tests
  const clean1 = sanitizeMobileInput('Hello\u200BWorld');
  assert(clean1 === 'Hello World', 'Zero-width space removed');

  const clean2 = sanitizeMobileInput('Test\u202EReverse');
  assert(clean2 === 'TestReverse', 'BiDi override removed');

  const clean3 = sanitizeMobileInput('<script>alert("xss")</script>');
  assert(clean3.length > 0, 'Script tags safely retained for server-side HTML escape');

  // 3. Buzzer Throttle Tests
  const throttle = new MobileBuzzerThrottle(50);
  assert(throttle.canTrigger('btn_a'), 'First buzzer tap allowed');
  assert(!throttle.canTrigger('btn_a'), 'Immediate second tap throttled');

  // 4. Mobile URL Safety Tests
  assert(isSafeMobileUrl('https://porchat.app'), 'HTTPS allowed');
  assert(isSafeMobileUrl('porchat://room/123'), 'App custom scheme allowed');
  assert(isSafeMobileUrl('exp://127.0.0.1:8082'), 'Expo scheme allowed');
  assert(!isSafeMobileUrl('javascript:alert(1)'), 'javascript: URI blocked');
  assert(!isSafeMobileUrl('data:text/html,<script>'), 'data: URI blocked');
  assert(!isSafeMobileUrl('file:///etc/passwd'), 'file: URI blocked');

  return { passed, failed };
}
