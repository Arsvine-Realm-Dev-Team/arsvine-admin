'use client';

import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function ActivationPageClient() {
  const token = useSearchParams().get('token') ?? ''; const [password, setPassword] = useState(''); const [secret, setSecret] = useState(''); const [code, setCode] = useState(''); const [busy, setBusy] = useState(false);
  const start = async (event: React.FormEvent) => { event.preventDefault(); setBusy(true); try { const response = await fetch('/api/auth/invitations/activate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phase: 'start', token, password }) }); const json = await response.json(); if (!response.ok || !json.ok) throw new Error(json.error?.message); setSecret(json.data.totpSecret); } catch (error) { toast.error(error instanceof Error ? error.message : '无法开始激活。'); } finally { setBusy(false); } };
  const verify = async (event: React.FormEvent) => { event.preventDefault(); setBusy(true); try { const response = await fetch('/api/auth/invitations/activate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phase: 'verify', totpToken: code }) }); const json = await response.json(); if (!response.ok || !json.ok) throw new Error(json.error?.message); window.location.href = '/library'; } catch (error) { toast.error(error instanceof Error ? error.message : '验证码无效。'); } finally { setBusy(false); } };
  return <main className="flex min-h-svh items-center justify-center bg-background p-6"><Card className="w-full max-w-md">{!secret ? <><CardHeader><CardTitle>激活编辑账户</CardTitle><CardDescription>设置一个至少 14 位的密码，然后绑定身份验证器。</CardDescription></CardHeader><CardContent><form className="grid gap-5" onSubmit={start}><div className="grid gap-2"><Label htmlFor="password">新密码</Label><Input id="password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} /></div><Button type="submit" disabled={busy || !token}>{busy ? '处理中…' : '继续'}</Button></form></CardContent></> : <><CardHeader><CardTitle>绑定身份验证器</CardTitle><CardDescription>将此密钥添加到任意 TOTP 身份验证器，然后输入 6 位验证码完成激活。</CardDescription></CardHeader><CardContent><form className="grid gap-5" onSubmit={verify}><div className="rounded-md border bg-muted/30 p-4 font-mono text-sm break-all">{secret}</div><Button type="button" variant="outline" onClick={() => void navigator.clipboard.writeText(secret).then(() => toast.success('密钥已复制。'))}><Copy />复制密钥</Button><div className="grid gap-2"><Label htmlFor="totp">验证码</Label><Input id="totp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} /></div><Button type="submit" disabled={busy || code.length !== 6}>{busy ? '验证中…' : <><Check />完成激活</>}</Button></form></CardContent></>}</Card></main>;
}
