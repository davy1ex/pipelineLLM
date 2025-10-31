import type { Node, Edge } from '@xyflow/react'
import { executePython } from '../../../../shared/api'
import { useExecutionStore } from '../../model/executionStore'
import { getPythonExecutionOrder } from '../order'

export async function executePythonPhase(
  nodes: Node[],
  edges: Edge[],
  existingResults?: Map<string, string>,
  onNodeDone?: (args: { node: Node; response: string; outputTargetIds: string[] }) => void
): Promise<{ nodeResults: Map<string, string>; outputUpdates: Map<string, string>; pythonExecutionOrder: Node[] }>{
  const nodeResults = new Map<string, string>()
  const outputUpdates = new Map<string, string>()

  const pythonNodes = nodes.filter((n) => n.type === 'python')
  const pythonExecutionOrder = pythonNodes.length > 0 ? getPythonExecutionOrder(nodes, edges) : []

  for (const pythonNode of pythonExecutionOrder) {
    // Re-execute each pass so nodes can consume new upstream results
    const code = (pythonNode.data as any)?.code || ''
    if (!code.trim()) {
      console.warn(`[executeWorkflow] Python node ${pythonNode.id} has no code, skipping`)
      continue
    }

    // Resolve single input from handle 'input' (or default edge)
    const inputEdge = edges.find((e) => e.target === pythonNode.id && (e.targetHandle === 'input' || !e.targetHandle))
    let inputData: string | undefined
    if (inputEdge) {
      const sourceNode = nodes.find((n) => n.id === inputEdge.source)
      if (sourceNode) {
        if (existingResults && existingResults.has(sourceNode.id)) {
          inputData = existingResults.get(sourceNode.id)!
        } else {
          const sourceData = sourceNode.data as any
          inputData = sourceData?.value || sourceData?.text || sourceData?.output || ''
        }
      }
    }

    // Always define data_input/input_data to avoid NameError in user code
    const escaped = (inputData ?? '').replace(/"""/g, '\\"""')
    const codeToExecute = `data_input = """${escaped}"""\ninput_data = data_input\n${code}`

    // mark running
    useExecutionStore.getState().startNode(pythonNode.id)
    useExecutionStore.getState().setLogExecution([
      ...useExecutionStore.getState().logExecution,
      `[executeWorkflow] Executing Python for node ${pythonNode.id}`
    ])

    try {
      const response = await executePython({ code: codeToExecute })
      const pythonOutput = response.output || response.stdout || ''
      const pythonError = response.error || response.stderr || ''

      pythonNode.data = { ...pythonNode.data, output: pythonOutput, lastError: pythonError || undefined }
      nodeResults.set(pythonNode.id, pythonOutput)

      // Fan-out to Output nodes
      const outEdges = edges.filter((e) => e.source === pythonNode.id)
        .filter((e) => (nodes.find((n) => n.id === e.target)?.type === 'output'))
      for (const e of outEdges) outputUpdates.set(e.target, pythonOutput)

      try { onNodeDone?.({ node: pythonNode, response: pythonOutput, outputTargetIds: outEdges.map((e) => e.target) }) } catch {}
    } finally {
      useExecutionStore.getState().finishNode(pythonNode.id)
    }
  }

  return { nodeResults, outputUpdates, pythonExecutionOrder }
}


