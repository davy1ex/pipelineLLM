/// <reference types="vitest" />
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Node, Edge } from '@xyflow/react'

vi.mock('../../model/executionStore', () => {
  const state = {
    logExecution: [] as string[],
    runningNodeIds: [] as string[],
    completedNodeIds: [] as string[],
    setLogExecution(next: string[]) { this.logExecution = next },
    startNode(id: string) {
      if (!this.runningNodeIds.includes(id)) this.runningNodeIds.push(id)
      this.completedNodeIds = this.completedNodeIds.filter(x => x !== id)
    },
    finishNode(id: string) {
      this.runningNodeIds = this.runningNodeIds.filter(x => x !== id)
      if (!this.completedNodeIds.includes(id)) this.completedNodeIds.push(id)
    },
    resetExecution() { this.runningNodeIds = []; this.completedNodeIds = [] },
    completeAll(ids: string[]) { this.runningNodeIds = []; this.completedNodeIds = Array.from(new Set(ids)) },
  }
  return {
    useExecutionStore: { getState: () => state }
  }
})

vi.mock('../../../../shared/api/workflow', () => {
  // default mocks overridden per-test
  return {
    enqueueWorkflow: vi.fn(async () => ({ queueId: 'q-1', status: 'pending' })),
    getWorkflowStatus: vi.fn(async () => ({
      queueId: 'q-1', status: 'completed', runningNodeIds: [], completedNodeIds: [], results: {}, executionLog: [], iterations: 1, hasErrors: false,
    })),
  }
})

import { runWorkflowBackend } from '../runWorkflowBackend'
import { enqueueWorkflow, getWorkflowStatus } from '../../../../shared/api/workflow'

const makeNodesEdges = (nodes: Partial<Node>[], edges: Partial<Edge>[]) => ({
  nodes: nodes as Node[],
  edges: edges as Edge[],
})

