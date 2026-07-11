import { NextResponse, type NextRequest } from 'next/server';
import { getWorkspaceConfig, getWorkspaceSummary, saveWorkspaceConfig } from '../../../../lib/accounts';
import { getSessionFromRequest, verifyCsrf } from '../../../../lib/auth';
import type { WorkspaceConfig } from '../../../../lib/workspace-context';

function unauthorized() { return NextResponse.json({ ok: false, error: { message: 'Unauthorized' } }, { status: 401 }); }

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return unauthorized();
  try { return NextResponse.json({ ok: true, data: await getWorkspaceSummary(session.userId) }); }
  catch (error) { return NextResponse.json({ ok: false, error: { message: error instanceof Error ? error.message : '无法读取工作区配置。' } }, { status: 404 }); }
}

export async function PUT(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return unauthorized();
  if (!verifyCsrf(request, session)) return NextResponse.json({ ok: false, error: { message: 'Invalid CSRF token.' } }, { status: 403 });
  try {
    const input = (await request.json()) as Partial<WorkspaceConfig>;
    let existing: WorkspaceConfig | null = null;
    try { existing = await getWorkspaceConfig(session.userId); } catch { /* first configuration */ }
    const config: WorkspaceConfig = {
      github: {
        owner: input.github?.owner?.trim() || existing?.github.owner || '',
        repo: input.github?.repo?.trim() || existing?.github.repo || '',
        branch: input.github?.branch?.trim() || existing?.github.branch || 'main',
        token: input.github?.token?.trim() || existing?.github.token || '',
      },
      revalidate: {
        contentUrl: input.revalidate?.contentUrl?.trim() || existing?.revalidate.contentUrl,
        tweetsUrl: input.revalidate?.tweetsUrl?.trim() || existing?.revalidate.tweetsUrl,
        secret: input.revalidate?.secret?.trim() || existing?.revalidate.secret,
      },
      translation: input.translation?.baseUrl?.trim() || existing?.translation
        ? { baseUrl: input.translation?.baseUrl?.trim() || existing?.translation?.baseUrl || '', apiKey: input.translation?.apiKey?.trim() || existing?.translation?.apiKey || '', model: input.translation?.model?.trim() || existing?.translation?.model, thinking: input.translation?.thinking?.trim() || existing?.translation?.thinking, reasoningEffort: input.translation?.reasoningEffort?.trim() || existing?.translation?.reasoningEffort }
        : undefined,
    };
    if (!config.github.owner || !config.github.repo || !config.github.token) throw new Error('请填写完整的私有仓库配置。');
    if (config.translation && (!config.translation.baseUrl || !config.translation.apiKey)) throw new Error('翻译服务地址和密钥必须同时填写。');
    await saveWorkspaceConfig(session.userId, config);
    return NextResponse.json({ ok: true, data: await getWorkspaceSummary(session.userId) });
  } catch (error) { return NextResponse.json({ ok: false, error: { message: error instanceof Error ? error.message : '无法保存工作区配置。' } }, { status: 422 }); }
}
