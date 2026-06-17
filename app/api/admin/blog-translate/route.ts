import { NextResponse, type NextRequest } from 'next/server';

import { getSessionFromRequest, verifyCsrf } from '../../../../lib/auth';
import { buildBlogTranslations } from '../../../../lib/blog-translation';
import { enforceRateLimit } from '../../../../lib/rate-limit';

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

  const limiter = await enforceRateLimit(`blog-translate:${getClientKey(request)}`, 6, 60_000);
  if (!limiter.ok) {
    return NextResponse.json(
      { ok: false, error: { message: '博客自动翻译过于频繁，请稍后再试。' } },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(limiter.retryAfterMs / 1000)) } },
    );
  }

  try {
    const body = (await request.json()) as {
      title: string;
      excerpt: string;
      tags: string[];
      content: string;
      sourceLocale: 'zh-CN';
      targetLocales?: Array<'zh-TW' | 'en'>;
    };

    const data = await buildBlogTranslations(body);
    return NextResponse.json({ ok: true, data: { variants: data } });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: { message: error instanceof Error ? error.message : 'Blog translation failed.' },
      },
      { status: 500 },
    );
  }
}
