import type { Edge, Node } from '@xyflow/react'

const CENTER_X = 0
const CENTER_Y = 0
// Onion Architecture Radii
const ENTITY_RADIUS = 250
const USECASE_RADIUS = 400
const PORT_RADIUS = 600
const ADAPTER_RADIUS = 800
const APP_RADIUS = 1000

// Helper interfaces to strict type the config
interface PortConfig {
  name: string
  type: string
}

interface DomainConfig {
  ports?: PortConfig[]
  useCases?: string[]
  entities?: string[]
}

interface AdapterConfig {
  port: string
  engine: string
  driver: string
}

interface ProjectConfig {
  domains: Record<string, DomainConfig>
  adapters: Record<string, AdapterConfig>
  apps: Record<string, unknown>
  project: { name: string }
}

// Cast config to our interface
const typedConfig = (await import('virtual:kompo-config')).default as ProjectConfig

// Helper to get handles based on angle from center
function getHandles(angle: number) {
  let theta = angle % (2 * Math.PI)
  if (theta > Math.PI) theta -= 2 * Math.PI
  if (theta <= -Math.PI) theta += 2 * Math.PI

  if (theta > -Math.PI / 4 && theta <= Math.PI / 4) {
    // Right
    return { inner: 'left', outer: 'right' }
  } else if (theta > Math.PI / 4 && theta <= (3 * Math.PI) / 4) {
    // Bottom
    return { inner: 'top', outer: 'bottom' }
  } else if (theta > (-3 * Math.PI) / 4 && theta <= -Math.PI / 4) {
    // Top
    return { inner: 'bottom', outer: 'top' }
  } else {
    // Left
    return { inner: 'right', outer: 'left' }
  }
}

