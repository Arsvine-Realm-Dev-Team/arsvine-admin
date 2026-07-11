'use client';

import { useCallback, useEffect, useState } from 'react';
import { Copy, Link, Plus, UserRoundX } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type Member = { id: string; email: string; role: 'owner' | 'editor'; status: 'pending' | 'active' | 'disabled'; createdAt: string; updatedAt: string };
type Invitation = { id: string; email: string; status: 'pending'; expiresAt: string; createdAt: string };
type MemberData = { members: Member[]; invitations: Invitation[] };

function formatDate(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toISOString().slice(0, 10); }

export default function MembersPageClient({ csrfToken }: { csrfToken: string }) {
  const [data, setData] = useState<MemberData>({ members: [], invitations: [] });
  const [email, setEmail] = useState('');
  const [open, setOpen] = useState(false);
  const [createdLink, setCreatedLink] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch('/api/admin/members', { cache: 'no-store' });
    const json = await response.json() as { ok: boolean; data?: MemberData };
    if (response.ok && json.ok && json.data) setData(json.data);
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);

  async function copy(value: string, message: string) { await navigator.clipboard.writeText(value); toast.success(message); }
  async function invite() {
    setInviting(true);
    try {
      const response = await fetch('/api/admin/members', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken }, body: JSON.stringify({ email }) });
      const json = await response.json() as { ok: boolean; data?: { invitationUrl: string }; error?: { message: string } };
      if (!response.ok || !json.ok || !json.data) throw new Error(json.error?.message ?? '创建邀请失败。');
      setCreatedLink(json.data.invitationUrl); setEmail(''); await load();
    } catch (error) { toast.error(error instanceof Error ? error.message : '创建邀请失败。'); }
    finally { setInviting(false); }
  }
  async function revoke(id: string) {
    try {
      const response = await fetch(`/api/admin/members/invitations/${id}`, { method: 'DELETE', headers: { 'x-csrf-token': csrfToken } });
      const json = await response.json() as { ok: boolean; error?: { message: string } };
      if (!response.ok || !json.ok) throw new Error(json.error?.message ?? '撤销邀请失败。');
      toast.success('邀请已撤销。'); await load();
    } catch (error) { toast.error(error instanceof Error ? error.message : '撤销邀请失败。'); }
  }
  async function setStatus(member: Member, status: 'active' | 'disabled') {
    try {
      const response = await fetch(`/api/admin/members/${member.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken }, body: JSON.stringify({ status }) });
      const json = await response.json() as { ok: boolean; error?: { message: string } };
      if (!response.ok || !json.ok) throw new Error(json.error?.message ?? '更新失败。');
      toast.success(status === 'disabled' ? '账户已停用，私密配置已删除。' : '账户已重新启用。'); await load();
    } catch (error) { toast.error(error instanceof Error ? error.message : '更新失败。'); }
  }

  return <main className="mx-auto w-full max-w-6xl p-5 lg:p-8"><div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-2xl font-semibold tracking-tight">成员</h1><p className="mt-1 text-sm text-muted-foreground">仅管理账户与邀请。成员的内容、仓库和凭据始终不可见。</p></div><Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) setCreatedLink(null); }}><DialogTrigger render={<Button><Plus data-icon="inline-start" />邀请编辑</Button>} /><DialogContent><DialogHeader><DialogTitle>{createdLink ? '邀请链接已创建' : '邀请编辑'}</DialogTitle><DialogDescription>{createdLink ? '复制并通过你自己的渠道发送此一次性链接。二维码、TOTP 密钥和接入说明仅会在接收者打开链接后显示。' : '系统会生成一条仅能使用一次、72 小时后失效的邀请链接。'}</DialogDescription></DialogHeader>{createdLink ? <div className="flex gap-2"><Input value={createdLink} readOnly /><Button type="button" variant="outline" size="icon" aria-label="复制邀请链接" onClick={() => void copy(createdLink, '邀请链接已复制。')}><Copy /></Button></div> : <FieldGroup><Field><FieldLabel htmlFor="member-email">邮箱地址</FieldLabel><Input id="member-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></Field></FieldGroup>}<DialogFooter>{createdLink ? <Button onClick={() => setOpen(false)}>完成</Button> : <Button onClick={() => void invite()} disabled={inviting || !email}>{inviting ? '创建中…' : <><Link data-icon="inline-start" />创建邀请链接</>}</Button>}</DialogFooter></DialogContent></Dialog></div>
    <section><h2 className="mb-3 text-sm font-medium">待接受的邀请</h2><Table><TableHeader><TableRow><TableHead>邮箱</TableHead><TableHead>有效至</TableHead><TableHead><span className="sr-only">操作</span></TableHead></TableRow></TableHeader><TableBody>{data.invitations.length === 0 ? <TableRow><TableCell colSpan={3} className="text-muted-foreground">没有待接受的邀请。</TableCell></TableRow> : data.invitations.map((invitation) => <TableRow key={invitation.id}><TableCell>{invitation.email}</TableCell><TableCell className="font-mono text-xs text-muted-foreground">{formatDate(invitation.expiresAt)}</TableCell><TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => void revoke(invitation.id)}>撤销</Button></TableCell></TableRow>)}</TableBody></Table></section>
    <section className="mt-8"><h2 className="mb-3 text-sm font-medium">账户</h2><Table><TableHeader><TableRow><TableHead>邮箱</TableHead><TableHead>角色</TableHead><TableHead>状态</TableHead><TableHead>加入时间</TableHead><TableHead><span className="sr-only">操作</span></TableHead></TableRow></TableHeader><TableBody>{data.members.map((member) => <TableRow key={member.id}><TableCell className="font-medium">{member.email}</TableCell><TableCell>{member.role === 'owner' ? '唯一管理员' : '编辑'}</TableCell><TableCell><Badge variant={member.status === 'active' ? 'secondary' : 'outline'}>{member.status === 'active' ? '活跃' : member.status === 'pending' ? '待激活' : '已停用'}</Badge></TableCell><TableCell className="font-mono text-xs text-muted-foreground">{formatDate(member.createdAt)}</TableCell><TableCell className="text-right">{member.role === 'editor' ? <Button size="sm" variant={member.status === 'disabled' ? 'outline' : 'destructive'} onClick={() => void setStatus(member, member.status === 'disabled' ? 'active' : 'disabled')}>{member.status === 'disabled' ? '重新启用' : <><UserRoundX data-icon="inline-start" />停用</>}</Button> : <span className="text-xs text-muted-foreground">受保护</span>}</TableCell></TableRow>)}</TableBody></Table></section>
  </main>;
}
