import type { Node } from '@xyflow/react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

interface NodeDetailsProps {
  node: Node | null
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

export function NodeDetails({ node, isOpen, onOpenChange }: NodeDetailsProps) {
  if (!node) return null

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">{node.data?.label as string}</SheetTitle>
          <SheetDescription>{node.data?.subLabel as string}</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Placeholder sections for Use Cases, Ports, Entities */}

          <div>
            <h3 className="text-sm font-medium mb-2 text-primary">Use Cases</h3>
            <div className="text-sm text-muted-foreground p-3 border rounded-md bg-muted/20">
              No use cases defined.
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-2 text-primary">Entities</h3>
            <div className="text-sm text-muted-foreground p-3 border rounded-md bg-muted/20">
              No entities defined.
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-2 text-primary">Ports</h3>
            <div className="text-sm text-muted-foreground p-3 border rounded-md bg-muted/20">
              No ports defined.
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-2 text-primary">Node Data</h3>
            <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-40">
              {JSON.stringify(node.data, null, 2)}
            </pre>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
