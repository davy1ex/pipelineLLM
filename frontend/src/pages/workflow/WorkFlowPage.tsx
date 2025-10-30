import { useEffect, useState } from 'react'
import { CanvasFrame, useWorkflowStore, getInitialNodes, getInitialEdges } from '../../features/canvas'
import { useWorkflowStore as getWorkflowStore } from '../../features/canvas/model/workflowStore'
import { Toolbar } from '../../widgets/toolbar'
import { PropertyPanel } from '../../widgets/property-panel'
import { NodeActionsProvider } from '../../features/canvas/ui/NodeActionsContext'
import { Header } from '../../widgets/header'
import { LogExecution } from '../../features/workflow-execution'
import { runWorkflow } from '../../features/workflow-execution/lib/runWorkflow'
import { exportWorkflow, parseWorkflowFile } from '../../features/canvas/lib/workflowIO'
import { useExecutionStore } from '../../features/workflow-execution/model/executionStore'

export const WorkFlowPage = () => {
    const setNodes = useWorkflowStore((state) => state.setNodes)
    const setEdges = useWorkflowStore((state) => state.setEdges)
    const loadFromStorage = useWorkflowStore((state) => state.loadFromStorage)
    const nodes = useWorkflowStore((state) => state.nodes)
    const edges = useWorkflowStore((state) => state.edges)
    const [isRunning, setIsRunning] = useState(false)
    const [isLoaded, setIsLoaded] = useState(false)
    const logExecution = useExecutionStore((state) => state.logExecution)

    useEffect(() => {
        // Load from localStorage on mount (state is already loaded in store initialization, but we check)
        if (!isLoaded) {
            console.log('[WorkFlowPage] Initial load check, current nodes/edges:', nodes.length, edges.length)
            const loaded = loadFromStorage()
            setIsLoaded(true)
            
            // If nothing was loaded and store is empty, initialize with demo data
            if (!loaded && nodes.length === 0 && edges.length === 0) {
                console.log('[WorkFlowPage] No stored data, initializing with demo workflow')
                setNodes(getInitialNodes())
                setEdges(getInitialEdges())
            } else {
                console.log('[WorkFlowPage] Using existing state or loaded from storage')
            }
            return
        }
    }, [isLoaded, loadFromStorage, nodes.length, edges.length, setNodes, setEdges])

    // Provide node actions context for PropertyPanel and nodes
    const updateNodeData = (nodeId: string, patch: Record<string, unknown>) => {
        console.log(`[WorkFlowPage] updateNodeData called for node ${nodeId}:`, patch)
        
        // Get current state directly from store to ensure we have latest
        const currentNodes = getWorkflowStore.getState().nodes;
        const nodeIndex = currentNodes.findIndex((n) => n.id === nodeId);
        
        if (nodeIndex === -1) {
            console.warn(`[WorkFlowPage] Node ${nodeId} not found! Current nodes:`, currentNodes.map(n => n.id));
            return;
        }
        
        const node = currentNodes[nodeIndex];
        const updatedData = { ...(node.data as any), ...patch };
        const updatedNode = { ...node, data: updatedData };
        
        console.log(`[WorkFlowPage] Node ${nodeId} data updated:`, {
            old: node.data,
            new: updatedData,
            hasText: !!(updatedData as any)?.text,
            textLength: (updatedData as any)?.text?.length || 0,
        });
        
        const newNodes = [...currentNodes];
        newNodes[nodeIndex] = updatedNode;
        
        // Update store
        setNodes(newNodes);
        
        // Verify immediately in next tick
        setTimeout(() => {
            const verifyNodes = getWorkflowStore.getState().nodes;
            const verifyNode = verifyNodes.find((n) => n.id === nodeId);
            const text = (verifyNode?.data as any)?.text || '';
            console.log(`[WorkFlowPage] ✅ Verified node ${nodeId} after update:`, {
                found: !!verifyNode,
                hasText: !!text,
                textLength: text.length,
                textPreview: text.slice(0, 100),
            });
        }, 50);
    }

    const getIncomingData = (nodeId: string, targetHandleId?: string): Record<string, unknown> | undefined => {
        const incoming = edges.find((e) => e.target === nodeId && (targetHandleId ? e.targetHandle === targetHandleId : true))
        if (!incoming) return undefined
        const src = nodes.find((n) => n.id === incoming.source)
        return (src?.data as any) as Record<string, unknown> | undefined
    }

    const handleRun = async () => {
        if (isRunning) return
        setIsRunning(true)
        try {
            await runWorkflow({
                nodes,
                edges,
                updateNodeData,
                getCurrentNodes: () => getWorkflowStore.getState().nodes,
                verbose: true,
            })
        } catch (error) {
            console.error('Workflow execution error:', error)
            alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
        } finally {
            setIsRunning(false)
        }
    }

    const handleExport = () => {
        exportWorkflow(nodes, edges)
    };

    const handleImport = async (file: File) => {
        try {
            const wf = await parseWorkflowFile(file)
            console.log('[WorkFlowPage] Importing workflow:', {
                nodes: wf.nodes.length,
                edges: wf.edges.length,
                version: wf.version,
            })
            setNodes(wf.nodes)
            setEdges(wf.edges)
        } catch (e) {
            console.error('Failed to import workflow:', e)
            alert(`Failed to import workflow: ${e instanceof Error ? e.message : String(e)}`)
        }
    };

    return (
        <div style={{ height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <Header handleStart={handleRun} isRunning={isRunning} onExport={handleExport} onImport={handleImport} />
            <NodeActionsProvider value={{ updateNodeData, getIncomingData }}>
                <div style={{ position: 'relative', width: '100%', flex: 1, overflow: 'hidden' }}>
                    <CanvasFrame />
                    <Toolbar />
                    <PropertyPanel />
                </div>
            </NodeActionsProvider>
            <LogExecution logExecution={logExecution} />
        </div>
    )
}