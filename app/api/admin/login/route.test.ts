import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { scryptSync, createHmac } from 'node:crypto';
import { NextRequest } from 'next/server';
import { POST } from './route';

const FIXED_SECRET = 'JBSWY3DPEHPK3PXP';
const ORIGINAL_NOW = Date.now;
let mockedNow = 0;

beforeEach(() => {
  mockedNow = 1735732800 * 1000;
  Date.now = () => mockedNow;
  // `vi.stubEnv` writes through Next.js' readonly NODE_ENV typing; pair with
  // `vi.unstubAllEnvs()` in afterEach for automatic restoration.
  vi.stubEnv('SESSION_SECRET', 'test-session-secret');
  vi.stubEnv('ADMIN_PASSWORD_HASH', makePasswordHash('correct horse battery staple'));
  vi.stubEnv('ADMIN_TOTP_JSON', JSON.stringify({
    current: FIXED_SECRET,
    period: 30,
    digits: 6,
    window: 1,
  }));
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('ADMIN_TOTP_ENFORCE_IN_DEV', '');
  vi.stubEnv('ADMIN_TOTP_DEV_BYPASS', '');
  // Treat the forwarded IP as authentic so each test gets its own per-IP
  // bucket — otherwise the global bucket collapses every request into one
  // bucket and trips after a handful of attempts.
  vi.stubEnv('TRUST_PROXY', '1');
});

afterEach(() => {
  Date.now = ORIGINAL_NOW;
  vi.unstubAllEnvs();
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
  it('rejects missing password with the generic 401 error', async () => {
    const response = await POST(createRequest({}));
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json).toMatchObject({ ok: false, error: { message: '登录失败，请检查凭据。' } });
  });

  it('rejects wrong password with the generic 401 error', async () => {
    const response = await POST(createRequest({ password: 'nope' }));
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json).toMatchObject({ ok: false, error: { message: '登录失败，请检查凭据。' } });
  });

  it('rejects missing TOTP token in production with the generic 401 error', async () => {
    const response = await POST(createRequest({ password: 'correct horse battery staple' }));
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json).toMatchObject({ ok: false, error: { message: '登录失败，请检查凭据。' } });
  });

  it('rejects wrong TOTP token in production with the generic 401 error', async () => {
    const response = await POST(createRequest({ password: 'correct horse battery staple', totpToken: '000000' }));
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json).toMatchObject({ ok: false, error: { message: '登录失败，请检查凭据。' } });
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
      exp: number;
    };
    expect(payload.amr).toBe('password+totp');
    // 12-hour TTL — give a generous tolerance window for clock arithmetic.
    const ttlMs = payload.exp - mockedNow;
    expect(ttlMs).toBeGreaterThan(11 * 60 * 60 * 1000);
    expect(ttlMs).toBeLessThanOrEqual(12 * 60 * 60 * 1000);
  });

  it('still requires TOTP in development by default', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const response = await POST(createRequest({ password: 'correct horse battery staple' }));
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json).toMatchObject({ ok: false, error: { message: '登录失败，请检查凭据。' } });
  });

  it('only allows password-only login in development when ADMIN_TOTP_DEV_BYPASS is explicitly set', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('ADMIN_TOTP_DEV_BYPASS', '1');
    const response = await POST(createRequest({ password: 'correct horse battery staple' }));
    const sessionCookie = response.cookies.get('arsvine_admin_session');

    expect(response.status).toBe(200);
    const payload = JSON.parse(Buffer.from(sessionCookie!.value, 'base64url').toString('utf8')) as {
      amr: string;
    };
    expect(payload.amr).toBe('password+totp-dev-bypass');
  });

  it('returns a generic error and never leaks configuration details when TOTP config is missing', async () => {
    vi.stubEnv('ADMIN_TOTP_JSON', '');
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
