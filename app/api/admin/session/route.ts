import { NextResponse, type NextRequest } from 'next/server';
import { getSessionFromRequest } from '../../../../lib/auth';

export async function GET(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json(
      { ok: false, error: { message: 'Unauthorized' } },
      { status: 401 },
    );
  }

  return NextResponse.json({
    ok: true,
    data: {
      sub: session.sub,
      exp: session.exp,
      csrf: session.csrf,
      amr: session.amr,
    },
  });
}
