import { useEffect, useState } from 'react'
import { CanvasFrame, useWorkflowStore, getInitialNodes, getInitialEdges } from '../../features/canvas'
import { useWorkflowStore as getWorkflowStore } from '../../features/canvas/model/workflowStore'
import { Toolbar } from '../../widgets/toolbar'
import { PropertyPanel } from '../../widgets/property-panel'
import { NodeActionsProvider } from '../../features/canvas/ui/NodeActionsContext'
import { Header } from '../../widgets/header'
import { executeWorkflow } from '../../features/workflow-execution'
import { exportWorkflow, parseWorkflowFile } from '../../features/canvas/lib/workflowIO'

export const WorkFlowPage = () => {
    const setNodes = useWorkflowStore((state) => state.setNodes)
    const setEdges = useWorkflowStore((state) => state.setEdges)
    const loadFromStorage = useWorkflowStore((state) => state.loadFromStorage)
    const nodes = useWorkflowStore((state) => state.nodes)
    const edges = useWorkflowStore((state) => state.edges)
    const [isRunning, setIsRunning] = useState(false)
    const [isLoaded, setIsLoaded] = useState(false)

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

        try {
            console.log('[WorkFlowPage] Starting workflow execution...')
            console.log('[WorkFlowPage] Current nodes:', nodes.map(n => ({ id: n.id, type: n.type })))
            console.log('[WorkFlowPage] Current edges:', edges.map(e => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle, targetHandle: e.targetHandle })))
            
            setIsRunning(true)
            const result = await executeWorkflow({ nodes, edges })
            
            console.log('[WorkFlowPage] Execution result:', {
                hasNodeResults: !!result.nodeResults,
                hasOutputUpdates: !!result.outputUpdates,
                outputNodeId: result.outputNodeId,
            })
            
            // Update all Ollama nodes with their results
            if (result.nodeResults) {
                const nodeResults = result.nodeResults as Record<string, string>
                console.log('[WorkFlowPage] Updating Ollama nodes:', Object.keys(nodeResults))
                Object.entries(nodeResults).forEach(([nodeId, response]) => {
                    console.log(`[WorkFlowPage] Updating Ollama node ${nodeId} with response (${response.length} chars)`)
                    updateNodeData(nodeId, {
                        lastResponse: response,
                    })
                })
            }
            
            // Update all Output nodes connected to Ollama nodes
            if (result.outputUpdates) {
                const outputUpdates = result.outputUpdates as Record<string, string>
                console.log('[WorkFlowPage] Updating Output nodes:', Object.keys(outputUpdates))
                Object.entries(outputUpdates).forEach(([outputNodeId, response]) => {
                    console.log(`[WorkFlowPage] Updating Output node ${outputNodeId} with text: "${response.slice(0, 100)}..." (${response.length} chars)`)
                    const outputNode = nodes.find(n => n.id === outputNodeId)
                    console.log(`[WorkFlowPage] Output node found:`, !!outputNode, outputNode ? { id: outputNode.id, type: outputNode.type, currentData: outputNode.data } : null)
                    
                    updateNodeData(outputNodeId, {
                        text: response,
                    })
                    
                    // Verify update - get fresh state from store
                    setTimeout(() => {
                        const freshNodes = getWorkflowStore.getState().nodes;
                        const updatedNode = freshNodes.find(n => n.id === outputNodeId);
                        const text = (updatedNode?.data as any)?.text || '';
                        console.log(`[WorkFlowPage] After update, Output node ${outputNodeId}:`, {
                            found: !!updatedNode,
                            textLength: text.length,
                            textPreview: text.slice(0, 50),
                        });
                    }, 100)
                })
            } else if (result.outputNodeId) {
                // Fallback: update single output node with final response
                console.log('[WorkFlowPage] Fallback: updating single output node', result.outputNodeId)
                updateNodeData(result.outputNodeId as string, {
                    text: result.ollamaResponse,
                })
            } else {
                // If no output node connected, find any output node or show alert
                const outputNode = nodes.find((n) => n.type === 'output')
                if (outputNode) {
                    console.log('[WorkFlowPage] No outputUpdates, updating any output node:', outputNode.id)
                    updateNodeData(outputNode.id, {
                        text: result.ollamaResponse,
                    })
                } else {
                    console.warn('[WorkFlowPage] No output node found, showing alert')
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
        </div>
    )
}