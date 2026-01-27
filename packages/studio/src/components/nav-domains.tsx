'use client'

import { Box, ChevronRight, Database, Hash, type LucideIcon, Plug, Workflow } from 'lucide-react'

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@/components/ui/sidebar'

interface DomainConfig {
  useCases?: string[]
  entities?: string[]
  ports?: { name: string; type: string }[]
  valueObjects?: string[]
  // Support legacy format if necessary or strictly typed based on config
  useCasesList?: string[]
}

interface NavDomainsProps {
  domains: Record<string, DomainConfig>
}

export function NavDomains({ domains }: NavDomainsProps) {
  const domainList = Object.entries(domains || {}).map(([name, config]) => ({
    name,
    ...config,
  }))

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Domains</SidebarGroupLabel>
      <SidebarMenu>
        {domainList.map((domain) => (
          <Collapsible key={domain.name} asChild defaultOpen={false} className="group/collapsible">
            <SidebarMenuItem>
              <CollapsibleTrigger asChild>
                <SidebarMenuButton tooltip={domain.name}>
                  <Box />
                  <span>{domain.name}</span>
                  <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                </SidebarMenuButton>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarMenuSub>
                  {/* Use Cases */}
                  {domain.useCases && domain.useCases.length > 0 && (
                    <NavCategory
                      title="Use Cases"
                      icon={Workflow}
                      items={domain.useCases.map((u) => ({ name: u, url: '#' }))}
                    />
                  )}
                  {/* Ports */}
                  {domain.ports && domain.ports.length > 0 && (
                    <NavCategory
                      title="Ports"
                      icon={Plug}
                      items={domain.ports.map((p) => ({ name: p.name, url: '#' }))}
                    />
                  )}
                  {/* Entities */}
                  {domain.entities && domain.entities.length > 0 && (
                    <NavCategory
                      title="Entities"
                      icon={Database}
                      items={domain.entities.map((e) => ({ name: e, url: '#' }))}
                    />
                  )}
                  {/* Value Objects */}
                  {domain.valueObjects && domain.valueObjects.length > 0 && (
                    <NavCategory
                      title="Value Objects"
                      icon={Hash}
                      items={domain.valueObjects.map((v) => ({ name: v, url: '#' }))}
                    />
                  )}
                </SidebarMenuSub>
              </CollapsibleContent>
            </SidebarMenuItem>
          </Collapsible>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}

function NavCategory({
  title,
  icon: Icon,
  items,
}: {
  title: string
  icon: LucideIcon
  items: { name: string; url: string }[]
}) {
  return (
    <SidebarMenuSubItem>
      <Collapsible className="group/sub-collapsible">
        <CollapsibleTrigger asChild>
          <SidebarMenuSubButton className="cursor-pointer">
            <Icon />
            <span>{title}</span>
            <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/sub-collapsible:rotate-90" />
          </SidebarMenuSubButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {items.map((item) => (
              <SidebarMenuSubItem key={item.name}>
                <SidebarMenuSubButton asChild>
                  <a href={item.url}>
                    <span>{item.name}</span>
                  </a>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </Collapsible>
    </SidebarMenuSubItem>
  )
}
