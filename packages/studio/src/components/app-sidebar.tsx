'use client'

import config from 'virtual:kompo-config'
import { Database, Frame } from 'lucide-react'
import * as React from 'react'
import { NavDashboards } from '@/components/nav-dashboards'
import { NavDomains } from '@/components/nav-domains'
import { Sidebar, SidebarContent, SidebarHeader, SidebarRail } from '@/components/ui/sidebar'

// Helper to get dashboards from config
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getDashboards(cfg: typeof config | any) {
  const dashboards = [
    {
      name: 'Graph Flow',
      url: '/graph',
      icon: Frame,
    },
  ]

  // Add local tools from adapters
  const seenTools = new Set<string>()

  if (cfg.adapters) {
    Object.values(cfg.adapters as Record<string, { engine: string }>).forEach((adapter) => {
      if (adapter.engine === 'drizzle' && !seenTools.has('Drizzle Use Studio')) {
        dashboards.push({
          name: 'Drizzle Use Studio',
          url: 'https://local.drizzle.studio',
          icon: Database,
        })
        seenTools.add('Drizzle Use Studio')
      }
      if (adapter.engine === 'prisma' && !seenTools.has('Prisma Studio')) {
        dashboards.push({
          name: 'Prisma Studio',
          url: 'http://localhost:5555',
          icon: Database,
        })
        seenTools.add('Prisma Studio')
      }
    })
  }

  return dashboards
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const dashboards = React.useMemo(() => getDashboards(config), [])

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>Kompo</SidebarHeader>
      <SidebarContent>
        <NavDashboards dashboards={dashboards} />
        <NavDomains domains={config.domains} />
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
