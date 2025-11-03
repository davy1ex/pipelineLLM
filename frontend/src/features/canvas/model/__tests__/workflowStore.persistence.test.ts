/// <reference types="vitest" />
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Node, Edge } from '@xyflow/react'

// Simple in-memory localStorage mock
class MemoryStorage {
  private store = new Map<string, string>()
  getItem(key: string) { return this.store.has(key) ? this.store.get(key)! : null }
  setItem(key: string, value: string) { this.store.set(key, value) }
  removeItem(key: string) { this.store.delete(key) }
  clear() { this.store.clear() }
  
  // For debugging
  getAllKeys() { return Array.from(this.store.keys()) }
  getAllValues() { return Array.from(this.store.values()) }
}

// Helper to fresh-import workflowStore with clean module state
async function importFreshWorkflowStore() {
  vi.resetModules()
  // Wait a bit for debounce to complete
  await new Promise(resolve => setTimeout(resolve, 100))
  const mod = await import('../workflowStore')
  return mod
}

describe('workflowStore persistence', () => {
  let storage: MemoryStorage

  beforeEach(() => {
    storage = new MemoryStorage()
    // @ts-ignore set global localStorage mock
    globalThis.localStorage = storage as any
    vi.resetModules()
  })

  it('persists edges after connect and restores them on reload', async () => {
    const { useWorkflowStore } = await importFreshWorkflowStore()

    // Prepare nodes
    const nodes: Node[] = [
      { id: 'a', type: 'textInput', position: { x: 0, y: 0 }, data: { value: 'hello' } } as Node,
      { id: 'b', type: 'python', position: { x: 200, y: 0 }, data: { code: 'output = data_input' } } as Node,
    ]

    // Set nodes first
    useWorkflowStore.getState().setNodes(nodes)
    
    // Wait for debounced save
    await new Promise(resolve => setTimeout(resolve, 400))

    // Connect edge
    useWorkflowStore.getState().onConnect({ 
      source: 'a', 
      target: 'b', 
      sourceHandle: 'output', 
      targetHandle: 'input' 
    })

    // Wait for debounced save
    await new Promise(resolve => setTimeout(resolve, 400))

    // Validate edge created
    const edges = useWorkflowStore.getState().edges
    expect(edges.length).toBe(1)
    expect(edges[0].source).toBe('a')
    expect(edges[0].target).toBe('b')

    // Verify localStorage contains the data
    const stored = storage.getItem('pipelineLLM_workflow')
    expect(stored).not.toBeNull()
    if (stored) {
      const parsed = JSON.parse(stored)
      expect(parsed.nodes).toHaveLength(2)
      expect(parsed.edges).toHaveLength(1)
      expect(parsed.edges[0].source).toBe('a')
      expect(parsed.edges[0].target).toBe('b')
    }

    // Simulate page reload: re-import store and call loadFromStorage
    const { useWorkflowStore: storeReloaded } = await importFreshWorkflowStore()
    
    // Call loadFromStorage to trigger reload from localStorage
    const loaded = storeReloaded.getState().loadFromStorage()
    expect(loaded).toBe(true)
    
    const reNodes = storeReloaded.getState().nodes
    const reEdges = storeReloaded.getState().edges

    expect(reNodes.map(n => n.id)).toEqual(['a', 'b'])
    expect(reEdges.length).toBe(1)
    expect(reEdges[0].source).toBe('a')
    expect(reEdges[0].target).toBe('b')
    expect(reEdges[0].sourceHandle).toBe('output')
    expect(reEdges[0].targetHandle).toBe('input')
  })

  it('keeps edges after importing workflow from external JSON', async () => {
    const { useWorkflowStore } = await importFreshWorkflowStore()

    const nodes: Node[] = [
      { id: 's', type: 'textInput', position: { x: 0, y: 0 }, data: { value: 'x' } } as Node,
      { id: 't', type: 'python', position: { x: 100, y: 0 }, data: { code: 'output = data_input' } } as Node,
    ]
    const edges: Edge[] = [
      { 
        id: 'e1', 
        source: 's', 
        target: 't', 
        sourceHandle: 'output', 
        targetHandle: 'input', 
        type: 'step' 
      } as Edge,
    ]

    // Simulate import action by setting nodes+edges
    useWorkflowStore.getState().setNodes(nodes)
    useWorkflowStore.getState().setEdges(edges)

    // Wait for debounced save
    await new Promise(resolve => setTimeout(resolve, 400))

    // Verify stored state immediately
    const sEdges = useWorkflowStore.getState().edges
    expect(sEdges.length).toBe(1)
    expect(sEdges[0].source).toBe('s')
    expect(sEdges[0].target).toBe('t')

    // Verify localStorage
    const stored = storage.getItem('pipelineLLM_workflow')
    expect(stored).not.toBeNull()
    if (stored) {
      const parsed = JSON.parse(stored)
      expect(parsed.edges).toHaveLength(1)
      expect(parsed.edges[0].source).toBe('s')
      expect(parsed.edges[0].target).toBe('t')
    }

    // Reload and verify persistence
    const { useWorkflowStore: storeReloaded } = await importFreshWorkflowStore()
    
    // Call loadFromStorage to trigger reload
    const loaded = storeReloaded.getState().loadFromStorage()
    expect(loaded).toBe(true)
    
    const reEdges = storeReloaded.getState().edges
    expect(reEdges.length).toBe(1)
    expect(reEdges[0].source).toBe('s')
    expect(reEdges[0].target).toBe('t')
    expect(reEdges[0].sourceHandle).toBe('output')
    expect(reEdges[0].targetHandle).toBe('input')
  })

  it('preserves edge handles (sourceHandle, targetHandle) after save/reload', async () => {
    const { useWorkflowStore } = await importFreshWorkflowStore()

    const nodes: Node[] = [
      { id: 'settings-1', type: 'settings', position: { x: 0, y: 0 }, data: { url: 'http://localhost:11434' } } as Node,
      { id: 'ollama-1', type: 'ollama', position: { x: 200, y: 0 }, data: { prompt: 'hi' } } as Node,
    ]

    useWorkflowStore.getState().setNodes(nodes)
    
    // Connect with specific handles
    useWorkflowStore.getState().onConnect({
      source: 'settings-1',
      target: 'ollama-1',
      sourceHandle: 'config',
      targetHandle: 'config'
    })

    await new Promise(resolve => setTimeout(resolve, 400))

    const edges = useWorkflowStore.getState().edges
    expect(edges.length).toBe(1)
    expect(edges[0].sourceHandle).toBe('config')
    expect(edges[0].targetHandle).toBe('config')

    // Reload
    const { useWorkflowStore: storeReloaded } = await importFreshWorkflowStore()
    storeReloaded.getState().loadFromStorage()

    const reEdges = storeReloaded.getState().edges
    expect(reEdges.length).toBe(1)
    expect(reEdges[0].sourceHandle).toBe('config')
    expect(reEdges[0].targetHandle).toBe('config')
  })
})
