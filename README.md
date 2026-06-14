# ARSVINE ADMIN

Web-only admin console for the private content repository.

## What It Does

- administrator password login
- signed `HttpOnly` session cookie + readable CSRF cookie
- Markdown writing and live preview
- publish `blog/<slug>/<locale>.mdx` variants into the private GitHub content repo
- rebuild `blog-index.json`
- call the public site's `/api/revalidate-content`

## Required Environment Variables

See [.env.example](./.env.example).

## Password Hash

Generate `ADMIN_PASSWORD_HASH` with:

```bash
npm run hash-password -- "your-password"
```

The generated value uses:

```text
scrypt$<base64url-salt>$<base64url-hash>
```

## Expected Content Repo Shape

```text
blog/
  my-first-post/
    zh-CN.mdx
    en.mdx
blog-index.json
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
