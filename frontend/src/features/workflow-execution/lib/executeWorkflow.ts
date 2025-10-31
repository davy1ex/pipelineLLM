import type { Node, Edge } from '@xyflow/react';
import { useExecutionStore } from '../model/executionStore'
import { executePythonPhase } from './phases/pythonPhase'
import { executeOllamaPhase } from './phases/ollamaPhase'

interface WorkflowExecutionContext {
  nodes: Node[];
  edges: Edge[];
}

interface WorkflowExecutionOptions {
  onNodeDone?: (args: { node: Node; response: string; outputTargetIds: string[] }) => void
  defaultUrl?: string
  defaultModel?: string
}

/**
 * Execute workflow - iterative passes: Python → Ollama until no new results.
 */
export async function executeWorkflow(
  context: WorkflowExecutionContext,
  options?: WorkflowExecutionOptions
): Promise<Record<string, unknown>> {
  const { nodes, edges } = context;

  const nodeResults = new Map<string, string>();
  const outputUpdates = new Map<string, string>();

  // Iterate passes to allow downstream triggers (e.g., Python waiting for Ollama)
  let progress = true
  let lastResultsCount = -1
  let lastExecutionOrder: Node[] = []
  let lastPythonOrder: Node[] = []

  while (progress) {
    progress = false

    // Python phase (skip already executed)
    const pyPhase = await executePythonPhase(nodes, edges, nodeResults, options?.onNodeDone)
    // Merge results
    for (const [k, v] of pyPhase.nodeResults) {
      if (!nodeResults.has(k)) { nodeResults.set(k, v); progress = true }
    }
    for (const [k, v] of pyPhase.outputUpdates) outputUpdates.set(k, v)
    lastPythonOrder = pyPhase.pythonExecutionOrder

    // Ollama phase (skip already executed)
    const ollPhase = await executeOllamaPhase(nodes, edges, { defaultUrl: options?.defaultUrl, defaultModel: options?.defaultModel }, nodeResults, options?.onNodeDone)
    for (const [k, v] of ollPhase.nodeResults) {
      if (!nodeResults.has(k)) { nodeResults.set(k, v); progress = true }
    }
    for (const [k, v] of ollPhase.outputUpdates) outputUpdates.set(k, v)
    lastExecutionOrder = ollPhase.executionOrder

    // Guard: stop if count didn't grow
    const currentCount = nodeResults.size
    if (currentCount === lastResultsCount) break
    lastResultsCount = currentCount
  }

  // Final response (for backward compatibility)
  let finalResponse = ''
  let lastNodeId: string | undefined

  if (lastExecutionOrder.length > 0) {
    const last = lastExecutionOrder[lastExecutionOrder.length - 1]
    finalResponse = nodeResults.get(last.id) || ''
    lastNodeId = last.id
  } else if (lastPythonOrder.length > 0) {
    const last = lastPythonOrder[lastPythonOrder.length - 1]
    finalResponse = nodeResults.get(last.id) || ''
    lastNodeId = last.id
  }

  const firstOutputNodeId = Array.from(outputUpdates.keys())[0]

  useExecutionStore.getState().setLogExecution([
    ...useExecutionStore.getState().logExecution,
    `[executeWorkflow] Finalized. last node: ${lastNodeId || 'none'}, finalResponseLength: ${finalResponse.length}`
  ])

  return {
    ollamaResponse: finalResponse,
    outputNodeId: firstOutputNodeId,
    outputUpdates: Object.fromEntries(outputUpdates),
    nodeResults: Object.fromEntries(nodeResults),
  };
}

