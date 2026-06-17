'use client';

import { CheckCircle2, FilePenLine, Languages, Loader2, PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldGroup, FieldLabel, FieldDescription, FieldSet } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';

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
  localeStates: Array<{
    locale: BlogLocale;
    hasDraft: boolean;
    isPublished: boolean;
  }>;
  onChange: <K extends keyof BlogFormState>(key: K, value: BlogFormState[K]) => void;
  publishing: boolean;
  batchPublishing: boolean;
  translating: boolean;
  savingDraft: boolean;
  rebuilding: boolean;
  draftCount: number;
  onTranslate: () => void;
  onSaveDraft: () => void;
  onPublishAllDrafts: () => void;
  onSelectLocale: (locale: BlogLocale) => void;
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
  localeStates,
  onChange,
  publishing,
  batchPublishing,
  translating,
  savingDraft,
  rebuilding,
  draftCount,
  onTranslate,
  onSaveDraft,
  onPublishAllDrafts,
  onSelectLocale,
  onPublish,
  onRebuild,
}: BlogEditorPanelProps) {
  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <CardHeader className="flex shrink-0 flex-col items-start gap-3">
        <CardTitle className="whitespace-nowrap">发布面板</CardTitle>
        <div className="flex w-full flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" disabled={savingDraft} onClick={onSaveDraft}>
            {savingDraft ? (
              <>
                <Loader2 className="animate-spin" /> 暂存中…
              </>
            ) : (
              '暂存草稿'
            )}
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={rebuilding} onClick={onRebuild}>
            {rebuilding ? (
              <>
                <Loader2 className="animate-spin" /> 重建中…
              </>
            ) : (
              '重建索引'
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={batchPublishing || draftCount === 0}
            onClick={onPublishAllDrafts}
          >
            {batchPublishing ? (
              <>
                <Loader2 className="animate-spin" /> 批量发布中…
              </>
            ) : (
              `发布当前文章（${draftCount}）`
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
      <CardContent className="min-h-0 flex-1">
        <ScrollArea className="h-full pr-3">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              onPublish();
            }}
            className="flex flex-col gap-6 pb-4"
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
                    <Field>
                      <FieldLabel className="opacity-0">置顶</FieldLabel>
                      <div className="flex h-8 items-center gap-2">
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
                    <Field className="col-span-2">
                      <FieldLabel>语言变体</FieldLabel>
                      <div className="flex flex-wrap gap-2">
                        {localeStates.map((state) => {
                          const active = state.locale === form.locale;
                          const statusLabel = state.isPublished
                            ? '已发布'
                            : state.hasDraft
                              ? '草稿'
                              : '空白';
                          const StatusIcon = state.isPublished
                            ? CheckCircle2
                            : state.hasDraft
                              ? FilePenLine
                              : PlusCircle;

                          return (
                            <Button
                              key={state.locale}
                              type="button"
                              size="sm"
                              variant={active ? 'default' : 'outline'}
                              onClick={() => onSelectLocale(state.locale)}
                              className="justify-start gap-2"
                            >
                              <span>{localeLabels[state.locale]}</span>
                              <span className="inline-flex items-center gap-1 text-[11px] opacity-80">
                                <StatusIcon className="size-3.5" />
                                {statusLabel}
                              </span>
                            </Button>
                          );
                        })}
                      </div>
                      <FieldDescription>
                        可直接切换到任意语言开始编辑；未发布的语言会先作为本地草稿存在。
                      </FieldDescription>
                    </Field>
                    <Field className="col-span-2">
                      <FieldLabel>当前语言</FieldLabel>
                      <Select
                        value={form.locale}
                        onValueChange={(value) => onSelectLocale((value ?? 'zh-CN') as BlogLocale)}
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
                    <Field className="col-span-2">
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
                    {form.locale === 'zh-CN' ? (
                      <Field className="col-span-2">
                        <div className="flex flex-wrap items-center gap-3">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={translating}
                            onClick={onTranslate}
                          >
                            {translating ? (
                              <>
                                <Loader2 className="animate-spin" /> 自动翻译中…
                              </>
                            ) : (
                              <>
                                <Languages /> 生成 zh-TW / en 草稿
                              </>
                            )}
                          </Button>
                          <FieldDescription>
                            以当前 `zh-CN` 为母本，按既有 MDX 翻译指南生成 `zh-TW` 与 `en` 草稿，不会立即发布。
                          </FieldDescription>
                        </div>
                      </Field>
                    ) : null}
                    <Field className="col-span-2">
                      <FieldDescription>
                        当前文章已暂存 {draftCount} 个语言草稿。单独“发布变体”只发当前语言；“发布当前文章”会把该 slug 的全部草稿一次性发布。
                      </FieldDescription>
                    </Field>
                    <Field className="col-span-2">
                      <FieldDescription>
                        标题、摘要、标签与 Markdown 正文已移到右侧“写作 / 预览”区域。
                      </FieldDescription>
                    </Field>
                  </FieldGroup>
                </FieldSet>
              </TabsContent>
            </Tabs>
          </form>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
