import { NextResponse, type NextRequest } from 'next/server';
import { getSessionFromRequest, verifyCsrf } from '../../../../lib/auth';
import { enforceRateLimit } from '../../../../lib/rate-limit';
import { publishPost } from '../../../../lib/posts';

function getClientKey(request: NextRequest) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}

export async function POST(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json(
      { ok: false, error: { message: 'Unauthorized' } },
      { status: 401 },
    );
  }

  if (!verifyCsrf(request, session)) {
    return NextResponse.json(
      { ok: false, error: { message: 'Invalid CSRF token.' } },
      { status: 403 },
    );
  }

  const limiter = await enforceRateLimit(`publish:${getClientKey(request)}`, 10, 60_000);
  if (!limiter.ok) {
    return NextResponse.json(
      { ok: false, error: { message: '发布过于频繁，请稍后再试。' } },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(limiter.retryAfterMs / 1000)) } },
    );
  }

  try {
    const body = (await request.json()) as {
      slug: string;
      locale: 'zh-CN' | 'zh-TW' | 'en' | 'ja' | 'ru' | 'fr';
      title: string;
      excerpt: string;
      date: string;
      tags: string[];
      pinned: boolean;
      content: string;
      accessMode: 'public' | 'totp';
      accessGroup?: string;
      originLocale?: 'zh-CN' | 'zh-TW' | 'en' | 'ja' | 'ru' | 'fr';
    };

    const data = await publishPost(body);
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: { message: error instanceof Error ? error.message : 'Publish failed.' },
      },
      { status: 500 },
    );
  }
}
