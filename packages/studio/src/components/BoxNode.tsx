import { Handle, type Node, type NodeProps, Position } from '@xyflow/react'
import * as Icons from 'lucide-react'

export interface BoxNodeData extends Record<string, unknown> {
  label: string
  subLabel?: string
  icon?: string
  // Visual overrides
  backgroundColor?: string
  borderColor?: string
}

export type BoxNode = Node<BoxNodeData>

export function BoxNode({ data }: NodeProps<BoxNode>) {
  // @ts-expect-error - Dynamic icon access
  const Icon = data.icon && Icons[data.icon] ? Icons[data.icon] : null

  return (
    <div
      className="relative flex flex-col items-center justify-center p-4 min-w-[150px] bg-card border-2 border-primary rounded-md shadow-md transition-all hover:shadow-xl hover:scale-105"
      style={{
        backgroundColor: (data.backgroundColor as string) || undefined,
        borderColor: (data.borderColor as string) || undefined,
      }}
    >
      <div className="flex flex-col items-center justify-center text-center z-10">
        {Icon && <Icon className="w-5 h-5 mb-1 text-primary" />}
        <span className="font-bold text-card-foreground text-xs">{data.label}</span>
        {data.subLabel && (
          <span className="text-[10px] text-muted-foreground">{data.subLabel}</span>
        )}
      </div>

      {/* Handles allow full connectivity */}
      <Handle
        type="target"
        position={Position.Bottom}
        id="bottom"
        className="w-1! h-1! opacity-0"
        isConnectable={true}
      />
      <Handle
        type="target"
        position={Position.Right}
        id="right"
        className="w-1! h-1! opacity-0"
        isConnectable={true}
      />
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        className="w-1! h-1! opacity-0"
        isConnectable={true}
      />
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className="w-1! h-1! opacity-0"
        isConnectable={true}
      />

      {/* We use 'target' for all since we just need connection points. Source vs Target distinction matters for Edge flow but handles can be generic if we allow multiple inputs/outputs. 
          Actually, CircleNode used 'source' for all. Let's use 'source' to match pattern or both?
          React Flow standard: Source connects to Target. 
          If we want to connect Domain -> Port -> Adapter:
          Domain (Source) -> Port (Target)
          Adapter (Source) -> Port (Target) OR Adapter (Target) <- Port (Source)?
          
          User said: "connect to one side... use the other side for adapters"
          
          Let's just use 'source' type for all handles to be permissible, or mixed? 
          CircleNode used type="source". Let's stick to that to avoid "handle not found" errors if edges originate from here.
          But if edges target here, we need type="target".
          
          Safe bet: two handles per position? Or type="source" handles accept incoming edges in some versions? No.
          
          Let's add BOTH source and target handles at same position? Or just "source" and rely on valid handles?
          Actually, CircleNode had `isConnectable={false}`? That's weird. 
          
          CircleNode in Step 120 had:
          <Handle type="source" ... isConnectable={false} />
          
          If isConnectable is false, you can't drag FROM it, but can you connect TO it programmatically? Yes.
          
          I'll add "target" handles too just in case, or just "source" if that worked for everything.
          The edges in graph-utils were:
            App (Circle) -> Domain (Hexagon)
            source: App (Circle). edge sourceHandle="inner".
            
          So CircleNode needed "source" handles.
          
          For Ports:
             Domain -> Port
             Port is Target. So Port needs "target" handles?
             
             Adapter -> Port
             Port is Target. So Port needs "target" handles?
             Adapter is Source. Adapter needs "source" handles?
             
          So BoxNode (used for Ports and Adapters) should probably have both or just the right ones.
          I'll add BOTH for maximum flexibility (stacked on top of each other).
      */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className="w-1! h-1! opacity-0"
      />
      <Handle
        type="target"
        position={Position.Bottom}
        id="bottom-target"
        className="w-1! h-1! opacity-0"
      />

      <Handle type="source" position={Position.Right} id="right" className="w-1! h-1! opacity-0" />
      <Handle
        type="target"
        position={Position.Right}
        id="right-target"
        className="w-1! h-1! opacity-0"
      />

      <Handle type="source" position={Position.Top} id="top" className="w-1! h-1! opacity-0" />
      <Handle
        type="target"
        position={Position.Top}
        id="top-target"
        className="w-1! h-1! opacity-0"
      />

      <Handle type="source" position={Position.Left} id="left" className="w-1! h-1! opacity-0" />
      <Handle
        type="target"
        position={Position.Left}
        id="left-target"
        className="w-1! h-1! opacity-0"
      />
    </div>
  )
}
