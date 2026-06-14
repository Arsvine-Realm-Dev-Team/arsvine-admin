import { NextResponse, type NextRequest } from 'next/server';
import { getSessionFromRequest } from '../../../../lib/auth';
import { getBlogIndex } from '../../../../lib/posts';

export async function GET(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json(
      { ok: false, error: { message: 'Unauthorized' } },
      { status: 401 },
    );
  }

  try {
    const data = await getBlogIndex();
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: { message: error instanceof Error ? error.message : 'Failed to load blog index.' },
      },
      { status: 500 },
    );
  }
}
