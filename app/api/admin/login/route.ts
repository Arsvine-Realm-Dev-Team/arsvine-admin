import { NextResponse, type NextRequest } from 'next/server';
import { applyAuthCookies, createSession, verifyPassword } from '../../../../lib/auth';
import { enforceRateLimit } from '../../../../lib/rate-limit';

function getClientKey(request: NextRequest) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}

export async function POST(request: NextRequest) {
  const limiter = enforceRateLimit(`login:${getClientKey(request)}`, 5, 60_000);
  if (!limiter.ok) {
    return NextResponse.json(
      { ok: false, error: { message: '登录尝试过多，请稍后再试。' } },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(limiter.retryAfterMs / 1000)) } },
    );
  }

  const body = (await request.json()) as { password?: string };
  const password = typeof body.password === 'string' ? body.password : '';

  if (!password) {
    return NextResponse.json(
      { ok: false, error: { message: '缺少密码。' } },
      { status: 422 },
    );
  }

  if (!verifyPassword(password)) {
    return NextResponse.json(
      { ok: false, error: { message: '密码错误。' } },
      { status: 401 },
    );
  }

  const response = NextResponse.json({ ok: true });
  applyAuthCookies(response, createSession());
  return response;
}
