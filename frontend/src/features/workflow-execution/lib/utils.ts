import type { Node, Edge } from '@xyflow/react'

/**
 * Get data from a source node connected to target node via specific handle
 */
export function getInputData(
  targetNodeId: string,
  handleId: string | undefined,
  nodes: Node[],
  edges: Edge[]
): Record<string, unknown> | null {
  if (handleId) {
    const incomingEdge = edges.find((e) => e.target === targetNodeId && e.targetHandle === handleId)
    if (!incomingEdge) return null
    const sourceNode = nodes.find((n) => n.id === incomingEdge.source)
    return sourceNode?.data ? (sourceNode.data as Record<string, unknown>) : null
  }

  const incomingEdge = edges.find((e) => {
    if (e.target !== targetNodeId) return false
    const sourceNode = nodes.find((n) => n.id === e.source)
    return !e.targetHandle || sourceNode?.type === 'textInput'
  })

  if (!incomingEdge) return null
  const sourceNode = nodes.find((n) => n.id === incomingEdge.source)
  return sourceNode?.data ? (sourceNode.data as Record<string, unknown>) : null
}


