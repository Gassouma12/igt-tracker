import {
  Activity, BarChart3, Briefcase, Building2, CalendarDays, FileText,
  LayoutDashboard, Settings, Target, TrendingUp, Users, Workflow,
} from 'lucide-react'
import type { ComponentType } from 'react'
import type { Role } from '@/data/types'

export interface NavItem {
  to: string
  label: string
  icon: ComponentType<{ size?: number }>
  end?: boolean
}

const ADMIN_NAV: NavItem[] = [
  { to: '/admin', label: 'Global Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/lcs', label: 'LC Management', icon: Building2 },
  { to: '/admin/users', label: 'User Management', icon: Users },
  { to: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/me/performance', label: 'Performance', icon: TrendingUp },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
]

const LC_NAV: NavItem[] = [
  { to: '/lc', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/lc/pipeline', label: 'Pipeline', icon: Workflow },
  { to: '/lc/team', label: 'Team', icon: Users },
  { to: '/lc/goals', label: 'Goals', icon: Target },
  { to: '/me/performance', label: 'Performance', icon: TrendingUp },
  { to: '/lc/reports', label: 'Reports', icon: FileText },
]

const MEMBER_NAV: NavItem[] = [
  { to: '/me', label: 'My Pipeline', icon: Workflow, end: true },
  { to: '/me/companies', label: 'Companies', icon: Briefcase },
  { to: '/me/activities', label: 'Activities', icon: Activity },
  { to: '/me/meetings', label: 'Meetings', icon: CalendarDays },
  { to: '/me/performance', label: 'Performance', icon: TrendingUp },
]

export function navFor(role: Role): NavItem[] {
  if (role === 'admin') return ADMIN_NAV
  if (role === 'lcp' || role === 'lcvp') return LC_NAV
  return MEMBER_NAV
}

export function homePathFor(role: Role): string {
  if (role === 'admin') return '/admin'
  if (role === 'lcp' || role === 'lcvp') return '/lc'
  return '/me'
}
