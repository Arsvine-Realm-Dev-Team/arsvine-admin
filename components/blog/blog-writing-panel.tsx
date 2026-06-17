'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldSet } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';

import type { BlogFormState } from './blog-editor-panel';

type BlogWritingPanelProps = {
  form: BlogFormState;
  onChange: <K extends keyof BlogFormState>(key: K, value: BlogFormState[K]) => void;
};

export default function BlogWritingPanel({ form, onChange }: BlogWritingPanelProps) {
  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <CardHeader className="shrink-0">
        <CardTitle>写作区</CardTitle>
      </CardHeader>
      <CardContent className="min-h-0 flex-1">
        <ScrollArea className="h-full pr-3">
          <FieldSet>
            <FieldGroup className="flex flex-col gap-4 pb-4">
              <Field>
                <FieldLabel>标题</FieldLabel>
                <Input
                  value={form.title}
                  onChange={(event) => onChange('title', event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel>摘要</FieldLabel>
                <Input
                  value={form.excerpt}
                  onChange={(event) => onChange('excerpt', event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel>Tags</FieldLabel>
                <Input
                  value={form.tags}
                  onChange={(event) => onChange('tags', event.target.value)}
                  placeholder="Essay, Personal"
                />
              </Field>
              <Field>
                <FieldLabel>Markdown 正文</FieldLabel>
                <Textarea
                  value={form.content}
                  onChange={(event) => onChange('content', event.target.value)}
                  rows={24}
                  className="font-mono"
                />
                <FieldDescription>
                  支持 GitHub Flavored Markdown。可切换到“预览”查看渲染结果。
                </FieldDescription>
              </Field>
            </FieldGroup>
          </FieldSet>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
