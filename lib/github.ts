const OWNER = process.env.GITHUB_OWNER?.trim();
const REPO = process.env.GITHUB_REPO?.trim();
const BRANCH = process.env.GITHUB_BRANCH?.trim() || 'main';
const WRITE_TOKEN = process.env.GITHUB_WRITE_TOKEN?.trim();
const PUBLIC_REVALIDATE_URL = process.env.PUBLIC_REVALIDATE_URL?.trim();
const PUBLIC_REVALIDATE_SECRET = process.env.PUBLIC_REVALIDATE_SECRET?.trim();
const PUBLIC_TWEETS_REVALIDATE_URL = process.env.PUBLIC_TWEETS_REVALIDATE_URL?.trim();

type GitHubContentResponse = {
  sha: string;
  content?: string;
};

type GitHubTreeResponse = {
  tree: Array<{ path: string; type: string }>;
};

export class GitHubError extends Error {
  status: number;
  body?: string;

  constructor(message: string, status: number, body?: string) {
    super(message);
    this.name = 'GitHubError';
    this.status = status;
    this.body = body;
  }
}

function assertEnv() {
  if (!OWNER) throw new Error('Missing GITHUB_OWNER');
  if (!REPO) throw new Error('Missing GITHUB_REPO');
  if (!WRITE_TOKEN) throw new Error('Missing GITHUB_WRITE_TOKEN');
}

function contentUrl(path: string) {
  assertEnv();
  return `https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}?ref=${encodeURIComponent(BRANCH)}`;
}

function treeUrl() {
  assertEnv();
  return `https://api.github.com/repos/${OWNER}/${REPO}/git/trees/${encodeURIComponent(BRANCH)}?recursive=1`;
}

async function githubFetch(url: string, init?: RequestInit) {
  assertEnv();
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${WRITE_TOKEN}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'arsvine-admin',
      ...(init?.headers ?? {}),
    },
  });

  return response;
}

export function getContentRepoInfo() {
  assertEnv();
  return {
    owner: OWNER as string,
    repo: REPO as string,
    branch: BRANCH,
    url: `https://github.com/${OWNER}/${REPO}`,
  };
}

export async function getFile(path: string) {
  const response = await githubFetch(contentUrl(path));
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new GitHubError(`Failed to fetch ${path}: ${response.status} ${response.statusText}`, response.status);
  }

  const json = (await response.json()) as GitHubContentResponse;
  const content = json.content
    ? Buffer.from(json.content.replace(/\n/g, ''), 'base64').toString('utf8')
    : '';

  return {
    sha: json.sha,
    content,
  };
}

export async function putFile(params: {
  path: string;
  content: string;
  message: string;
  sha?: string;
}) {
  const response = await githubFetch(contentUrl(params.path), {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: params.message,
      content: Buffer.from(params.content, 'utf8').toString('base64'),
      branch: BRANCH,
      sha: params.sha,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new GitHubError(
      `Failed to write ${params.path}: ${response.status} ${response.statusText}${body ? ` - ${body}` : ''}`,
      response.status,
      body,
    );
  }

  return response.json();
}

export async function deleteFile(params: {
  path: string;
  message: string;
  sha: string;
}) {
  const response = await githubFetch(contentUrl(params.path), {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: params.message,
      branch: BRANCH,
      sha: params.sha,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new GitHubError(
      `Failed to delete ${params.path}: ${response.status} ${response.statusText}${body ? ` - ${body}` : ''}`,
      response.status,
      body,
    );
  }

  return response.json();
}

async function listTreePaths() {
  const response = await githubFetch(treeUrl());
  if (!response.ok) {
    throw new GitHubError(`Failed to read repo tree: ${response.status} ${response.statusText}`, response.status);
  }

  const json = (await response.json()) as GitHubTreeResponse;
  return json.tree;
}

export async function listBlogVariantPaths() {
  return (await listTreePaths())
    .filter((entry) => entry.type === 'blob' && /^blog\/[^/]+\/[^/]+\.mdx$/.test(entry.path))
    .map((entry) => entry.path)
    .sort();
}

export async function listTweetMonthPaths() {
  return (await listTreePaths())
    .filter((entry) => entry.type === 'blob' && /^tweets\/\d{4}-\d{2}\.json$/.test(entry.path))
    .map((entry) => entry.path)
    .sort((a, b) => b.localeCompare(a));
}

export async function triggerPublicRevalidate(slug?: string) {
  if (!PUBLIC_REVALIDATE_URL || !PUBLIC_REVALIDATE_SECRET) {
    throw new Error('Missing PUBLIC_REVALIDATE_URL or PUBLIC_REVALIDATE_SECRET');
  }

  const response = await fetch(PUBLIC_REVALIDATE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      secret: PUBLIC_REVALIDATE_SECRET,
      ...(slug ? { slug } : {}),
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Public revalidate failed: ${response.status} ${response.statusText}${text ? ` - ${text}` : ''}`,
    );
  }

  return response.json() as Promise<{ revalidated: boolean; paths: string[] }>;
}

export async function triggerTweetsRevalidate() {
  if (!PUBLIC_TWEETS_REVALIDATE_URL) {
    return undefined;
  }
  if (!PUBLIC_REVALIDATE_SECRET) {
    return {
      revalidated: false,
      paths: [],
      error: 'Missing PUBLIC_REVALIDATE_SECRET',
    };
  }

  try {
    // POST + body so the shared secret never enters access logs the way a
    // GET querystring would.
    const response = await fetch(PUBLIC_TWEETS_REVALIDATE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: PUBLIC_REVALIDATE_SECRET }),
    });

    if (!response.ok) {
      const text = await response.text();
      return {
        revalidated: false,
        paths: [],
        error: `Tweets revalidate failed: ${response.status} ${response.statusText}${text ? ` - ${text}` : ''}`,
      };
    }

    return response.json() as Promise<{ revalidated: boolean; paths: string[] }>;
  } catch (error) {
    return {
      revalidated: false,
      paths: [],
      error: error instanceof Error ? error.message : 'Tweets revalidate failed.',
    };
  }
}
