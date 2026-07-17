import {
  Activity,
  Building2,
  FileSearch,
  GemIcon,
  Settings,
  Shield,
  TrendingUp,
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
      title: 'Custom Workflow',
      url: '/dashboard/workflow',
      icon: GemIcon,
      isActive:
        pathname === '/dashboard/workflow' ||
        pathname.startsWith('/dashboard/workflow/'),
    },
    {
      title: 'Real Estate Analysis',
      url: '/dashboard/workflows/real-estate-analysis',
      icon: Building2,
      isActive: pathname.startsWith('/dashboard/workflows/real-estate-analysis'),
    },
    {
      title: 'Google Ads Analysis',
      url: '/dashboard/workflows/google-ads-analysis',
      icon: TrendingUp,
      isActive: pathname.startsWith('/dashboard/workflows/google-ads-analysis'),
    },
    {
      title: 'Resume Screening',
      url: '/dashboard/workflows/resume-screening',
      icon: FileSearch,
      isActive: pathname.startsWith('/dashboard/workflows/resume-screening'),
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
