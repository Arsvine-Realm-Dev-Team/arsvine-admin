'use client';

import { LogOut, MessageCircle, FileText } from 'lucide-react';
import { useTransition, type ReactNode } from 'react';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Toaster } from '@/components/ui/sonner';

type NavItem = {
  href: string;
  label: string;
  icon: ReactNode;
};

type AdminShellClientProps = {
  currentPath: string;
  sessionExpiresAt: number;
  children: ReactNode;
};

const NAV_ITEMS: NavItem[] = [
  { href: '/blog', label: 'Blog', icon: <FileText /> },
  { href: '/tweets', label: 'Tweets', icon: <MessageCircle /> },
];

export default function AdminShellClient({
  currentPath,
  sessionExpiresAt,
  children,
}: AdminShellClientProps) {
  const [pending, startTransition] = useTransition();

  const handleLogout = () => {
    startTransition(async () => {
      await fetch('/api/admin/logout', { method: 'POST' });
      window.location.href = '/login';
    });
  };

  return (
    <SidebarProvider>
      <Toaster richColors position="top-right" />
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <div className="flex items-center gap-2 px-2 py-1.5 text-sm group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
            <span className="font-semibold tracking-wider text-primary group-data-[collapsible=icon]:hidden">
              ARSVINE
            </span>
            <span className="hidden font-semibold tracking-wider text-primary group-data-[collapsible=icon]:inline">
              A
            </span>
            <span className="text-muted-foreground group-data-[collapsible=icon]:hidden">
              ADMIN
            </span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Modules</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {NAV_ITEMS.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      render={<a href={item.href} />}
                      isActive={currentPath.startsWith(item.href)}
                      tooltip={item.label}
                    >
                      {item.icon}
                      <span className="group-data-[collapsible=icon]:hidden">{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <div className="flex flex-col gap-2 px-2 py-2 text-xs text-muted-foreground">
            <div className="flex items-center justify-between group-data-[collapsible=icon]:hidden">
              <span>SESSION</span>
              <span className="font-mono text-foreground/80">
                {new Date(sessionExpiresAt).toLocaleString('zh-CN', { hour12: false })}
              </span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={handleLogout}
              disabled={pending}
              className="w-full"
              title="登出"
              aria-label="登出"
            >
              <LogOut />
              <span className="group-data-[collapsible=icon]:hidden">登出</span>
            </Button>
          </div>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
        </header>
        <div className="flex-1 overflow-auto">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
