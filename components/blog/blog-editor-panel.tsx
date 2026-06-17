'use client';

import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldGroup, FieldLabel, FieldDescription, FieldSet } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

import { BLOG_LOCALES, localeLabels, type BlogLocale } from './blog-locale-labels';

type AccessMode = 'public' | 'totp';

export type BlogFormState = {
  slug: string;
  locale: BlogLocale;
  title: string;
  excerpt: string;
  date: string;
  tags: string;
  pinned: boolean;
  accessMode: AccessMode;
  accessGroup: string;
  originLocale: string;
  content: string;
};

type BlogEditorPanelProps = {
  form: BlogFormState;
  onChange: <K extends keyof BlogFormState>(key: K, value: BlogFormState[K]) => void;
  publishing: boolean;
  rebuilding: boolean;
  onPublish: () => void;
  onRebuild: () => void;
};

export const INITIAL_BLOG_FORM: BlogFormState = {
  slug: '',
  locale: 'zh-CN',
  title: '',
  excerpt: '',
  date: new Date().toISOString().slice(0, 10),
  tags: '',
  pinned: false,
  accessMode: 'public',
  accessGroup: '',
  originLocale: '',
  content: '',
};

export default function BlogEditorPanel({
  form,
  onChange,
  publishing,
  rebuilding,
  onPublish,
  onRebuild,
}: BlogEditorPanelProps) {
  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>发布面板</CardTitle>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" disabled={rebuilding} onClick={onRebuild}>
            {rebuilding ? (
              <>
                <Loader2 className="animate-spin" /> 重建中…
              </>
            ) : (
              '重建索引'
            )}
          </Button>
          <Button type="button" size="sm" disabled={publishing} onClick={onPublish}>
            {publishing ? (
              <>
                <Loader2 className="animate-spin" /> 发布中…
              </>
            ) : (
              '发布变体'
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onPublish();
          }}
          className="flex flex-col gap-6"
        >
          <Tabs defaultValue="shared">
            <TabsList>
              <TabsTrigger value="shared">共享字段</TabsTrigger>
              <TabsTrigger value="variant">当前语言变体</TabsTrigger>
            </TabsList>
            <TabsContent value="shared" className="mt-4">
              <FieldSet>
                <FieldGroup className="grid grid-cols-2 gap-4">
                  <Field>
                    <FieldLabel>Slug</FieldLabel>
                    <Input
                      value={form.slug}
                      onChange={(event) => onChange('slug', event.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel>日期</FieldLabel>
                    <Input
                      type="date"
                      value={form.date}
                      onChange={(event) => onChange('date', event.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel>访问模式</FieldLabel>
                    <Select
                      value={form.accessMode}
                      onValueChange={(value) => onChange('accessMode', (value ?? 'public') as AccessMode)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="public">public</SelectItem>
                        <SelectItem value="totp">totp</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field className="items-end">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="blog-pinned"
                        checked={form.pinned}
                        onCheckedChange={(checked) => onChange('pinned', checked === true)}
                      />
                      <Label htmlFor="blog-pinned">置顶</Label>
                    </div>
                  </Field>
                  {form.accessMode === 'totp' ? (
                    <Field className="col-span-2">
                      <FieldLabel>访问组</FieldLabel>
                      <Input
                        value={form.accessGroup}
                        onChange={(event) => onChange('accessGroup', event.target.value)}
                        placeholder="friends-a"
                      />
                    </Field>
                  ) : null}
                </FieldGroup>
              </FieldSet>
            </TabsContent>
            <TabsContent value="variant" className="mt-4">
              <FieldSet>
                <FieldGroup className="grid grid-cols-2 gap-4">
                  <Field>
                    <FieldLabel>语言</FieldLabel>
                    <Select
                      value={form.locale}
                      onValueChange={(value) => onChange('locale', (value ?? 'zh-CN') as BlogLocale)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {BLOG_LOCALES.map((locale) => (
                          <SelectItem key={locale} value={locale}>
                            {locale} · {localeLabels[locale]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel>原文来源</FieldLabel>
                    <Select
                      value={form.originLocale}
                      onValueChange={(value) => onChange('originLocale', value ?? '')}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="当前语言即原文" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">当前语言即原文</SelectItem>
                        {BLOG_LOCALES.filter((locale) => locale !== form.locale).map((locale) => (
                          <SelectItem key={locale} value={locale}>
                            {locale} · {localeLabels[locale]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field className="col-span-2">
                    <FieldLabel>标题</FieldLabel>
                    <Input
                      value={form.title}
                      onChange={(event) => onChange('title', event.target.value)}
                    />
                  </Field>
                  <Field className="col-span-2">
                    <FieldLabel>摘要</FieldLabel>
                    <Input
                      value={form.excerpt}
                      onChange={(event) => onChange('excerpt', event.target.value)}
                    />
                  </Field>
                  <Field className="col-span-2">
                    <FieldLabel>Tags</FieldLabel>
                    <Input
                      value={form.tags}
                      onChange={(event) => onChange('tags', event.target.value)}
                      placeholder="Essay, Friend, Tsuki"
                    />
                  </Field>
                  <Field className="col-span-2">
                    <FieldLabel>Markdown 正文</FieldLabel>
                    <Textarea
                      value={form.content}
                      onChange={(event) => onChange('content', event.target.value)}
                      rows={20}
                      className="font-mono"
                    />
                    <FieldDescription>
                      支持 GitHub Flavored Markdown。保存后左侧将自动出现预览。
                    </FieldDescription>
                  </Field>
                </FieldGroup>
              </FieldSet>
            </TabsContent>
          </Tabs>
        </form>
      </CardContent>
    </Card>
  );
}
