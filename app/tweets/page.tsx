import { redirect } from 'next/navigation';

import AdminShell from '../../components/admin/admin-shell';
import TweetsPageClient from '../../components/tweets/tweets-page-client';
import { getSessionFromCookieStore } from '../../lib/auth';

export default async function TweetsPage() {
  const session = await getSessionFromCookieStore();
  if (!session) {
    redirect('/login');
  }

  return (
    <AdminShell csrfToken={session.csrf} sessionExpiresAt={session.exp}>
      <TweetsPageClient csrfToken={session.csrf} />
    </AdminShell>
  );
}
