import type { NextRequest } from 'next/server';
import { getSessionFromRequest, type AuthenticatedSession } from './auth';
import { getWorkspaceConfig } from './accounts';
import { withWorkspace } from './workspace-context';

export async function requireSession(request: NextRequest) {
  return getSessionFromRequest(request);
}

export async function withSessionWorkspace<T>(session: AuthenticatedSession, callback: () => Promise<T>) {
  const config = await getWorkspaceConfig(session.userId);
  return withWorkspace(config, callback);
}
