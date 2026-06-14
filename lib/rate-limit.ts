type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

export function enforceRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterMs: windowMs };
  }

  if (current.count >= limit) {
    return {
      ok: false,
      retryAfterMs: Math.max(0, current.resetAt - now),
    };
  }

  current.count += 1;
  buckets.set(key, current);
  return {
    ok: true,
    retryAfterMs: Math.max(0, current.resetAt - now),
  };
}
