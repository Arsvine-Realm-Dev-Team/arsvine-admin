import { redirect } from 'next/navigation';

import AdminShell from '../../components/admin/admin-shell';
import BlogPageClient from '../../components/blog/blog-page-client';
import { getSessionFromCookieStore } from '../../lib/auth';

export default async function BlogPage() {
  const session = await getSessionFromCookieStore();
  if (!session) {
    redirect('/login');
  }

  return (
    <AdminShell csrfToken={session.csrf} sessionExpiresAt={session.exp} email={session.email} role={session.role}>
      <BlogPageClient csrfToken={session.csrf} />
    </AdminShell>
  );
}
