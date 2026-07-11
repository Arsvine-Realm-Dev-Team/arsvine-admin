'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const value = theme === 'light' || theme === 'dark' ? theme : 'system';
  const Icon = value === 'dark' ? Moon : value === 'light' ? Sun : Monitor;
  return <DropdownMenu>
    <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="切换主题"><Icon /></Button>} />
    <DropdownMenuContent align="end">
      <DropdownMenuGroup>
        <DropdownMenuRadioGroup value={value} onValueChange={(next) => setTheme(next)}>
          <DropdownMenuRadioItem value="system"><Monitor />跟随系统</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="light"><Sun />浅色</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark"><Moon />深色</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuGroup>
    </DropdownMenuContent>
  </DropdownMenu>;
}
