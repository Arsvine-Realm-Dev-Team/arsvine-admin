'use client';

import { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

type BlogPreviewPanelProps = {
  content: string;
};

function buildPreviewContent(content: string) {
  if (!content) {
    return '*在左侧输入 Markdown，这里会实时预览。*';
  }

  const footnotes: string[] = [];
  let footnoteIndex = 0;

  const transformed = content.replace(
    /<(Explain|Term)\s+note="([^"]+)">([\s\S]*?)<\/\1>/g,
    (_, _tag: string, note: string, text: string) => {
      footnoteIndex += 1;
      footnotes.push(`[^${footnoteIndex}]: ${note.trim()}`);
      return `${text.trim()}[^${footnoteIndex}]`;
    },
  );

  if (footnotes.length === 0) {
    return transformed;
  }

  return `${transformed}\n\n${footnotes.join('\n')}`;
}

export default function BlogPreviewPanel({ content }: BlogPreviewPanelProps) {
  const preview = useMemo(() => buildPreviewContent(content), [content]);

  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <CardHeader className="shrink-0">
        <CardTitle>Markdown 预览</CardTitle>
      </CardHeader>
      <CardContent className="min-h-0 flex-1">
        <ScrollArea className="h-full pr-3">
          <article className="max-w-none space-y-4 text-sm leading-7 text-foreground">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ children }) => <h1 className="text-2xl font-semibold tracking-tight">{children}</h1>,
                h2: ({ children }) => <h2 className="text-xl font-semibold tracking-tight">{children}</h2>,
                h3: ({ children }) => <h3 className="text-lg font-semibold tracking-tight">{children}</h3>,
                p: ({ children }) => <p className="whitespace-pre-wrap text-sm leading-7">{children}</p>,
                ul: ({ children }) => <ul className="list-disc space-y-1 pl-5">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal space-y-1 pl-5">{children}</ol>,
                blockquote: ({ children }) => (
                  <blockquote className="border-l-2 border-border pl-4 text-muted-foreground">
                    {children}
                  </blockquote>
                ),
                code: ({ children }) => (
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.9em]">{children}</code>
                ),
                hr: () => <hr className="border-border" />,
                a: ({ href, children }) => (
                  <a
                    href={href}
                    className="text-primary underline underline-offset-4"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {children}
                  </a>
                ),
              }}
            >
              {preview}
            </ReactMarkdown>
          </article>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
