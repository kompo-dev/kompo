import { Handle, type Node, type NodeProps, Position } from '@xyflow/react'
import * as Icons from 'lucide-react'

export interface CircleNodeData extends Record<string, unknown> {
  label: string
  subLabel?: string
  icon?: string
}

export type CircleNode = Node<CircleNodeData>

export function CircleNode({ data }: NodeProps<CircleNode>) {
  // @ts-expect-error - Dynamic icon access
  const Icon = data.icon && Icons[data.icon] ? Icons[data.icon] : null

  return (
    <div className="relative flex flex-col items-center justify-center w-24 h-24 bg-card border-2 border-primary rounded-full shadow-md transition-all hover:shadow-xl hover:scale-105">
      <div className="flex flex-col items-center justify-center text-center p-2 z-10">
        {Icon && <Icon className="w-5 h-5 mb-1 text-primary" />}
        <span className="font-bold text-card-foreground text-xs">{data.label}</span>
        {data.subLabel && (
          <span className="text-[10px] text-muted-foreground">{data.subLabel}</span>
        )}
      </div>

      <Handle type="source" position={Position.Top} id="top" className="w-1! h-1! opacity-0" />
      <Handle
        type="target"
        position={Position.Top}
        id="top-target"
        className="w-1! h-1! opacity-0"
      />

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
