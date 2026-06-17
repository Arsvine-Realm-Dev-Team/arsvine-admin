# ARSVINE ADMIN

Web-only admin console for the private content repository.

## What It Does

- administrator password + TOTP login
- signed `HttpOnly` session cookie + readable CSRF cookie
- Markdown writing and live preview
- publish `blog/<slug>/<locale>.mdx` variants into the private GitHub content repo
- rebuild `blog-index.json`
- manage `tweets/index.json` and `tweets/YYYY-MM.json` from `/tweets`
- call the public site's `/api/revalidate-content` and `/api/revalidate`
- persistent rate limiting on Vercel via Upstash Redis (with local fallback)

## Required Environment Variables

See [.env.example](./.env.example).

## Password Hash

Generate `ADMIN_PASSWORD_HASH` with:

```bash
npm run hash-password -- "your-password"
```

The script prints an `ADMIN_PASSWORD_HASH=...` line that is safe to paste directly into Next's `.env.local`.

At runtime, the hash format is:

```text
scrypt$<base64url-salt>$<base64url-hash>
```

When stored in `.env.local`, each `$` must be escaped as `\$`, otherwise Next will treat it as environment-variable expansion and the login check will fail.

## Admin TOTP

`ADMIN_TOTP_JSON` reuses the main site's TOTP algorithm and JSON shape, but should use a dedicated admin secret:

```json
{"current":"JBSWY3DPEHPK3PXP","period":30,"digits":6,"window":1}
```

- Production and Vercel Preview deployments require both password and TOTP.
- Local `next dev` bypasses TOTP by default so the single-user workflow stays fast.
- To test the full MFA flow locally, set `ADMIN_TOTP_ENFORCE_IN_DEV=true`.
- For secret rotation, add a `previous` array:

```json
{"current":"NEWSECRET","previous":["OLDSECRET"],"period":30,"digits":6,"window":1}
```

## Rate Limiting

- Login, publish, tweet write, and tweet retranslate endpoints are rate-limited.
- On Vercel, configure `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` so limits persist across cold starts and multiple instances.
- If Upstash is missing or temporarily unavailable, the app falls back to a process-local `Map`. That fallback is acceptable for local development, but not strong enough as the only production layer.

## Admin Routes

- `/login`: administrator login
- `/blog`: blog writing and publishing console
- `/tweets`: tweet publishing panel
- `/`: redirects to `/blog`

## Vercel Deployment

1. Create a separate Vercel project for `arsvine-admin`.
2. Set the Node runtime to `22.x` (the repo also declares this in `package.json`).
3. Enable Vercel Authentication for both Preview and Production deployments.
4. Add the required environment variables:

```text
GITHUB_OWNER
GITHUB_REPO
GITHUB_BRANCH
GITHUB_WRITE_TOKEN
SESSION_SECRET
ADMIN_PASSWORD_HASH
ADMIN_TOTP_JSON
PUBLIC_REVALIDATE_URL
PUBLIC_TWEETS_REVALIDATE_URL
PUBLIC_REVALIDATE_SECRET
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
```

5. Scope secrets as follows:
   - Production: all secrets above.
   - Preview: same as Production, so password+TOTP is enforced before merge.
   - Development: optional for local `vercel env pull`; you may omit `ADMIN_TOTP_JSON` unless you also set `ADMIN_TOTP_ENFORCE_IN_DEV=true`.
6. For local parity after linking the project:

```bash
vercel link --yes
vercel env pull .env.local --yes
```

7. Before shipping, verify:
   - wrong password is rejected;
   - correct password + wrong TOTP is rejected;
   - correct password + correct TOTP creates both session and CSRF cookies;
   - rate limiting returns `429` after repeated login attempts.

## Expected Content Repo Shape

```text
blog/
  my-first-post/
    zh-CN.mdx
    en.mdx
blog-index.json
tweets/
  index.json
  2026-06.json
```

### Example `blog-index.json`

```json
{
  "version": 1,
  "updatedAt": "2026-06-14T12:00:00.000Z",
  "posts": [
    {
      "slug": "my-first-post",
      "date": "2026-06-14",
      "updatedAt": "2026-06-14T12:00:00.000Z",
      "tags": ["Essay"],
      "pinned": false,
      "access": {
        "mode": "public"
      },
      "availableLocales": ["zh-CN", "en"],
      "variants": {
        "zh-CN": {
          "title": "我的第一篇文章",
          "excerpt": "一段简短摘要。"
        },
        "en": {
          "title": "My First Post",
          "excerpt": "A short summary.",
          "originLocale": "zh-CN"
        }
      }
    }
  ]
}
```

### Example post frontmatter

```md
---
title: My First Post
excerpt: A short summary.
date: 2026-06-14
tags:
  - Essay
pinned: false
originLocale: zh-CN
updated: 2026-06-14T12:00:00.000Z
access:
  mode: public
---

Hello world.
```
