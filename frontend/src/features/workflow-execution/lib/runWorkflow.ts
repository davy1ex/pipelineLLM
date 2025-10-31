import type { Node, Edge } from '@xyflow/react'
import { executeWorkflow } from './executeWorkflow'
import { useExecutionStore } from '../model/executionStore'

export interface RunWorkflowDeps {
  nodes: Node[]
  edges: Edge[]
  // Called to update node data in the host app (store/page)
  updateNodeData: (nodeId: string, patch: Record<string, unknown>) => void
  // Optional getter to read latest nodes for logging/verification
  getCurrentNodes?: () => Node[]
  // Optional logging toggle
  verbose?: boolean
  // Optional global defaults for Ollama connection
  defaultUrl?: string
  defaultModel?: string
}

/**
 * Orchestrates a workflow execution and applies results via callbacks.
 */
export async function runWorkflow({ nodes, edges, updateNodeData, getCurrentNodes, verbose = true, defaultUrl, defaultModel }: RunWorkflowDeps) {
  if (verbose) {
    useExecutionStore.getState().setLogExecution([...useExecutionStore.getState().logExecution, '[runWorkflow] Starting...'])
    console.log('[runWorkflow] Starting...', {
      nodes: nodes.map(n => ({ id: n.id, type: n.type })),
      edges: edges.map(e => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle, targetHandle: e.targetHandle })),
    })
  }

  const result = await executeWorkflow(
    { nodes, edges },
    {
      defaultUrl,
      defaultModel,
      onNodeDone: ({ node, response, outputTargetIds }) => {
        // Update node with its own response right away
        if (node.type === 'ollama') {
          updateNodeData(node.id, { lastResponse: response });
        } else if (node.type === 'python') {
          updateNodeData(node.id, { output: response });
        }

        // Update connected Output nodes immediately
        for (const targetId of outputTargetIds) {
          updateNodeData(targetId, { text: response })

          if (getCurrentNodes && verbose) {
            setTimeout(() => {
              const current = getCurrentNodes()
              const updated = current.find(n => n.id === targetId)
              const text = (updated?.data as any)?.text || ''
              console.log(`[runWorkflow] (incremental) ✅ ${targetId}:`, { len: text.length, preview: text.slice(0, 80) })
            }, 25)
          }
        }

        if (verbose) {
          console.log(`[runWorkflow] (incremental) node done: ${node.id}, outputs: ${outputTargetIds.length}`)
        }
      },
    }
  )

  if (verbose) {
    console.log('[runWorkflow] Result:', {
      hasNodeResults: !!result.nodeResults,
      hasOutputUpdates: !!result.outputUpdates,
      outputNodeId: result.outputNodeId,
    })
  }

  // Apply Ollama node results (store lastResponse)
  if (result.nodeResults) {
    const nodeResults = result.nodeResults as Record<string, string>
    if (verbose) console.log('[runWorkflow] Applying Ollama node results:', Object.keys(nodeResults))
    Object.entries(nodeResults).forEach(([nodeId, response]) => {
      if (verbose) console.log(`[runWorkflow] → set lastResponse for ${nodeId} (${response.length} chars)`) 
      updateNodeData(nodeId, { lastResponse: response })
    })
  }

  // Apply Output node updates
  if (result.outputUpdates) {
    const outputUpdates = result.outputUpdates as Record<string, string>
    if (verbose) console.log('[runWorkflow] Applying Output updates:', Object.keys(outputUpdates))
    Object.entries(outputUpdates).forEach(([outputNodeId, response]) => {
      if (verbose) console.log(`[runWorkflow] → set text for ${outputNodeId} (${response.length} chars)`) 
      updateNodeData(outputNodeId, { text: response })

      // Optional verification
      if (getCurrentNodes) {
        setTimeout(() => {
          const current = getCurrentNodes()
          const updated = current.find(n => n.id === outputNodeId)
          const text = (updated?.data as any)?.text || ''
          if (verbose) console.log(`[runWorkflow] ✅ Verified ${outputNodeId}:`, { len: text.length, preview: text.slice(0, 80) })
        }, 50)
      }
    })
  } else if (result.outputNodeId) {
    // Fallback: update single output node with final response
    if (verbose) console.log('[runWorkflow] Fallback single output update:', result.outputNodeId)
    updateNodeData(result.outputNodeId as string, { text: result.ollamaResponse as string })
  }

  return result
}


