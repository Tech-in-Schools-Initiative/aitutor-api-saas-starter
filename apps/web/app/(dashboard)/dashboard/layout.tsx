// app/(dashboard)/dashboard/layout.tsx
'use client';

import * as React from "react";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppSidebar } from "@/components/app-sidebar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@repo/ui/components/sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [queryClient] = React.useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <SidebarProvider className="bg-gradient-to-br from-pink-100 via-purple-100 to-indigo-100">
        <AppSidebar variant="floating" collapsible="icon" />
        <SidebarInset>
          <div className="bg-gradient-to-br from-pink-100 via-purple-100 to-indigo-100 min-h-[calc(100dvh)]">
          <div className="flex flex-col max-w-7xl mx-auto w-full">
            {children}
          </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </QueryClientProvider>
  );
}