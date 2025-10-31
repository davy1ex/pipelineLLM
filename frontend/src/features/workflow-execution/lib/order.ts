import type { Node, Edge } from '@xyflow/react'

export function getOllamaExecutionOrder(nodes: Node[], edges: Edge[]): Node[] {
  const ollamaNodes = nodes.filter((n) => n.type === 'ollama')
  const visited = new Set<string>()
  const result: Node[] = []

  function visit(node: Node) {
    if (visited.has(node.id)) return
    visited.add(node.id)
    const dependencies = edges
      .filter((e) => e.target === node.id && (e.targetHandle === 'prompt' || !e.targetHandle))
      .map((e) => nodes.find((n) => n.id === e.source))
      .filter((n): n is Node => n !== undefined && n.type === 'ollama')
    for (const dep of dependencies) visit(dep)
    result.push(node)
  }

  for (const node of ollamaNodes) visit(node)
  return result
}

export function getPythonExecutionOrder(nodes: Node[], edges: Edge[]): Node[] {
  const pythonNodes = nodes.filter((n) => n.type === 'python')
  const visited = new Set<string>()
  const result: Node[] = []

  function visit(node: Node) {
    if (visited.has(node.id)) return
    visited.add(node.id)
    const dependencies = edges
      .filter((e) => e.target === node.id)
      .map((e) => nodes.find((n) => n.id === e.source))
      .filter((n): n is Node => n !== undefined && (n.type === 'python' || n.type === 'textInput' || n.type === 'ollama'))
    for (const dep of dependencies) visit(dep)
    result.push(node)
  }

  for (const node of pythonNodes) visit(node)
  return result
}


