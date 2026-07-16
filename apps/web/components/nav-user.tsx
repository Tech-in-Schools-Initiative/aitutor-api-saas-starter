// components/nav-user.tsx
"use client"

import { useUser } from '@/lib/auth';
import { use } from 'react';
import {
  ChevronsUpDown,
  Settings,
  KeyRound,
  LogOut,
  Users,
  Activity,
  ShieldCheck,
} from "lucide-react";

import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { signOut } from '@/app/(login)/actions';
import { useRouter } from 'next/navigation';

export function NavUser() {
  const { userPromise } = useUser();
  const user = use(userPromise);
  const { isMobile } = useSidebar();
  const router = useRouter();

  if (!user) {
    return null;
  }

  const handleSignOut = async () => {
    await signOut();
    router.refresh();
    router.push('/');
  };

  // Get initials from user's name or first letter of email
  const getInitials = () => {
    if (user.name) {
      return user.name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase();
    }
    return user.email[0].toUpperCase();
  };

  const UserAvatar = () => (
    <Avatar className="h-8 w-8 rounded-lg bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500">
      <AvatarFallback className="rounded-lg text-white font-medium">
        {getInitials()}
      </AvatarFallback>
    </Avatar>
  );

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <UserAvatar />
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{user.name || user.email}</span>
                <span className="truncate text-xs">{user.email}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <UserAvatar />
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{user.name || user.email}</span>
                  <span className="truncate text-xs">{user.email}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem asChild>
                <a href="/dashboard/get-token">
                  <KeyRound className="mr-2 h-4 w-4" />
                  Token
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href="/dashboard/team">
                  <Users className="mr-2 h-4 w-4" />
                  Team
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href="/dashboard/general">
                  <Settings className="mr-2 h-4 w-4" />
                  General
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href="/dashboard/activity">
                  <Activity className="mr-2 h-4 w-4" />
                  Activity
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href="/dashboard/security">
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Security
                </a>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
