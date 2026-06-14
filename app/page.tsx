import { redirect } from 'next/navigation';
import AdminShell from '../components/AdminShell';
import { getSessionFromCookieStore } from '../lib/auth';

export default async function HomePage() {
  const session = await getSessionFromCookieStore();
  if (!session) {
    redirect('/login');
  }

  return <AdminShell csrfToken={session.csrf} sessionExpiresAt={session.exp} />;
}
