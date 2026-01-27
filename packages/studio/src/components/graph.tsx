import {
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  BackgroundVariant,
  Controls,
  type Edge,
  type EdgeChange,
  MiniMap,
  type Node,
  type NodeChange,
  ReactFlow,
} from '@xyflow/react'
import { useCallback, useMemo, useState } from 'react'
import '@xyflow/react/dist/style.css'

import { getGraphData } from '../lib/graph-utils'
import { BoxNode } from './BoxNode'
import { CircleNode } from './CircleNode'
import { HexagonNode } from './HexagonNode'
import { NodeDetails } from './NodeDetails'
import { useTheme } from './theme-context'

const nodeTypes = {
  hexagon: HexagonNode,
  circle: CircleNode,
  box: BoxNode,
}

export function Graph() {
  const { theme } = useTheme()
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const [showMiniMap, setShowMiniMap] = useState(true)

  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    try {
      console.log('Graph: getting data...')
      return getGraphData()
    } catch (err) {
      console.error('Graph: Error getting data', err)
      return { nodes: [], edges: [] }
    }
  }, [])

  const [nodes, setNodes] = useState<Node[]>(initialNodes)
  const [edges, setEdges] = useState<Edge[]>(initialEdges)

  const onNodesChange = useCallback(
    (changes: NodeChange[]) =>
      setNodes((nodesSnapshot) => applyNodeChanges(changes, nodesSnapshot)),
    []
  )
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) =>
      setEdges((edgesSnapshot) => applyEdgeChanges(changes, edgesSnapshot)),
    []
  )

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node)
  }, [])

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        nodesConnectable={false}
        colorMode={theme}
        proOptions={{ hideAttribution: true }}
        style={{ backgroundColor: 'transparent' }}
        fitView
        fitViewOptions={{ padding: 0.1 }}
      >
        <Controls />
        {showMiniMap && <MiniMap style={{ bottom: 10, right: 10 }} />}
        <Background
          variant={BackgroundVariant.Dots}
          gap={12}
          size={1}
          style={{ backgroundColor: 'transparent' }}
        />
      </ReactFlow>

      {/* MiniMap Toggle Button */}
      <button
        onClick={() => setShowMiniMap(!showMiniMap)}
        className="absolute bottom-5 right-5 z-50 bg-background border border-border p-2 rounded-md shadow-md hover:bg-muted text-xs font-medium"
        title="Toggle MiniMap"
      >
        {showMiniMap ? 'Hide Map' : 'Show Map'}
      </button>

      <NodeDetails
        node={selectedNode}
        isOpen={!!selectedNode}
        onOpenChange={(open) => !open && setSelectedNode(null)}
      />
    </div>
  )
}
