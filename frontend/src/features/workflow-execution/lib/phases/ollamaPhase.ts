import type { Node, Edge } from '@xyflow/react'
import { callOllama } from '../../../../shared/api'
import { useExecutionStore } from '../../model/executionStore'
import { getOllamaExecutionOrder } from '../order'
import { getInputData } from '../utils'

function resolveOllamaInputs(
  node: Node,
  nodes: Node[],
  edges: Edge[],
  nodeResults: Map<string, string>,
  defaults?: { defaultUrl?: string; defaultModel?: string }
): Record<string, unknown> {
  const resolved: Record<string, unknown> = {}
  const promptEdge = edges.find((e) => e.target === node.id && e.targetHandle === 'prompt')
  if (!promptEdge) {
    const defaultEdge = edges.find((e) => e.target === node.id && !e.targetHandle)
    if (defaultEdge) {
      const sourceNode = nodes.find((n) => n.id === defaultEdge.source)
      if (sourceNode) {
        if ((sourceNode.type === 'ollama' || sourceNode.type === 'python') && nodeResults.has(sourceNode.id)) {
          resolved.prompt = nodeResults.get(sourceNode.id)!
        } else {
          const sourceData = sourceNode.data as any
          resolved.prompt = sourceData?.value || sourceData?.text || sourceData?.output || ''
        }
      }
    }
  } else {
    const sourceNode = nodes.find((n) => n.id === promptEdge.source)
    if (sourceNode) {
      if ((sourceNode.type === 'ollama' || sourceNode.type === 'python') && nodeResults.has(sourceNode.id)) {
        resolved.prompt = nodeResults.get(sourceNode.id)!
      } else {
        const sourceData = sourceNode.data as any
        resolved.prompt = sourceData?.value || sourceData?.text || sourceData?.output || ''
      }
    }
  }

  const systemPromptEdge = edges.find((e) => e.target === node.id && e.targetHandle === 'systemPrompt')
  if (systemPromptEdge) {
    const sourceNode = nodes.find((n) => n.id === systemPromptEdge.source)
    if (sourceNode) {
      const sourceData = sourceNode.data as any
      resolved.systemPrompt = sourceData?.value || sourceData?.text || sourceData?.output || ''
    }
  }
  if (!resolved.systemPrompt || String(resolved.systemPrompt).length === 0) {
    const ownSys = (node.data as any)?.systemPrompt
    if (ownSys) resolved.systemPrompt = ownSys
  }

  const configData = getInputData(node.id, 'config', nodes, edges)
  if (configData) {
    resolved.url = (configData as any).url || 'http://localhost:11434'
    resolved.model = (configData as any).model || 'llama3.2'
    resolved.temperature = (configData as any).temperature ?? (node.data as any)?.temperature ?? 0.7
  } else {
    resolved.url = (node.data as any)?.url || defaults?.defaultUrl || 'http://localhost:11434'
    resolved.model = (node.data as any)?.model || defaults?.defaultModel || 'llama3.2'
    resolved.temperature = (node.data as any)?.temperature ?? 0.7
  }

  return resolved
}

export async function executeOllamaPhase(
  nodes: Node[],
  edges: Edge[],
  options: { defaultUrl?: string; defaultModel?: string },
  nodeResults: Map<string, string>,
  onNodeDone?: (args: { node: Node; response: string; outputTargetIds: string[] }) => void
): Promise<{ nodeResults: Map<string, string>; outputUpdates: Map<string, string>; executionOrder: Node[] }>{
  const outputUpdates = new Map<string, string>()
  const executionOrder = getOllamaExecutionOrder(nodes, edges)

  for (const ollamaNode of executionOrder) {
    // Allow re-exec per pass to enable propagation; will not grow results map if unchanged
    const inputs = resolveOllamaInputs(ollamaNode, nodes, edges, nodeResults, options)
    const prompt = (inputs.prompt as string) || ''
    if (!prompt) {
      throw new Error(`Prompt is required for Ollama node ${ollamaNode.id}`)
    }
    const url = (inputs.url as string) || 'http://localhost:11434'
    const model = (inputs.model as string) || 'llama3.2'
    const temperature = (inputs.temperature as number) ?? 0.7
    const systemPrompt = (inputs.systemPrompt as string) || undefined

    useExecutionStore.getState().startNode(ollamaNode.id)
    useExecutionStore.getState().setLogExecution([
      ...useExecutionStore.getState().logExecution,
      `[executeWorkflow] Calling Ollama for node ${ollamaNode.id} (model=${model}, promptLen=${prompt.length})`
    ])
    try {
      const response = await callOllama({ url, model, prompt, system: systemPrompt, temperature })
      const ollamaResponse = response.response
      nodeResults.set(ollamaNode.id, ollamaResponse)

      ollamaNode.data = { ...ollamaNode.data, lastResponse: ollamaResponse }

      const outputEdges = edges.filter((e) => e.source === ollamaNode.id)
        .filter((e) => (nodes.find((n) => n.id === e.target)?.type === 'output'))
      for (const e of outputEdges) outputUpdates.set(e.target, ollamaResponse)

      try { onNodeDone?.({ node: ollamaNode, response: ollamaResponse, outputTargetIds: outputEdges.map((e) => e.target) }) } catch {}

      useExecutionStore.getState().setLogExecution([
        ...useExecutionStore.getState().logExecution,
        `[executeWorkflow] Ollama node ${ollamaNode.id} completed: ${String(ollamaResponse).slice(0, 120)}`
      ])
    } finally {
      useExecutionStore.getState().finishNode(ollamaNode.id)
    }
  }

  return { nodeResults, outputUpdates, executionOrder }
}


