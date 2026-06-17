'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

type BlogPreviewPanelProps = {
  content: string;
};

export default function BlogPreviewPanel({ content }: BlogPreviewPanelProps) {
  const preview = content || '*在左侧输入 Markdown，这里会实时预览。*';

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Markdown 预览</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[calc(100vh-220px)] pr-3">
          <article className="prose prose-invert max-w-none text-sm leading-relaxed">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{preview}</ReactMarkdown>
          </article>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
