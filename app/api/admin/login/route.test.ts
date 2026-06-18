import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { scryptSync, createHmac } from 'node:crypto';
import { NextRequest } from 'next/server';
import { POST } from './route';

const FIXED_SECRET = 'JBSWY3DPEHPK3PXP';
const ORIGINAL_ENV = {
  SESSION_SECRET: process.env.SESSION_SECRET,
  ADMIN_PASSWORD_HASH: process.env.ADMIN_PASSWORD_HASH,
  ADMIN_TOTP_JSON: process.env.ADMIN_TOTP_JSON,
  NODE_ENV: process.env.NODE_ENV,
  ADMIN_TOTP_ENFORCE_IN_DEV: process.env.ADMIN_TOTP_ENFORCE_IN_DEV,
  ADMIN_TOTP_DEV_BYPASS: process.env.ADMIN_TOTP_DEV_BYPASS,
  TRUST_PROXY: process.env.TRUST_PROXY,
};
const ORIGINAL_NOW = Date.now;
let mockedNow = 0;

beforeEach(() => {
  mockedNow = 1735732800 * 1000;
  Date.now = () => mockedNow;
  process.env.SESSION_SECRET = 'test-session-secret';
  process.env.ADMIN_PASSWORD_HASH = makePasswordHash('correct horse battery staple');
  process.env.ADMIN_TOTP_JSON = JSON.stringify({
    current: FIXED_SECRET,
    period: 30,
    digits: 6,
    window: 1,
  });
  process.env.NODE_ENV = 'production';
  delete process.env.ADMIN_TOTP_ENFORCE_IN_DEV;
  delete process.env.ADMIN_TOTP_DEV_BYPASS;
  // Treat the forwarded IP as authentic so each test gets its own per-IP
  // bucket — otherwise the global bucket collapses every request into one
  // bucket and trips after a handful of attempts.
  process.env.TRUST_PROXY = '1';
});

afterEach(() => {
  Date.now = ORIGINAL_NOW;
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

function makePasswordHash(password: string) {
  const salt = 'test-salt';
  const hash = scryptSync(password, salt, 64).toString('base64url');
  return `scrypt$${salt}$${hash}`;
}

function createRequest(body: Record<string, unknown>, forwardedFor = `1.2.3.${Math.floor(Math.random() * 200) + 1}`) {
  return new NextRequest('http://localhost/api/admin/login', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': forwardedFor,
    },
    body: JSON.stringify(body),
  });
}

describe('POST /api/admin/login', () => {
  it('requires a TOTP token in production', async () => {
    const response = await POST(createRequest({ password: 'correct horse battery staple' }));
    const json = await response.json();

    expect(response.status).toBe(422);
    expect(json).toMatchObject({ ok: false, error: { message: '缺少 TOTP 验证码。' } });
  });

  it('creates a session when password and TOTP are valid', async () => {
    const code = computeCodeForStep(FIXED_SECRET, BigInt(Math.floor(mockedNow / 1000 / 30)), 6);
    const response = await POST(createRequest({ password: 'correct horse battery staple', totpToken: code }));
    const sessionCookie = response.cookies.get('arsvine_admin_session');
    const csrfCookie = response.cookies.get('arsvine_admin_csrf');

    expect(response.status).toBe(200);
    expect(sessionCookie?.value).toBeTruthy();
    expect(csrfCookie?.value).toBeTruthy();

    const payload = JSON.parse(Buffer.from(sessionCookie!.value, 'base64url').toString('utf8')) as {
      amr: string;
    };
    expect(payload.amr).toBe('password+totp');
  });

  it('still requires TOTP in development by default', async () => {
    process.env.NODE_ENV = 'development';
    const response = await POST(createRequest({ password: 'correct horse battery staple' }));
    const json = await response.json();

    expect(response.status).toBe(422);
    expect(json).toMatchObject({ ok: false, error: { message: '缺少 TOTP 验证码。' } });
  });

  it('only allows password-only login in development when ADMIN_TOTP_DEV_BYPASS is explicitly set', async () => {
    process.env.NODE_ENV = 'development';
    process.env.ADMIN_TOTP_DEV_BYPASS = '1';
    const response = await POST(createRequest({ password: 'correct horse battery staple' }));
    const sessionCookie = response.cookies.get('arsvine_admin_session');

    expect(response.status).toBe(200);
    const payload = JSON.parse(Buffer.from(sessionCookie!.value, 'base64url').toString('utf8')) as {
      amr: string;
    };
    expect(payload.amr).toBe('password+totp-dev-bypass');
  });

  it('returns a generic error and never leaks configuration details when TOTP config is missing', async () => {
    delete process.env.ADMIN_TOTP_JSON;
    const code = computeCodeForStep(FIXED_SECRET, BigInt(Math.floor(mockedNow / 1000 / 30)), 6);
    const response = await POST(createRequest({ password: 'correct horse battery staple', totpToken: code }));
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json).toMatchObject({
      ok: false,
      error: { message: '登录失败，请稍后重试。' },
    });
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
