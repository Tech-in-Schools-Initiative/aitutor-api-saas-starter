// components/app-sidebar.tsx
'use client';
import * as React from "react";
import { Users, Settings, Shield, Activity, MessageCircle, GemIcon, BotIcon } from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from '@/components/ui/sidebar';
import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import { usePathname } from 'next/navigation';
import { Logo } from '@/components/logo';
import { SubscriptionStatus } from '@/components/subscription-status';

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();

  const navItems = [
    {
      title: "Workflow",
      url: "/dashboard/workflow",
      icon: GemIcon,
      isActive: pathname.startsWith('/dashboard/workflow'),
    },
    {
      title: "Chatbot",
      url: "/dashboard/chatbot",
      icon: BotIcon,
      isActive: pathname.startsWith('/dashboard/chatbot'),
    },
    {
      title: "Streaming",
      url: "/dashboard/streaming",
      icon: MessageCircle,
      isActive: pathname.startsWith('/dashboard/streaming'),
    },
    {
      title: "Team",
      url: '/dashboard/team',
      icon: Users,
      isActive: pathname.startsWith('/dashboard/team'),
    },
    {
      title: "General",
      url: '/dashboard/general',
      icon: Settings,
      isActive: pathname.startsWith('/dashboard/general'),
    },
    {
      title: "Activity",
      url: '/dashboard/activity',
      icon: Activity,
      isActive: pathname.startsWith('/dashboard/activity'),
    },
    {
      title: "Security",
      url: '/dashboard/security',
      icon: Shield,
      isActive: pathname.startsWith('/dashboard/security'),
    },
  ];

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
