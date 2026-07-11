'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, Check, CircleCheck, ExternalLink, GitBranch, LoaderCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

type Summary = {
  github: { owner: string; repo: string; branch: string; hasToken: boolean };
  revalidate: { hasContentUrl: boolean; hasTweetsUrl: boolean; hasSecret: boolean };
  translation: { baseUrl: string; model: string; hasApiKey: boolean } | null;
};

type Form = {
  owner: string; repo: string; branch: string; token: string;
  contentUrl: string; tweetsUrl: string; secret: string;
  baseUrl: string; apiKey: string; model: string;
};

const STEPS = ['GitHub 仓库', '站点刷新', '翻译服务', '连接检查'];
const EMPTY: Form = { owner: '', repo: '', branch: 'main', token: '', contentUrl: '', tweetsUrl: '', secret: '', baseUrl: '', apiKey: '', model: '' };

export default function OnboardingPageClient({ csrfToken }: { csrfToken: string }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<Form>(EMPTY);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [busy, setBusy] = useState(false);
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    void fetch('/api/admin/workspace', { cache: 'no-store' }).then(async (response) => {
      if (!response.ok) return;
      const json = await response.json() as { ok: boolean; data?: Summary };
      if (!json.ok || !json.data) return;
      const existing = json.data;
      setSummary(existing);
      setForm((current) => ({ ...current, owner: existing.github.owner, repo: existing.github.repo, branch: existing.github.branch || 'main', baseUrl: existing.translation?.baseUrl ?? '', model: existing.translation?.model ?? '' }));
    });
  }, []);

  function update<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function save(body: object, nextStep: number) {
    setBusy(true);
    try {
      const response = await fetch('/api/admin/workspace', { method: 'PUT', headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken }, body: JSON.stringify(body) });
      const json = await response.json() as { ok: boolean; data?: Summary; error?: { message: string } };
      if (!response.ok || !json.ok || !json.data) throw new Error(json.error?.message ?? '无法保存工作区配置。');
      setSummary(json.data);
      setForm((current) => ({ ...current, token: '', secret: '', apiKey: '' }));
      setStep(nextStep);
    } catch (error) { toast.error(error instanceof Error ? error.message : '无法保存工作区配置。'); }
    finally { setBusy(false); }
  }

  async function verify() {
    setBusy(true);
    try {
      const response = await fetch('/api/admin/workspace/verify', { method: 'POST' });
      const json = await response.json() as { ok: boolean; error?: { message: string } };
      if (!response.ok || !json.ok) throw new Error(json.error?.message ?? '无法验证仓库连接。');
      setVerified(true);
      toast.success('GitHub 仓库已验证。');
    } catch (error) { toast.error(error instanceof Error ? error.message : '无法验证仓库连接。'); }
    finally { setBusy(false); }
  }

  const githubReady = Boolean(summary?.github.owner && summary?.github.repo && summary?.github.hasToken);
  const revalidateReady = Boolean(summary?.revalidate.hasContentUrl && summary?.revalidate.hasSecret);
  const translationReady = Boolean(summary?.translation?.baseUrl && summary.translation.hasApiKey);

  return <main className="mx-auto w-full max-w-5xl p-5 sm:p-8 lg:p-10">
    <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div><h1 className="text-2xl font-semibold tracking-tight">连接你的工作区</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">你的仓库、发布配置和翻译密钥仅用于自己的请求，并以加密形式保存。管理员无法查看它们。</p></div>
      <Button variant="outline" render={<a href="/library" />}>稍后完成</Button>
    </div>
    <div className="grid gap-8 lg:grid-cols-[13rem_minmax(0,1fr)]">
      <ol className="flex gap-2 overflow-x-auto lg:flex-col">
        {STEPS.map((label, index) => <li key={label} className="shrink-0"><Button type="button" variant={step === index ? 'secondary' : 'ghost'} className="justify-start" onClick={() => setStep(index)}><span className="grid size-5 place-items-center rounded-full border text-xs">{index + 1}</span>{label}</Button></li>)}
      </ol>
      <Card>
        {step === 0 && <>
          <CardHeader><CardTitle className="flex items-center gap-2"><GitBranch />连接 GitHub 仓库</CardTitle><CardDescription>选择一个仅用于你内容的仓库。创建 fine-grained token 时仅选择该仓库，授予 `Contents: Read and write`；仓库信息读取需要 `Metadata: Read`。</CardDescription></CardHeader>
          <CardContent><FieldGroup><Field><FieldLabel htmlFor="github-owner">GitHub Owner</FieldLabel><Input id="github-owner" value={form.owner} onChange={(event) => update('owner', event.target.value)} placeholder="你的用户名或组织" /></Field><Field><FieldLabel htmlFor="github-repo">Repository</FieldLabel><Input id="github-repo" value={form.repo} onChange={(event) => update('repo', event.target.value)} placeholder="内容仓库名称" /></Field><Field><FieldLabel htmlFor="github-branch">Branch</FieldLabel><Input id="github-branch" value={form.branch} onChange={(event) => update('branch', event.target.value)} /></Field><Field><FieldLabel htmlFor="github-token">Fine-grained personal access token</FieldLabel><Input id="github-token" type="password" autoComplete="off" value={form.token} onChange={(event) => update('token', event.target.value)} placeholder={githubReady ? '留空以保留现有密钥' : 'github_pat_…'} /><FieldDescription>令牌不会再次显示。请仅授予此内容仓库访问权限。</FieldDescription></Field></FieldGroup></CardContent>
          <CardFooter className="justify-between"><Button variant="link" render={<a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noreferrer" />}><ExternalLink data-icon="inline-start" />创建 GitHub Token</Button><Button disabled={busy || !form.owner || !form.repo || (!form.token && !githubReady)} onClick={() => void save({ github: { owner: form.owner, repo: form.repo, branch: form.branch, token: form.token } }, 1)}>{busy ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <ArrowRight data-icon="inline-end" />}保存并继续</Button></CardFooter>
        </>}
        {step === 1 && <>
          <CardHeader><CardTitle>配置站点刷新</CardTitle><CardDescription>可选但推荐。发布后用于让站点及时读取新内容；此步骤不会向你的站点发送请求。</CardDescription></CardHeader>
          <CardContent><FieldGroup><Field><FieldLabel htmlFor="content-url">Blog 刷新 URL</FieldLabel><Input id="content-url" type="url" value={form.contentUrl} onChange={(event) => update('contentUrl', event.target.value)} placeholder={summary?.revalidate.hasContentUrl ? '已配置；留空以保留' : 'https://…/api/revalidate'} /></Field><Field><FieldLabel htmlFor="tweets-url">Tweets 刷新 URL</FieldLabel><Input id="tweets-url" type="url" value={form.tweetsUrl} onChange={(event) => update('tweetsUrl', event.target.value)} placeholder={summary?.revalidate.hasTweetsUrl ? '已配置；留空以保留' : 'https://…/api/revalidate/tweets'} /></Field><Field><FieldLabel htmlFor="revalidate-secret">刷新密钥</FieldLabel><Input id="revalidate-secret" type="password" value={form.secret} onChange={(event) => update('secret', event.target.value)} placeholder={summary?.revalidate.hasSecret ? '已配置；留空以保留' : '站点端的共享密钥'} /></Field></FieldGroup></CardContent>
          <CardFooter className="justify-between"><Button variant="outline" onClick={() => setStep(2)}>暂时跳过</Button><Button disabled={busy} onClick={() => void save({ revalidate: { contentUrl: form.contentUrl, tweetsUrl: form.tweetsUrl, secret: form.secret } }, 2)}>{busy ? '保存中…' : '保存并继续'}<ArrowRight data-icon="inline-end" /></Button></CardFooter>
        </>}
        {step === 2 && <>
          <CardHeader><CardTitle>连接翻译服务</CardTitle><CardDescription>可选。配置后 Blog 和 Tweets 的自动翻译仅会使用你的服务账户和密钥。</CardDescription></CardHeader>
          <CardContent><FieldGroup><Field><FieldLabel htmlFor="translation-url">API Base URL</FieldLabel><Input id="translation-url" type="url" value={form.baseUrl} onChange={(event) => update('baseUrl', event.target.value)} placeholder="https://api.example.com/v1" /></Field><Field><FieldLabel htmlFor="translation-model">模型</FieldLabel><Input id="translation-model" value={form.model} onChange={(event) => update('model', event.target.value)} placeholder="可选" /></Field><Field><FieldLabel htmlFor="translation-key">API Key</FieldLabel><Input id="translation-key" type="password" autoComplete="off" value={form.apiKey} onChange={(event) => update('apiKey', event.target.value)} placeholder={translationReady ? '已配置；留空以保留' : '留空以跳过'} /></Field></FieldGroup></CardContent>
          <CardFooter className="justify-between"><Button variant="outline" onClick={() => setStep(3)}>暂时跳过</Button><Button disabled={busy || Boolean(form.baseUrl) !== Boolean(form.apiKey) && !translationReady} onClick={() => void save(form.baseUrl ? { translation: { baseUrl: form.baseUrl, apiKey: form.apiKey, model: form.model } } : {}, 3)}>{busy ? '保存中…' : '保存并继续'}<ArrowRight data-icon="inline-end" /></Button></CardFooter>
        </>}
        {step === 3 && <>
          <CardHeader><CardTitle>检查连接</CardTitle><CardDescription>检查会以只读方式验证 GitHub 仓库访问，不会修改仓库、触发网站刷新或调用翻译模型。</CardDescription></CardHeader>
          <CardContent className="flex flex-col gap-4"><div className="flex items-center justify-between rounded-md border p-3 text-sm"><span>GitHub 仓库</span><span className="text-muted-foreground">{githubReady ? `${summary?.github.owner}/${summary?.github.repo}` : '尚未配置'}</span></div><div className="flex items-center justify-between rounded-md border p-3 text-sm"><span>站点刷新</span><span className="text-muted-foreground">{revalidateReady ? '已配置' : '可稍后设置'}</span></div><div className="flex items-center justify-between rounded-md border p-3 text-sm"><span>翻译服务</span><span className="text-muted-foreground">{translationReady ? '已配置' : '可稍后设置'}</span></div>{verified && <div className="flex items-center gap-2 rounded-md border bg-muted/30 p-3 text-sm"><CircleCheck />GitHub 仓库连接已验证。</div>}</CardContent>
          <CardFooter className="justify-between"><Button variant="outline" onClick={() => setStep(2)}>返回</Button><div className="flex gap-2"><Button variant="outline" disabled={busy || !githubReady} onClick={() => void verify()}>{busy ? '检查中…' : '验证 GitHub'}</Button><Button disabled={!verified} render={<a href="/library" />}><Check data-icon="inline-start" />进入内容库</Button></div></CardFooter>
        </>}
      </Card>
    </div>
  </main>;
}
