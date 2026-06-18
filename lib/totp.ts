import { createHmac, timingSafeEqual } from 'node:crypto';

export type TotpSecretConfig = {
  current: string;
  previous?: string[];
  period?: number;
  digits?: number;
  window?: number;
};

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function isTruthyEnv(value: string | undefined) {
  return value === '1' || value?.toLowerCase() === 'true';
}

function base32Decode(value: string) {
  const normalized = value.toUpperCase().replace(/=+$/g, '').replace(/[\s-]/g, '');
  let bits = '';

  for (const char of normalized) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) {
      throw new Error('Invalid base32 secret.');
    }
    bits += index.toString(2).padStart(5, '0');
  }

  const bytes: number[] = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  }

  return Buffer.from(bytes);
}

function hotp(secret: Buffer, counter: bigint, digits: number) {
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(counter);

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

function parseAdminTotpConfig(raw: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Invalid ADMIN_TOTP_JSON');
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('ADMIN_TOTP_JSON must be a plain object.');
  }

  const config = parsed as TotpSecretConfig;
  if (!config.current || typeof config.current !== 'string') {
    throw new Error('ADMIN_TOTP_JSON.current is required.');
  }

  if (config.previous && !Array.isArray(config.previous)) {
    throw new Error('ADMIN_TOTP_JSON.previous must be an array when provided.');
  }

  return config;
}

export function verifyTotp(opts: {
  token: string;
  secretBase32: string;
  period?: number;
  digits?: number;
  window?: number;
  nowMs?: number;
}) {
  const {
    token,
    secretBase32,
    period = 30,
    digits = 6,
    window = 1,
    nowMs = Date.now(),
  } = opts;

  if (!/^\d+$/.test(token) || token.length !== digits) return false;

  const secret = base32Decode(secretBase32);
  const step = BigInt(Math.floor(nowMs / 1000 / period));
  const expected = Buffer.from(token);

  for (let offset = -window; offset <= window; offset += 1) {
    const generated = Buffer.from(hotp(secret, step + BigInt(offset), digits));
    if (generated.length === expected.length && timingSafeEqual(generated, expected)) {
      return true;
    }
  }

  return false;
}

export function isAdminTotpRequired() {
  // TOTP is mandatory by default. The only way to disable it is to (a) run
  // outside production AND (b) explicitly opt in to the dev bypass via
  // `ADMIN_TOTP_DEV_BYPASS=1`. The legacy `ADMIN_TOTP_ENFORCE_IN_DEV=1`
  // (force TOTP in dev) is still honored for backward compatibility, but it
  // is now a no-op because the default is already "required".
  if (process.env.NODE_ENV === 'production') return true;
  if (isTruthyEnv(process.env.ADMIN_TOTP_DEV_BYPASS?.trim())) return false;
  return true;
}

export function getAdminTotpConfig() {
  const raw = process.env.ADMIN_TOTP_JSON?.trim();
  if (!raw) {
    throw new Error('Missing ADMIN_TOTP_JSON');
  }

  return parseAdminTotpConfig(raw);
}

export function verifyAdminTotpToken(token: string) {
  const config = getAdminTotpConfig();

  if (
    verifyTotp({
      token,
      secretBase32: config.current,
      period: config.period,
      digits: config.digits,
      window: config.window,
    })
  ) {
    return true;
  }

  for (const previous of config.previous ?? []) {
    if (
      verifyTotp({
        token,
        secretBase32: previous,
        period: config.period,
        digits: config.digits,
        window: config.window,
      })
    ) {
      return true;
    }
  }

  return false;
}
