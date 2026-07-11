'use client';

import { useState } from 'react';
import { Loader2, LogIn } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldGroup, FieldLabel, FieldSet } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

type LoginResponse = { ok: true } | { ok: false; error: { message: string } };

async function readLoginResponse(response: Response): Promise<LoginResponse | null> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as LoginResponse;
  } catch {
    return null;
  }
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpToken, setTotpToken] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, totpToken }),
      });
      const json = await readLoginResponse(response);
      if (!response.ok || !json?.ok) {
        throw new Error(json?.ok ? '登录失败。' : json?.error.message ?? `登录失败（HTTP ${response.status}）。`);
      }
      window.location.href = '/blog';
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '登录失败。');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardDescription>Admin Login</CardDescription>
          <CardTitle>ARSVINE ADMIN</CardTitle>
          <p className="text-sm text-muted-foreground">
            输入管理员凭据以进入写作与发布后台。
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <FieldSet>
              <FieldGroup>
                <Field>
                  <FieldLabel>邮箱地址</FieldLabel>
                  <Input
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel>管理员密码</FieldLabel>
                  <Input
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel>TOTP 验证码</FieldLabel>
                  <Input
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={totpToken}
                    maxLength={6}
                    onChange={(event) => setTotpToken(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  />
                </Field>
              </FieldGroup>
            </FieldSet>
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? (
                <>
                  <Loader2 className="animate-spin" /> 登录中…
                </>
              ) : (
                <>
                  <LogIn /> 登录
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
