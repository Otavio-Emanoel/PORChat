/**
 * Unit Tests for Mobile Security Suite
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateRoomCode,
  sanitizeMobileInput,
  MobileBuzzerThrottle,
  isSafeMobileUrl,
} from './security';

export function runMobileSecurityTests(): { passed: number; failed: number } {
  let passed = 0;
  let failed = 0;

  function check(condition: boolean, testName: string) {
    if (condition) {
      passed++;
    } else {
      failed++;
      console.error(`[TEST FAILED] ${testName}`);
    }
  }

  const v1 = validateRoomCode('POR-1234');
  check(v1.valid && v1.formatted === 'POR-1234', 'Valid code POR-1234');

  const v2 = validateRoomCode('por-abcd');
  check(v2.valid && v2.formatted === 'POR-ABCD', 'Lowercase code normalized to uppercase');

  const v3 = validateRoomCode('1234');
  check(v3.valid && v3.formatted === 'POR-1234', 'Suffix without prefix normalized');

  const v4 = validateRoomCode('INVALID_CODE');
  check(!v4.valid, 'Invalid long code rejected');

  const v5 = validateRoomCode('');
  check(!v5.valid, 'Empty code rejected');

  const clean1 = sanitizeMobileInput('Hello\u200BWorld');
  check(clean1 === 'Hello World', 'Zero-width space removed');

  const clean2 = sanitizeMobileInput('Test\u202EReverse');
  check(clean2 === 'TestReverse', 'BiDi override removed');

  const clean3 = sanitizeMobileInput('<script>alert("xss")</script>');
  check(clean3.length > 0, 'Script tags safely retained for server-side HTML escape');

  const throttle = new MobileBuzzerThrottle(50);
  check(throttle.canTrigger('btn_a'), 'First buzzer tap allowed');
  check(!throttle.canTrigger('btn_a'), 'Immediate second tap throttled');

  check(isSafeMobileUrl('https://porchat.app'), 'HTTPS allowed');
  check(isSafeMobileUrl('porchat://room/123'), 'App custom scheme allowed');
  check(isSafeMobileUrl('exp://127.0.0.1:8082'), 'Expo scheme allowed');
  check(!isSafeMobileUrl('javascript:alert(1)'), 'javascript: URI blocked');
  check(!isSafeMobileUrl('data:text/html,<script>'), 'data: URI blocked');
  check(!isSafeMobileUrl('file:///etc/passwd'), 'file: URI blocked');

  return { passed, failed };
}

describe('Mobile Security Suite', () => {
  it('validates and canonicalizes PORChat room codes', () => {
    const v1 = validateRoomCode('POR-1234');
    assert.equal(v1.valid, true);
    assert.equal(v1.formatted, 'POR-1234');

    const v2 = validateRoomCode('por-abcd');
    assert.equal(v2.valid, true);
    assert.equal(v2.formatted, 'POR-ABCD');

    const v3 = validateRoomCode('1234');
    assert.equal(v3.valid, true);
    assert.equal(v3.formatted, 'POR-1234');

    assert.equal(validateRoomCode('INVALID_CODE').valid, false);
    assert.equal(validateRoomCode('POR-12$4').valid, false);
    assert.equal(validateRoomCode('').valid, false);
  });

  it('sanitizes invisible unicode, bidi overrides, control bytes and enforces max length', () => {
    assert.equal(sanitizeMobileInput('Hello\u200BWorld'), 'Hello World');
    assert.equal(sanitizeMobileInput('Test\u202EReverse'), 'TestReverse');
    assert.equal(sanitizeMobileInput('abc\x00\x07def'), 'abcdef');
    assert.equal(sanitizeMobileInput(''), '');
    assert.equal(sanitizeMobileInput('a'.repeat(50), 10), 'a'.repeat(10));
  });

  it('throttles rapid buzzer taps and resets cleanly', () => {
    const throttle = new MobileBuzzerThrottle(60000);
    assert.equal(throttle.canTrigger('btn_a'), true);
    assert.equal(throttle.canTrigger('btn_a'), false);

    throttle.reset();
    assert.equal(throttle.canTrigger('btn_a'), true);

    const noDelayThrottle = new MobileBuzzerThrottle(0);
    for (let i = 0; i <= 20; i++) {
      assert.equal(noDelayThrottle.canTrigger('spam'), true);
    }
    assert.equal(noDelayThrottle.canTrigger('spam'), false);
  });

  it('allows safe URL schemes and blocks dangerous intents', () => {
    assert.equal(isSafeMobileUrl('https://porchat.app'), true);
    assert.equal(isSafeMobileUrl('http://localhost:3001'), true);
    assert.equal(isSafeMobileUrl('mailto:team@porchat.app'), true);
    assert.equal(isSafeMobileUrl('tel:+5511999999999'), true);
    assert.equal(isSafeMobileUrl('porchat://room/123'), true);
    assert.equal(isSafeMobileUrl('exp://127.0.0.1:8082'), true);

    assert.equal(isSafeMobileUrl(''), false);
    assert.equal(isSafeMobileUrl('javascript:alert(1)'), false);
    assert.equal(isSafeMobileUrl('data:text/html,<script>'), false);
    assert.equal(isSafeMobileUrl('file:///etc/passwd'), false);
    assert.equal(isSafeMobileUrl('content://media/external'), false);
    assert.equal(isSafeMobileUrl('intent://scan/#Intent'), false);
  });

  it('passes legacy runMobileSecurityTests summary check', () => {
    const summary = runMobileSecurityTests();
    assert.equal(summary.failed, 0);
    assert.ok(summary.passed > 0);
  });
});
