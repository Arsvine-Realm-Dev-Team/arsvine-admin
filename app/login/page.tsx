'use client';

import { useState } from 'react';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      });

      const json = (await response.json()) as
        | { ok: true }
        | { ok: false; error: { message: string } };

      if (!response.ok || !json.ok) {
        throw new Error(json.ok ? 'Login failed.' : json.error.message);
      }

      window.location.href = '/';
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Login failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="login-shell">
      <section className="login-card">
        <p className="eyebrow">Admin Login</p>
        <h1>ARSVINE ADMIN</h1>
        <p>输入管理员密码以进入写作与发布后台。登录后会签发 HttpOnly 会话 cookie 与 CSRF token。</p>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            autoComplete="current-password"
            placeholder="管理员密码"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {error ? <p className="status error">{error}</p> : null}
          <button className="primary-button" type="submit" disabled={submitting}>
            {submitting ? '登录中…' : '登录'}
          </button>
        </form>
      </section>
    </main>
  );
}
