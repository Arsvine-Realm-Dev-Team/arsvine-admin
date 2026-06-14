import { NextResponse, type NextRequest } from 'next/server';
import { getSessionFromRequest } from '../../../../lib/auth';
import { getBlogVariant } from '../../../../lib/posts';

export async function GET(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json(
      { ok: false, error: { message: 'Unauthorized' } },
      { status: 401 },
    );
  }

  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('slug') || '';
  const locale = searchParams.get('locale') || '';

  if (!slug || !locale) {
    return NextResponse.json(
      { ok: false, error: { message: 'Missing slug or locale.' } },
      { status: 400 },
    );
  }

  try {
    const data = await getBlogVariant(slug, locale);
    if (!data) {
      return NextResponse.json(
        { ok: false, error: { message: 'Variant not found.' } },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: { message: error instanceof Error ? error.message : 'Failed to load blog variant.' },
      },
      { status: 500 },
    );
  }
}