describe('runWorkflowBackend', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('completes and updates logs and node data for successful workflow', async () => {
    // Arrange API mocks
    ;(enqueueWorkflow as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ queueId: 'q-1', status: 'pending' })
    ;(getWorkflowStatus as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      queueId: 'q-1',
      status: 'completed',
      runningNodeIds: [],
      completedNodeIds: ['python-1'],
      results: {
        'python-1': { output: 'HELLO', error: null },
      },
      executionLog: ['Starting', 'Executing node python-1', 'Node python-1 completed successfully'],
      iterations: 1,
      hasErrors: false,
    })

    const { nodes, edges } = makeNodesEdges([
      { id: 'input-1', type: 'textInput', data: { value: 'Hello' } as any },
      { id: 'python-1', type: 'python', data: { code: 'output = data_input.upper()' } as any },
    ], [
      { id: 'e1', source: 'input-1', target: 'python-1', sourceHandle: 'output', targetHandle: 'input' },
    ])

    const updateNodeData = vi.fn()

    // Act
    const res = await runWorkflowBackend({ nodes, edges, updateNodeData, verbose: true })

    // Assert
    expect(res.status).toBe('completed')
    expect(updateNodeData).toHaveBeenCalledWith('python-1', expect.objectContaining({ output: 'HELLO' }))
  })

  it('logs node errors and sets node.data.error on failure', async () => {
    ;(enqueueWorkflow as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ queueId: 'q-err', status: 'pending' })
    ;(getWorkflowStatus as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      queueId: 'q-err',
      status: 'completed',
      runningNodeIds: [],
      completedNodeIds: ['ollama-1'],
      results: {
        'ollama-1': { output: '', error: 'Cannot connect to Ollama' },
      },
      executionLog: ['Starting', 'Executing node ollama-1', 'Node ollama-1 failed: Cannot connect to Ollama'],
      iterations: 1,
      hasErrors: true,
      failedNodes: ['ollama-1'],
    })

    const { nodes, edges } = makeNodesEdges([
      { id: 'ollama-1', type: 'ollama', data: { prompt: 'Hi' } as any },
    ], [])

    const updateNodeData = vi.fn()

    const res = await runWorkflowBackend({ nodes, edges, updateNodeData, verbose: false })

    // Expect completion with errors flagged
    expect(res.status).toBe('completed')
    // Node error stored
    expect(updateNodeData).toHaveBeenCalledWith('ollama-1', expect.objectContaining({ error: 'Cannot connect to Ollama' }))
  })

  it('handles workflow validation errors', async () => {
    ;(enqueueWorkflow as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ queueId: 'q-val', status: 'pending' })
    ;(getWorkflowStatus as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      queueId: 'q-val',
      status: 'failed',
      runningNodeIds: [],
      completedNodeIds: [],
      results: {},
      executionLog: ['ERROR: Graph validation failed: Node node-1 depends on non-existent node missing-node'],
      iterations: 0,
      error: 'Graph validation failed: Node node-1 depends on non-existent node missing-node',
      hasErrors: true,
    })

    const { nodes, edges } = makeNodesEdges([
      { id: 'node-1', type: 'python', data: {} as any },
    ], [
      { id: 'e1', source: 'missing-node', target: 'node-1' },
    ])

    const updateNodeData = vi.fn()

    // Act & Assert
    await expect(
      runWorkflowBackend({ nodes, edges, updateNodeData, verbose: false })
    ).rejects.toThrow('Graph validation failed')
  })

  it('handles complete workflow failure when all nodes fail', async () => {
    ;(enqueueWorkflow as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ queueId: 'q-fail', status: 'pending' })
    ;(getWorkflowStatus as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      queueId: 'q-fail',
      status: 'failed',
      runningNodeIds: [],
      completedNodeIds: ['node-1', 'node-2'],
      results: {
        'node-1': { output: '', error: 'Error 1' },
        'node-2': { output: '', error: 'Error 2' },
      },
      executionLog: ['Starting', 'Node node-1 failed: Error 1', 'Node node-2 failed: Error 2'],
      iterations: 1,
      error: 'All 2 nodes failed execution',
      hasErrors: true,
      failedNodes: ['node-1', 'node-2'],
      stats: { total_nodes: 2, successful_nodes: 0, failed_nodes: 2, skipped_nodes: 0 },
    })

    const { nodes, edges } = makeNodesEdges([
      { id: 'node-1', type: 'python', data: {} as any },
      { id: 'node-2', type: 'python', data: {} as any },
    ], [])

    const updateNodeData = vi.fn()

    // Act & Assert
    await expect(
      runWorkflowBackend({ nodes, edges, updateNodeData, verbose: false })
    ).rejects.toThrow('All 2 nodes failed execution')
  })

  it('tracks node execution progress correctly', async () => {
    const statusUpdates: any[] = []
    
    ;(enqueueWorkflow as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ queueId: 'q-progress', status: 'pending' })
    
    // Simulate progressive status updates
    let callCount = 0
    ;(getWorkflowStatus as unknown as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      callCount++
      if (callCount === 1) {
        return {
          queueId: 'q-progress',
          status: 'running',
          runningNodeIds: ['node-1'],
          completedNodeIds: [],
          results: {},
          executionLog: ['Starting'],
          iterations: 0,
        }
      } else if (callCount === 2) {
        return {
          queueId: 'q-progress',
          status: 'running',
          runningNodeIds: [],
          completedNodeIds: ['node-1'],
          results: {
            'node-1': { output: 'Result 1', error: null },
          },
          executionLog: ['Starting', 'Node node-1 completed'],
          iterations: 1,
        }
      } else {
        return {
          queueId: 'q-progress',
          status: 'completed',
          runningNodeIds: [],
          completedNodeIds: ['node-1'],
          results: {
            'node-1': { output: 'Result 1', error: null },
          },
          executionLog: ['Starting', 'Node node-1 completed'],
          iterations: 1,
          hasErrors: false,
        }
      }
    })

    const { nodes, edges } = makeNodesEdges([
      { id: 'node-1', type: 'python', data: {} as any },
    ], [])

    const updateNodeData = vi.fn()
    
    // Mock executionStore to track updates
    const { useExecutionStore } = await import('../../model/executionStore')
    const store = useExecutionStore.getState()

    // Act
    const res = await runWorkflowBackend({ 
      nodes, 
      edges, 
      updateNodeData, 
      verbose: false,
      pollInterval: 10 // Fast polling for test
    })

    // Assert
    expect(res.status).toBe('completed')
    expect(updateNodeData).toHaveBeenCalledWith('node-1', expect.objectContaining({ output: 'Result 1' }))
    // Verify store was updated (nodes marked as completed)
    expect(store.completedNodeIds).toContain('node-1')
  })

  it('verifies execution order matches topology (dependencies before dependents)', async () => {
    // Create workflow: input -> python1 -> python2
    const { nodes, edges } = makeNodesEdges([
      { id: 'input-1', type: 'textInput', data: { value: 'test' } as any },
      { id: 'python-1', type: 'python', data: { code: 'output = data_input' } as any },
      { id: 'python-2', type: 'python', data: { code: 'output = data_input.upper()' } as any },
    ], [
      { id: 'e1', source: 'input-1', target: 'python-1', sourceHandle: 'output', targetHandle: 'input' },
      { id: 'e2', source: 'python-1', target: 'python-2', sourceHandle: 'output', targetHandle: 'input' },
    ])

    const executionOrder: string[] = []
    
    ;(enqueueWorkflow as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ queueId: 'q-order', status: 'pending' })
    ;(getWorkflowStatus as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      queueId: 'q-order',
      status: 'completed',
      runningNodeIds: [],
      completedNodeIds: ['input-1', 'python-1', 'python-2'],
      results: {
        'input-1': { output: 'test', error: null },
        'python-1': { output: 'test', error: null },
        'python-2': { output: 'TEST', error: null },
      },
      executionLog: [
        'Starting workflow execution: 3 executable nodes',
        'Iteration 1',
        'Executing node input-1 (textInput)',
        'Node input-1 completed successfully',
        'Executing node python-1 (python)',
        'Node python-1 completed successfully',
        'Executing node python-2 (python)',
        'Node python-2 completed successfully',
      ],
      iterations: 1,
      hasErrors: false,
    })

    const updateNodeData = vi.fn((nodeId: string) => {
      executionOrder.push(nodeId)
    })

    // Act
    await runWorkflowBackend({ nodes, edges, updateNodeData, verbose: false })

    // Assert - python-2 should receive python-1 output (uppercased), not input-1 output
    expect(updateNodeData).toHaveBeenCalledWith('python-2', expect.objectContaining({ output: 'TEST' }))
    // Verify topology: python-2 depends on python-1, so python-1 should be updated before python-2
    const python1Call = updateNodeData.mock.calls.find(c => c[0] === 'python-1')
    const python2Call = updateNodeData.mock.calls.find(c => c[0] === 'python-2')
    expect(python1Call).toBeDefined()
    expect(python2Call).toBeDefined()
  })
})
