import { Handle, type Node, type NodeProps, Position } from '@xyflow/react'
import * as Icons from 'lucide-react'

interface HexagonNodeData extends Record<string, unknown> {
  label: string
  subLabel?: string
  icon?: string
}

type HexagonNode = Node<HexagonNodeData>

export function HexagonNode({ data }: NodeProps<HexagonNode>) {
  // @ts-expect-error - Dynamic icon access
  const Icon = data.icon && Icons[data.icon] ? Icons[data.icon] : null

  return (
    <div className="relative flex items-center justify-center w-24 h-24 group">
      <svg
        viewBox="0 0 100 100"
        className="absolute inset-0 w-full h-full text-primary transition-all duration-300 drop-shadow-md group-hover:drop-shadow-xl"
      >
        <polygon
          points="50 0, 95 25, 95 75, 50 100, 5 75, 5 25"
          className="fill-background stroke-primary stroke-2 transition-colors"
        />
      </svg>

      <div className="z-10 flex flex-col items-center justify-center p-2 text-center">
        {Icon && <Icon className="w-5 h-5 mb-1 text-primary" />}
        <span className="font-bold text-foreground text-xs tracking-tight line-clamp-2">
          {data.label}
        </span>
        <span className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wider font-semibold">
          Domain
        </span>
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
