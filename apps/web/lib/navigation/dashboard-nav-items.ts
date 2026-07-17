import {
  Activity,
  BotIcon,
  GemIcon,
  KeyRound,
  MessageCircle,
  Settings,
  Shield,
  Users,
  type LucideIcon,
} from 'lucide-react';

export interface DashboardNavItem {
  title: string;
  url: string;
  icon: LucideIcon;
  isActive: boolean;
}

export function getDashboardNavItems(pathname: string): DashboardNavItem[] {
  return [
    {
      title: 'Workflow',
      url: '/dashboard/workflow',
      icon: GemIcon,
      isActive: pathname.startsWith('/dashboard/workflow'),
    },
    {
      title: 'Chatbot',
      url: '/dashboard/chatbot',
      icon: BotIcon,
      isActive: pathname.startsWith('/dashboard/chatbot'),
    },
    {
      title: 'Streaming',
      url: '/dashboard/streaming',
      icon: MessageCircle,
      isActive: pathname.startsWith('/dashboard/streaming'),
    },
    {
      title: 'Get Token',
      url: '/dashboard/get-token',
      icon: KeyRound,
      isActive: pathname.startsWith('/dashboard/get-token'),
    },
    {
      title: 'Team',
      url: '/dashboard/team',
      icon: Users,
      isActive: pathname.startsWith('/dashboard/team'),
    },
    {
      title: 'General',
      url: '/dashboard/general',
      icon: Settings,
      isActive: pathname.startsWith('/dashboard/general'),
    },
    {
      title: 'Activity',
      url: '/dashboard/activity',
      icon: Activity,
      isActive: pathname.startsWith('/dashboard/activity'),
    },
    {
      title: 'Security',
      url: '/dashboard/security',
      icon: Shield,
      isActive: pathname.startsWith('/dashboard/security'),
    },
  ];
}
