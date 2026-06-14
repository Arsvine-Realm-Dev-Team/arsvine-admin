# ARSVINE ADMIN

Web-only admin console for the private content repository.

## What It Does

- administrator password login
- signed `HttpOnly` session cookie + readable CSRF cookie
- Markdown writing and live preview
- publish `posts/YYYY/slug.md` into the private GitHub content repo
- rebuild `posts-index.json`
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
posts/
  2026/
    my-first-post.md
posts-index.json
```

### Example `posts-index.json`

```json
{
  "version": 1,
  "updatedAt": "2026-06-14T12:00:00.000Z",
  "posts": [
    {
      "slug": "my-first-post",
      "title": "My First Post",
      "path": "posts/2026/my-first-post.md",
      "summary": "A short summary.",
      "date": "2026-06-14",
      "updatedAt": "2026-06-14T12:00:00.000Z",
      "access": {
        "mode": "public"
      }
    }
  ]
}
```

### Example post frontmatter

```md
---
title: My First Post
summary: A short summary.
date: 2026-06-14
updatedAt: 2026-06-14T12:00:00.000Z
access:
  mode: public
---

Hello world.
```
