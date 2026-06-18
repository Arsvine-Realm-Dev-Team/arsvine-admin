import { headers } from 'next/headers';

import AdminShellClient from './admin-shell-client';
import type { ReactNode } from 'react';

type AdminShellProps = {
  csrfToken: string;
  sessionExpiresAt: number;
  children: ReactNode;
};

export default async function AdminShell({
  csrfToken,
  sessionExpiresAt,
  children,
}: AdminShellProps) {
  const headerStore = await headers();
  const currentPath = headerStore.get('x-pathname') ?? headerStore.get('x-invoke-path') ?? '/blog';

  return (
    <AdminShellClient
      currentPath={currentPath}
      csrfToken={csrfToken}
      sessionExpiresAt={sessionExpiresAt}
    >
      {children}
    </AdminShellClient>
  );
}
