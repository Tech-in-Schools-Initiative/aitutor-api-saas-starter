// components/app-sidebar.tsx
'use client';
import * as React from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from '@repo/ui/components/sidebar';
import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import { usePathname } from 'next/navigation';
import { Logo } from '@/components/logo';
import { SubscriptionStatus } from '@/components/subscription-status';
import { getDashboardNavItems } from '@/lib/navigation/dashboard-nav-items';

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const navItems = getDashboardNavItems(pathname);

  return (
    <Sidebar 
      className="hidden lg:block transition-all duration-300 ease-in-out"
      {...props}
    >
      <SidebarHeader className="py-4 flex flex-col items-center">
        <Logo /> 
      </SidebarHeader>
      <SidebarContent className="flex flex-col flex-1">
        <div className="flex-1">
          <NavMain items={navItems} />
        </div>
        <div className="mt-2">
          <SubscriptionStatus />
        </div>
        <SidebarFooter className="mt-auto">
          <NavUser />
        </SidebarFooter>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
