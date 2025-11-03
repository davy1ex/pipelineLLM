/**
 * Simplified runWorkflow using backend execution engine with polling.
 * 
 * This replaces the frontend-based execution with backend-driven execution.
 */

import type { Node, Edge } from '@xyflow/react'
import { useExecutionStore } from '../model/executionStore'
import { enqueueWorkflow, getWorkflowStatus, type WorkflowStatusResponse } from '../../../shared/api/workflow'

export interface RunWorkflowBackendDeps {
  nodes: Node[]
  edges: Edge[]
  // Called to update node data in the host app (store/page)
  updateNodeData: (nodeId: string, patch: Record<string, unknown>) => void
  // Optional getter to read latest nodes for logging/verification
  getCurrentNodes?: () => Node[]
  // Optional logging toggle
  verbose?: boolean
  // Polling interval in milliseconds (default: 500ms)
  pollInterval?: number
  // Maximum polling duration in milliseconds (default: 5 minutes)
  maxPollDuration?: number
}

/**
 * Poll workflow execution status until completion.
 */
async function pollWorkflowStatus(
  queueId: string,
  onProgress: (status: WorkflowStatusResponse) => void,
  pollInterval: number = 500,
  maxDuration: number = 5 * 60 * 1000
): Promise<WorkflowStatusResponse> {
  const startTime = Date.now()
  
  while (true) {
    const elapsed = Date.now() - startTime
    if (elapsed > maxDuration) {
      throw new Error(`Polling timeout after ${maxDuration}ms`)
    }
    
    const status = await getWorkflowStatus(queueId)
    onProgress(status)
    
    if (status.status === 'completed' || status.status === 'failed') {
      return status
    }
    
    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, pollInterval))
  }
}

/**
 * Orchestrates a workflow execution via backend with polling for progress.
 */
