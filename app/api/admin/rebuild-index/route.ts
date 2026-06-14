import { NextResponse, type NextRequest } from 'next/server';
import { getSessionFromRequest, verifyCsrf } from '../../../../lib/auth';
import { rebuildBlogIndex } from '../../../../lib/posts';

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

  try {
    const data = await rebuildBlogIndex();
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: { message: error instanceof Error ? error.message : 'Rebuild failed.' },
      },
      { status: 500 },
    );
  }
}
