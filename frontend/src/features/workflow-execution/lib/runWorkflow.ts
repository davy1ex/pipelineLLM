import type { Node, Edge } from '@xyflow/react'
import { runWorkflowBackend } from './runWorkflowBackend'

export interface RunWorkflowDeps {
  nodes: Node[]
  edges: Edge[]
  // Called to update node data in the host app (store/page)
  updateNodeData: (nodeId: string, patch: Record<string, unknown>) => void
  // Optional getter to read latest nodes for logging/verification
  getCurrentNodes?: () => Node[]
  // Optional logging toggle
  verbose?: boolean
  // Optional global defaults for Ollama connection (legacy - no longer used, kept for compatibility)
  defaultUrl?: string
  defaultModel?: string
  // Polling interval in milliseconds (default: 500ms)
  pollInterval?: number
  // Maximum polling duration in milliseconds (default: 5 minutes)
  maxPollDuration?: number
}

/**
 * Orchestrates a workflow execution via backend with polling for progress.
 * 
 * This is now a wrapper around runWorkflowBackend for backward compatibility.
 */
export async function runWorkflow({
  nodes,
  edges,
  updateNodeData,
  getCurrentNodes,
  verbose = true,
  pollInterval,
  maxPollDuration,
}: RunWorkflowDeps) {
  // Delegate to backend-driven execution
  return await runWorkflowBackend({
    nodes,
    edges,
    updateNodeData,
    getCurrentNodes,
    verbose,
    pollInterval,
    maxPollDuration,
  })
}


