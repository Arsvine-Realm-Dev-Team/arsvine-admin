import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHmac } from 'node:crypto';
import { getAdminTotpConfig, isAdminTotpRequired, verifyAdminTotpToken, verifyTotp } from './totp';

const FIXED_SECRET = 'JBSWY3DPEHPK3PXP';
const ORIGINAL_ENV = {
  NODE_ENV: process.env.NODE_ENV,
  ADMIN_TOTP_JSON: process.env.ADMIN_TOTP_JSON,
  ADMIN_TOTP_ENFORCE_IN_DEV: process.env.ADMIN_TOTP_ENFORCE_IN_DEV,
};
const ORIGINAL_NOW = Date.now;
let mockedNow = 0;

beforeEach(() => {
  mockedNow = 1735732800 * 1000;
  Date.now = () => mockedNow;
  delete process.env.ADMIN_TOTP_JSON;
  delete process.env.ADMIN_TOTP_ENFORCE_IN_DEV;
  process.env.NODE_ENV = 'test';
});

afterEach(() => {
  Date.now = ORIGINAL_NOW;
  if (ORIGINAL_ENV.NODE_ENV === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = ORIGINAL_ENV.NODE_ENV;
  if (ORIGINAL_ENV.ADMIN_TOTP_JSON === undefined) delete process.env.ADMIN_TOTP_JSON;
  else process.env.ADMIN_TOTP_JSON = ORIGINAL_ENV.ADMIN_TOTP_JSON;
  if (ORIGINAL_ENV.ADMIN_TOTP_ENFORCE_IN_DEV === undefined) delete process.env.ADMIN_TOTP_ENFORCE_IN_DEV;
  else process.env.ADMIN_TOTP_ENFORCE_IN_DEV = ORIGINAL_ENV.ADMIN_TOTP_ENFORCE_IN_DEV;
});

function setAdminTotp(config: Record<string, unknown>) {
  process.env.ADMIN_TOTP_JSON = JSON.stringify(config);
}

describe('verifyTotp', () => {
  it('accepts the current-step code', () => {
    const period = 30;
    const code = computeCodeForStep(FIXED_SECRET, BigInt(Math.floor(mockedNow / 1000 / period)), 6);
    expect(verifyTotp({ token: code, secretBase32: FIXED_SECRET, period, digits: 6, window: 0, nowMs: mockedNow })).toBe(true);
  });

  it('rejects a token outside the allowed window', () => {
    const period = 30;
    const code = computeCodeForStep(FIXED_SECRET, BigInt(Math.floor(mockedNow / 1000 / period)) + BigInt(4), 6);
    expect(verifyTotp({ token: code, secretBase32: FIXED_SECRET, period, digits: 6, window: 1, nowMs: mockedNow })).toBe(false);
  });

  it('rejects malformed tokens', () => {
    expect(verifyTotp({ token: '12345', secretBase32: FIXED_SECRET, nowMs: mockedNow })).toBe(false);
    expect(verifyTotp({ token: 'abcdef', secretBase32: FIXED_SECRET, nowMs: mockedNow })).toBe(false);
  });
});

describe('admin TOTP config', () => {
  it('parses a valid ADMIN_TOTP_JSON payload', () => {
    setAdminTotp({ current: FIXED_SECRET, period: 30, digits: 6, window: 1 });
    expect(getAdminTotpConfig()).toEqual({
      current: FIXED_SECRET,
      period: 30,
      digits: 6,
      window: 1,
    });
  });

  it('accepts previous secrets during rotation', () => {
    const previousSecret = 'KRSXG5BAONSWG4TFOQ';
    const code = computeCodeForStep(previousSecret, BigInt(Math.floor(mockedNow / 1000 / 30)), 6);
    setAdminTotp({ current: FIXED_SECRET, previous: [previousSecret], period: 30, digits: 6, window: 1 });
    expect(verifyAdminTotpToken(code)).toBe(true);
  });

  it('throws on invalid JSON', () => {
    process.env.ADMIN_TOTP_JSON = '{not-json';
    expect(() => getAdminTotpConfig()).toThrow(/Invalid ADMIN_TOTP_JSON/);
  });
});

describe('isAdminTotpRequired', () => {
  it('defaults to disabled in non-production', () => {
    process.env.NODE_ENV = 'development';
    expect(isAdminTotpRequired()).toBe(false);
  });

  it('can be forced on in development', () => {
    process.env.NODE_ENV = 'development';
    process.env.ADMIN_TOTP_ENFORCE_IN_DEV = 'true';
    expect(isAdminTotpRequired()).toBe(true);
  });

  it('is always required in production', () => {
    process.env.NODE_ENV = 'production';
    expect(isAdminTotpRequired()).toBe(true);
  });
});

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Decode(value: string) {
  const normalized = value.toUpperCase().replace(/=+$/g, '').replace(/[\s-]/g, '');
  let bits = '';
  for (const char of normalized) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) throw new Error('Invalid base32');
    bits += index.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(Number.parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

function computeCodeForStep(secretBase32: string, counter: bigint, digits: number) {
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(counter);
  const secret = base32Decode(secretBase32);
  const hmac = createHmac('sha1', secret).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    (((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff)) %
    10 ** digits;
  return code.toString().padStart(digits, '0');
}
