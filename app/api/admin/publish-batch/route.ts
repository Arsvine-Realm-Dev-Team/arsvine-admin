import { NextResponse, type NextRequest } from 'next/server';

import { getSessionFromRequest, verifyCsrf } from '../../../../lib/auth';
import { enforceRateLimit } from '../../../../lib/rate-limit';
import { publishPostBatch } from '../../../../lib/posts';

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

  const limiter = await enforceRateLimit(`publish-batch:${getClientKey(request)}`, 5, 60_000);
  if (!limiter.ok) {
    return NextResponse.json(
      { ok: false, error: { message: '批量发布过于频繁，请稍后再试。' } },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(limiter.retryAfterMs / 1000)) } },
    );
  }

  try {
    const body = (await request.json()) as {
      slug: string;
      date: string;
      pinned: boolean;
      accessMode: 'public' | 'totp';
      accessGroup?: string;
      variants: Array<{
        locale: 'zh-CN' | 'zh-TW' | 'en' | 'ja' | 'ru' | 'fr';
        title: string;
        excerpt: string;
        tags: string[];
        content: string;
        originLocale?: 'zh-CN' | 'zh-TW' | 'en' | 'ja' | 'ru' | 'fr';
      }>;
    };

    const data = await publishPostBatch(body);
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: { message: error instanceof Error ? error.message : 'Batch publish failed.' },
      },
      { status: 500 },
    );
  }
}
