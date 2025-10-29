import { useEffect } from 'react'
import { CanvasFrame, useWorkflowStore, getInitialNodes, getInitialEdges } from '../../features/canvas'
import { Toolbar } from '../../widgets/toolbar'
import { PropertyPanel } from '../../widgets/property-panel'
import { NodeActionsProvider } from '../../features/canvas/ui/NodeActionsContext'

export const WorkFlowPage = () => {
    const setNodes = useWorkflowStore((state) => state.setNodes)
    const setEdges = useWorkflowStore((state) => state.setEdges)
    const nodes = useWorkflowStore((state) => state.nodes)
    const edges = useWorkflowStore((state) => state.edges)

    useEffect(() => {
        // Initialize with demo workflow only if empty
        if (nodes.length === 0) {
            setNodes(getInitialNodes())
            setEdges(getInitialEdges())
        }
    }, [])

    // Provide node actions context for PropertyPanel and nodes
    const updateNodeData = (nodeId: string, patch: Record<string, unknown>) => {
        setNodes(nodes.map((n) => (n.id === nodeId ? { ...n, data: { ...(n.data as any), ...patch } } : n)))
    }

    const getIncomingData = (nodeId: string, targetHandleId?: string): Record<string, unknown> | undefined => {
        const incoming = edges.find((e) => e.target === nodeId && (targetHandleId ? e.targetHandle === targetHandleId : true))
        if (!incoming) return undefined
        const src = nodes.find((n) => n.id === incoming.source)
        return (src?.data as any) as Record<string, unknown> | undefined
    }

    return (
        <NodeActionsProvider value={{ updateNodeData, getIncomingData }}>
            <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
                <CanvasFrame />
                <Toolbar />
                <PropertyPanel />
            </div>
        </NodeActionsProvider>
    )
}