import { useEffect, useState } from 'react'
import { CanvasFrame, useWorkflowStore, getInitialNodes, getInitialEdges } from '../../features/canvas'
import { Toolbar } from '../../widgets/toolbar'
import { PropertyPanel } from '../../widgets/property-panel'
import { NodeActionsProvider } from '../../features/canvas/ui/NodeActionsContext'
import { Header } from '../../widgets/header'
import { executeWorkflow } from '../../features/workflow-execution'

export const WorkFlowPage = () => {
    const setNodes = useWorkflowStore((state) => state.setNodes)
    const setEdges = useWorkflowStore((state) => state.setEdges)
    const nodes = useWorkflowStore((state) => state.nodes)
    const edges = useWorkflowStore((state) => state.edges)
    const [isRunning, setIsRunning] = useState(false)

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

    const handleRun = async () => {
        if (isRunning) return

        try {
            setIsRunning(true)
            const result = await executeWorkflow({ nodes, edges })
            
            // Update all Ollama nodes with their results
            if (result.nodeResults) {
                const nodeResults = result.nodeResults as Record<string, string>
                Object.entries(nodeResults).forEach(([nodeId, response]) => {
                    updateNodeData(nodeId, {
                        lastResponse: response,
                    })
                })
            }
            
            // Update all Output nodes connected to Ollama nodes
            if (result.outputUpdates) {
                const outputUpdates = result.outputUpdates as Record<string, string>
                Object.entries(outputUpdates).forEach(([outputNodeId, response]) => {
                    updateNodeData(outputNodeId, {
                        text: response,
                    })
                })
            } else if (result.outputNodeId) {
                // Fallback: update single output node with final response
                updateNodeData(result.outputNodeId as string, {
                    text: result.ollamaResponse,
                })
            } else {
                // If no output node connected, find any output node or show alert
                const outputNode = nodes.find((n) => n.type === 'output')
                if (outputNode) {
                    updateNodeData(outputNode.id, {
                        text: result.ollamaResponse,
                    })
                } else {
                    alert(`Ollama response:\n\n${result.ollamaResponse}`)
                }
            }
        } catch (error) {
            console.error('Workflow execution error:', error)
            alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
        } finally {
            setIsRunning(false)
        }
    }

    return (
        <>
            <Header handleStart={handleRun} isRunning={isRunning} />
            <NodeActionsProvider value={{ updateNodeData, getIncomingData }}>
                <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
                    <CanvasFrame />
                    <Toolbar />
                    <PropertyPanel />
                </div>
            </NodeActionsProvider>
        </>
        
    )
}