export async function runWorkflowBackend({
  nodes,
  edges,
  updateNodeData,
  getCurrentNodes,
  verbose = true,
  pollInterval = 500,
  maxPollDuration = 5 * 60 * 1000,
}: RunWorkflowBackendDeps): Promise<WorkflowStatusResponse> {
  if (verbose) {
    useExecutionStore.getState().setLogExecution([
      ...useExecutionStore.getState().logExecution,
      '[runWorkflowBackend] Starting workflow execution...'
    ])
    console.log('[runWorkflowBackend] Starting...', {
      nodes: nodes.map(n => ({ id: n.id, type: n.type })),
      edges: edges.map(e => ({ id: e.id, source: e.source, target: e.target })),
    })
  }

  // Reset execution state
  useExecutionStore.getState().resetExecution()

  try {
    // Enqueue workflow
    const { queueId } = await enqueueWorkflow({ nodes, edges })
    
    if (verbose) {
      useExecutionStore.getState().setLogExecution([
        ...useExecutionStore.getState().logExecution,
        `[runWorkflowBackend] Workflow enqueued: ${queueId}`
      ])
      console.log(`[runWorkflowBackend] Enqueued workflow: ${queueId}`)
    }

    // Track previous state to detect changes
    let previousRunningNodeIds: Set<string> = new Set()
    let previousCompletedNodeIds: Set<string> = new Set()
    let previousResults: Set<string> = new Set()

    // Poll for status with progress updates
    const finalStatus = await pollWorkflowStatus(
      queueId,
      (status) => {
        // Update execution store
        const currentRunning = new Set(status.runningNodeIds)
        const currentCompleted = new Set(status.completedNodeIds)
        const currentResults = new Set(Object.keys(status.results))

        // Update running nodes
        for (const nodeId of status.runningNodeIds) {
          if (!previousRunningNodeIds.has(nodeId)) {
            useExecutionStore.getState().startNode(nodeId)
            if (verbose) {
              console.log(`[runWorkflowBackend] Node started: ${nodeId}`)
            }
          }
        }

        // Remove nodes that are no longer running
        for (const nodeId of previousRunningNodeIds) {
          if (!currentRunning.has(nodeId)) {
            useExecutionStore.getState().finishNode(nodeId)
            if (verbose) {
              console.log(`[runWorkflowBackend] Node finished: ${nodeId}`)
            }
          }
        }

        // Update completed nodes
        for (const nodeId of status.completedNodeIds) {
          if (!previousCompletedNodeIds.has(nodeId)) {
            useExecutionStore.getState().finishNode(nodeId)
            if (verbose) {
              console.log(`[runWorkflowBackend] Node completed: ${nodeId}`)
            }
          }
        }

        // Update node data with results
        for (const [nodeId, result] of Object.entries(status.results)) {
          if (!previousResults.has(nodeId)) {
            // Update node data based on node type
            const node = nodes.find(n => n.id === nodeId)
            if (node) {
              if (node.type === 'ollama') {
                updateNodeData(nodeId, { 
                  lastResponse: result.output,
                  error: result.error || undefined,
                })
              } else if (node.type === 'python') {
                updateNodeData(nodeId, { 
                  output: result.output,
                  error: result.error || undefined,
                })
              } else {
                // For other nodes, attach generic error if present
                if (result.error) {
                  updateNodeData(nodeId, {
                    error: result.error,
                  })
                }
              }

              // Update connected output nodes
              const connectedEdges = edges.filter(e => e.source === nodeId)
              for (const edge of connectedEdges) {
                const targetNode = nodes.find(n => n.id === edge.target)
                if (targetNode?.type === 'output' || targetNode?.type === 'textInput') {
                  updateNodeData(edge.target, { 
                    text: result.output 
                  })
                }
              }

              // Log per-node status
              if (result.error) {
                useExecutionStore.getState().setLogExecution([
                  ...useExecutionStore.getState().logExecution,
                  `[error] Node ${nodeId} failed: ${result.error}`,
                ])
              } else if (verbose) {
                console.log(`[runWorkflowBackend] Updated node ${nodeId}:`, {
                  outputLength: result.output.length,
                  hasError: !!result.error
                })
              }
            }
          }
        }

        // Update execution log
        if (status.executionLog.length > 0) {
          const newLogEntries = status.executionLog.slice(
            useExecutionStore.getState().logExecution.length
          )
          if (newLogEntries.length > 0) {
            useExecutionStore.getState().setLogExecution([
              ...useExecutionStore.getState().logExecution,
              ...newLogEntries.map(msg => `[backend] ${msg}`)
            ])
          }
        }

        // If backend indicates errors in status flags, log summary
        if ((status as any).hasErrors) {
          const failedNodes = (status as any).failedNodes as string[] | undefined
          if (failedNodes && failedNodes.length > 0) {
            useExecutionStore.getState().setLogExecution([
              ...useExecutionStore.getState().logExecution,
              `[warning] Backend reported failed nodes: ${failedNodes.join(', ')}`,
            ])
          }
        }

        // Update previous state
        previousRunningNodeIds = currentRunning
        previousCompletedNodeIds = currentCompleted
        previousResults = currentResults
      },
      pollInterval,
      maxPollDuration
    )

    // Final state update
    if (finalStatus.status === 'completed') {
      const hasErrors = (finalStatus as any).hasErrors as boolean | undefined
      const failedNodes = (finalStatus as any).failedNodes as string[] | undefined
      useExecutionStore.getState().setLogExecution([
        ...useExecutionStore.getState().logExecution,
        `[runWorkflowBackend] ✅ Execution completed: ${finalStatus.iterations} iterations` ,
        ...(hasErrors && failedNodes && failedNodes.length > 0
          ? [`[warning] Completed with errors. Failed nodes: ${failedNodes.join(', ')}`]
          : []),
      ])
      
      // Mark all nodes as completed
      const allNodeIds = nodes.map(n => n.id)
      useExecutionStore.getState().completeAll(allNodeIds)
      
      if (verbose) {
        console.log('[runWorkflowBackend] ✅ Execution completed', {
          iterations: finalStatus.iterations,
          completedNodes: finalStatus.completedNodeIds.length,
          results: Object.keys(finalStatus.results).length
        })
      }
    } else if (finalStatus.status === 'failed') {
      useExecutionStore.getState().setLogExecution([
        ...useExecutionStore.getState().logExecution,
        `[runWorkflowBackend] ❌ Execution failed: ${finalStatus.error || 'Unknown error'}`
      ])
      
      throw new Error(finalStatus.error || 'Workflow execution failed')
    }

    return finalStatus

  } catch (error) {
    useExecutionStore.getState().setLogExecution([
      ...useExecutionStore.getState().logExecution,
      `[runWorkflowBackend] ❌ Error: ${error instanceof Error ? error.message : String(error)}`
    ])
    
    throw error
  }
}

