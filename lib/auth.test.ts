import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { scryptSync } from 'node:crypto';
import { NextRequest } from 'next/server';
import { adminTotpRequired, createSession, getSessionFromRequest, verifyPassword } from './auth';

const ORIGINAL_ENV = {
  SESSION_SECRET: process.env.SESSION_SECRET,
  ADMIN_PASSWORD_HASH: process.env.ADMIN_PASSWORD_HASH,
  NODE_ENV: process.env.NODE_ENV,
  ADMIN_TOTP_ENFORCE_IN_DEV: process.env.ADMIN_TOTP_ENFORCE_IN_DEV,
};

beforeEach(() => {
  process.env.SESSION_SECRET = 'test-session-secret';
  process.env.ADMIN_PASSWORD_HASH = makePasswordHash('correct horse battery staple');
  process.env.NODE_ENV = 'test';
  delete process.env.ADMIN_TOTP_ENFORCE_IN_DEV;
});

afterEach(() => {
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

describe('verifyPassword', () => {
  it('accepts the configured password hash', () => {
    expect(verifyPassword('correct horse battery staple')).toBe(true);
  });

  it('rejects a wrong password', () => {
    expect(verifyPassword('wrong password')).toBe(false);
  });
});

describe('sessions', () => {
  it('creates a signed session carrying the auth method', () => {
    const session = createSession('password+totp');
    const request = new NextRequest('http://localhost/blog', {
      headers: { cookie: `arsvine_admin_session=${session.value}` },
    });
    expect(getSessionFromRequest(request)).toMatchObject({
      sub: 'admin',
      csrf: session.csrf,
      exp: session.exp,
      amr: 'password+totp',
    });
  });

  it('invalidates tampered sessions', () => {
    const session = createSession('password+totp');
    const raw = JSON.parse(Buffer.from(session.value, 'base64url').toString('utf8')) as {
      sub: string;
      exp: number;
      csrf: string;
      amr: string;
      sig: string;
    };
    raw.amr = 'password';
    const tampered = Buffer.from(JSON.stringify(raw), 'utf8').toString('base64url');
    const request = new NextRequest('http://localhost/blog', {
      headers: { cookie: `arsvine_admin_session=${tampered}` },
    });
    expect(getSessionFromRequest(request)).toBeNull();
  });
});

describe('adminTotpRequired', () => {
  it('tracks the development bypass flag through auth exports', () => {
    process.env.NODE_ENV = 'development';
    expect(adminTotpRequired()).toBe(false);
    process.env.ADMIN_TOTP_ENFORCE_IN_DEV = '1';
    expect(adminTotpRequired()).toBe(true);
  });
});