export function getGraphData() {
  const nodes: Node[] = []
  const edges: Edge[] = []

  // 0. Process Domains
  const domainKeys = Object.keys(typedConfig.domains || {})
  const domainAngleStep = (2 * Math.PI) / (domainKeys.length || 1)

  domainKeys.forEach((domainName, dIndex) => {
    // For single domain, keep it centered.
    const dAngle = dIndex * domainAngleStep
    const dX = domainKeys.length > 1 ? CENTER_X + 2000 * Math.cos(dAngle) : CENTER_X
    const dY = domainKeys.length > 1 ? CENTER_Y + 2000 * Math.sin(dAngle) : CENTER_Y

    // Domain Node (Center)
    nodes.push({
      id: `domain-${domainName}`,
      type: 'hexagon',
      position: { x: dX, y: dY },
      data: {
        label: domainName,
        subLabel: 'Domain',
        icon: 'Package',
      },
    })

    const domain = typedConfig.domains[domainName]

    // 1. Entities (Inner Ring)
    const entities = (domain.entities || []).map((en: string) => ({ name: en, type: 'entity' }))
    const entityStep = (2 * Math.PI) / (entities.length || 1)

    entities.forEach((entity: { name: string; type: string }, i: number) => {
      const angle = i * entityStep
      const x = dX + ENTITY_RADIUS * Math.cos(angle)
      const y = dY + ENTITY_RADIUS * Math.sin(angle)
      const id = `${domainName}-entity-${entity.name}`
      const handles = getHandles(angle)

      nodes.push({
        id,
        type: 'circle',
        position: { x, y },
        data: {
          label: entity.name,
          subLabel: 'Entity',
          icon: 'Box',
        },
      })

      // Domain -> Entity
      // Domain source handle should face the Entity.
      const domainHandle = getHandles(angle).outer

      edges.push({
        id: `edge-${domainName}-${id}`,
        source: `domain-${domainName}`,
        target: id,
        sourceHandle: domainHandle,
        targetHandle: `${handles.inner}-target`,
        animated: false,
        style: { stroke: '#ccc', strokeWidth: 1 },
      })
    })

    // 2. Use Cases (Middle Ring 1)
    const useCases = (domain.useCases || []).map((uc: string) => ({ name: uc, type: 'use-case' }))
    const ucStep = (2 * Math.PI) / (useCases.length || 1)

    useCases.forEach((uc: { name: string; type: string }, i: number) => {
      // Offset angle to stagger
      const angle = i * ucStep + Math.PI / (useCases.length || 1)
      const x = dX + USECASE_RADIUS * Math.cos(angle)
      const y = dY + USECASE_RADIUS * Math.sin(angle)
      const id = `${domainName}-usecase-${uc.name}`
      const handles = getHandles(angle)

      nodes.push({
        id,
        type: 'circle',
        position: { x, y },
        data: {
          label: uc.name,
          subLabel: 'Use Case',
          icon: 'Zap',
        },
      })

      // Domain -> Use Case
      const domainHandle = getHandles(angle).outer

      edges.push({
        id: `edge-${domainName}-${id}`,
        source: `domain-${domainName}`,
        target: id,
        sourceHandle: domainHandle,
        targetHandle: `${handles.inner}-target`,
        animated: false,
        style: { stroke: '#ccc', strokeWidth: 1 },
      })
    })

    // 3. Ports (Middle Ring 2)
    const ports = domain.ports || []
    const portStep = (2 * Math.PI) / (ports.length || 1)

    ports.forEach((port: PortConfig, pIndex: number) => {
      const angle = pIndex * portStep
      const x = dX + PORT_RADIUS * Math.cos(angle)
      const y = dY + PORT_RADIUS * Math.sin(angle)
      const portId = `port-${domainName}-${port.name}`
      const handles = getHandles(angle)

      nodes.push({
        id: portId,
        type: 'box',
        position: { x, y },
        style: { width: 160 },
        data: {
          label: port.name,
          subLabel: 'Port',
          // No custom colors, use default theme
        },
      })

      // Domain -> Port (Defines)
      // Domain source handle should face the Port.
      const domainHandle = getHandles(angle).outer

      edges.push({
        id: `edge-domain-${portId}`,
        source: `domain-${domainName}`,
        target: portId,
        sourceHandle: domainHandle,
        targetHandle: `${handles.inner}-target`,
        label: 'defines',
        animated: true,
        style: { stroke: '#666', strokeWidth: 2 },
      })

      // Heuristic: Link Entity to Port if names match
      // e.g. Entity "user" <-> Port "user-repository"
      entities.forEach((entity: { name: string; type: string }) => {
        if (port.name.includes(entity.name)) {
          edges.push({
            id: `edge-entity-${entity.name}-${portId}`,
            source: `${domainName}-entity-${entity.name}`,
            target: portId,
            targetHandle: `${handles.inner}-target`,
            label: 'related',
            style: { strokeDasharray: '5,5', stroke: '#888', strokeWidth: 2 },
          })
        }
      })

      // 4. Adapters (Outer Ring 1)
      const adapters = Object.entries(typedConfig.adapters || {})
        .filter((entry) => entry[1].port === port.name)
        .map(([name, data]) => ({ name, ...data }))

      adapters.forEach((adapter, aIndex) => {
        const spread = 0.3 // small spread for multiple adapters
        const baseAngle = angle
        const aAngle = baseAngle + (aIndex - (adapters.length - 1) / 2) * spread

        const aX = dX + ADAPTER_RADIUS * Math.cos(aAngle)
        const aY = dY + ADAPTER_RADIUS * Math.sin(aAngle)
        const adapterId = `adapter-${adapter.name}`
        const adapterHandles = getHandles(aAngle)

        nodes.push({
          id: adapterId,
          type: 'box',
          position: { x: aX, y: aY },
          style: { width: 200, borderStyle: 'dashed' },
          data: {
            label: adapter.name,
            subLabel: `${adapter.engine} / ${adapter.driver}`,
          },
        })

        // Adapter -> Port
        edges.push({
          id: `edge-${adapterId}-${portId}`,
          source: adapterId,
          target: portId,
          sourceHandle: adapterHandles.inner,
          targetHandle: `${handles.outer}-target`,
          label: 'implements',
          animated: true,
          style: { stroke: '#666', strokeWidth: 2, strokeDasharray: '5,5' },
        })
      })
    })
  })

  // 5. Apps (Outer Orbit)
  const appKeys = Object.keys(typedConfig.apps || {})
  const appStep = (2 * Math.PI) / (appKeys.length || 1)

  appKeys.forEach((appKey, aIndex) => {
    // Position apps far out
    const angle = aIndex * appStep - Math.PI / 2
    const x = CENTER_X + APP_RADIUS * Math.cos(angle)
    const y = CENTER_Y + APP_RADIUS * Math.sin(angle)
    const appLabel = appKey.split('/').pop() || appKey
    const handles = getHandles(angle)

    nodes.push({
      id: appKey,
      type: 'circle',
      position: { x, y },
      style: { width: 100, height: 100 },
      data: {
        label: appLabel,
        subLabel: 'App',
        icon: 'AppWindow',
      },
    })

    // Connect to closest Domain
    if (domainKeys.length > 0) {
      // Calculate target handle on the domain based on the angle
      // The app is at `angle`. The domain needs to accept connection from that angle.
      // So domain target handle is `getHandles(angle).outer` (because outer is facing out, towards app).
      const domainHandle = getHandles(angle).outer

      edges.push({
        id: `edge-${appKey}-domain`,
        source: appKey,
        target: `domain-${domainKeys[0]}`,
        sourceHandle: handles.inner,
        targetHandle: `${domainHandle}-target`,
        label: 'uses',
        animated: true,
        style: { stroke: '#666', strokeWidth: 2 },
      })
    }
  })

  return { nodes, edges }
}
