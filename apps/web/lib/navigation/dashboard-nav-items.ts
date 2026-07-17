import {
  Activity,
  GemIcon,
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
