import type { Node, Edge } from '@xyflow/react';
import { callOllama } from '../../../shared/api';
import { useExecutionStore } from '../model/executionStore'

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
 * Get data from a source node connected to target node via specific handle
 */
function getInputData(
  targetNodeId: string,
  handleId: string | undefined,
  nodes: Node[],
  edges: Edge[]
): Record<string, unknown> | null {
  // If handleId specified, find edge with matching targetHandle
  if (handleId) {
    const incomingEdge = edges.find(
      (e) => e.target === targetNodeId && e.targetHandle === handleId
    );
    if (!incomingEdge) return null;
    const sourceNode = nodes.find((n) => n.id === incomingEdge.source);
    return sourceNode?.data ? (sourceNode.data as Record<string, unknown>) : null;
  }

  // If no handleId, find edge without targetHandle or from TextInput node
  const incomingEdge = edges.find((e) => {
    if (e.target !== targetNodeId) return false;
    const sourceNode = nodes.find((n) => n.id === e.source);
    // Prefer TextInput node, or any edge without targetHandle
    return !e.targetHandle || sourceNode?.type === 'textInput';
  });

  if (!incomingEdge) return null;
  const sourceNode = nodes.find((n) => n.id === incomingEdge.source);
  return sourceNode?.data ? (sourceNode.data as Record<string, unknown>) : null;
}

/**
 * Resolve all input data for an Ollama node
 * Returns resolved inputs including prompt (possibly from another Ollama), systemPrompt, and config
 */
function resolveOllamaInputs(
  node: Node,
  nodes: Node[],
  edges: Edge[],
  nodeResults: Map<string, string>,
  defaults?: { defaultUrl?: string; defaultModel?: string }
): Record<string, unknown> {
  const resolved: Record<string, unknown> = {};

  // Get prompt from 'prompt' handle, or default handle
  const promptEdge = edges.find((e) => e.target === node.id && e.targetHandle === 'prompt');
  if (!promptEdge) {
    // Fallback to default handle (no targetHandle)
    const defaultEdge = edges.find((e) => e.target === node.id && !e.targetHandle);
    if (defaultEdge) {
      const sourceNode = nodes.find((n) => n.id === defaultEdge.source);
      if (sourceNode) {
        // If source is Ollama, use its cached result
        if (sourceNode.type === 'ollama' && nodeResults.has(sourceNode.id)) {
          resolved.prompt = nodeResults.get(sourceNode.id)!;
        } else {
          // Otherwise use node data
          const sourceData = sourceNode.data as any;
          resolved.prompt = sourceData?.value || sourceData?.text || sourceData?.output || '';
        }
      }
    }
  } else {
    const sourceNode = nodes.find((n) => n.id === promptEdge.source);
    if (sourceNode) {
      if (sourceNode.type === 'ollama' && nodeResults.has(sourceNode.id)) {
        resolved.prompt = nodeResults.get(sourceNode.id)!;
      } else {
        const sourceData = sourceNode.data as any;
        resolved.prompt = sourceData?.value || sourceData?.text || sourceData?.output || '';
      }
    }
  }

  // Get system prompt from 'systemPrompt' handle
  const systemPromptEdge = edges.find((e) => e.target === node.id && e.targetHandle === 'systemPrompt');
  if (systemPromptEdge) {
    const sourceNode = nodes.find((n) => n.id === systemPromptEdge.source);
    if (sourceNode) {
      const sourceData = sourceNode.data as any;
      const sys = sourceData?.value || sourceData?.text || sourceData?.output || '';
      resolved.systemPrompt = sys;
      console.log('[resolveOllamaInputs] systemPrompt from edge', {
        targetId: node.id,
        sourceId: sourceNode.id,
        length: (sys || '').length,
        preview: String(sys || '').slice(0, 80),
      });
    }
  }

  // Keep prompt and systemPrompt separate - Ollama API expects them separately
  // Don't combine them here, pass systemPrompt as separate parameter

  // Fallback: if no systemPrompt edge or empty, use node's own data.systemPrompt (if present)
  if (!resolved.systemPrompt || String(resolved.systemPrompt).length === 0) {
    const ownSys = (node.data as any)?.systemPrompt;
    if (ownSys) {
      resolved.systemPrompt = ownSys;
      console.log('[resolveOllamaInputs] systemPrompt fallback to node.data.systemPrompt', {
        targetId: node.id,
        length: String(ownSys).length,
        preview: String(ownSys).slice(0, 80),
      });
    }
  }

  // Get config from Settings node via 'config' handle
  const configData = getInputData(node.id, 'config', nodes, edges);
  if (configData) {
    resolved.url = configData.url || 'http://localhost:11434';
    resolved.model = configData.model || 'llama3.2';
    resolved.temperature = configData.temperature ?? (node.data as any)?.temperature ?? 0.7;
  } else {
    // Fallback to node's own data
    resolved.url = (node.data as any)?.url || defaults?.defaultUrl || 'http://localhost:11434';
    resolved.model = (node.data as any)?.model || defaults?.defaultModel || 'llama3.2';
    resolved.temperature = (node.data as any)?.temperature ?? 0.7;
  }

  return resolved;
}

/**
 * Topological sort of Ollama nodes based on dependencies
 */
function getOllamaExecutionOrder(nodes: Node[], edges: Edge[]): Node[] {
  const ollamaNodes = nodes.filter((n) => n.type === 'ollama');
  const visited = new Set<string>();
  const result: Node[] = [];

  function visit(node: Node) {
    if (visited.has(node.id)) return;

    visited.add(node.id);

    // Find dependencies (other Ollama nodes feeding into this one)
    const dependencies = edges
      .filter((e) => e.target === node.id && (e.targetHandle === 'prompt' || !e.targetHandle))
      .map((e) => nodes.find((n) => n.id === e.source))
      .filter((n): n is Node => n !== undefined && n.type === 'ollama');

    for (const dep of dependencies) {
      visit(dep);
    }

    result.push(node);
  }

  for (const node of ollamaNodes) {
    visit(node);
  }

  return result;
}

/**
 * Execute workflow - traverse graph and call Ollama API for all Ollama nodes
 */
export async function executeWorkflow(
  context: WorkflowExecutionContext,
  options?: WorkflowExecutionOptions
): Promise<Record<string, unknown>> {
  const { nodes, edges } = context;

  // Find all Ollama nodes
  const ollamaNodes = nodes.filter((n) => n.type === 'ollama');
  if (ollamaNodes.length === 0) {
    throw new Error('No Ollama node found in workflow');
    useExecutionStore.getState().setLogExecution([...useExecutionStore.getState().logExecution, '[executeWorkflow] No Ollama node found in workflow'])
  }

  // Get execution order (topological sort)
  const executionOrder = getOllamaExecutionOrder(nodes, edges);

  // Store results of each Ollama node
  const nodeResults = new Map<string, string>();
  // Store which Output nodes should be updated with which Ollama results
  const outputUpdates = new Map<string, string>(); // outputNodeId -> ollamaResponse

  // Execute each Ollama node in order
  for (const ollamaNode of executionOrder) {
    const ollamaInputs = resolveOllamaInputs(ollamaNode, nodes, edges, nodeResults, { defaultUrl: options?.defaultUrl, defaultModel: options?.defaultModel });

    const prompt = (ollamaInputs.prompt as string) || '';
    if (!prompt) {
      throw new Error(`Prompt is required for Ollama node ${ollamaNode.id}`);
      useExecutionStore.getState().setLogExecution([...useExecutionStore.getState().logExecution, '[executeWorkflow] Prompt is required for Ollama node ${ollamaNode.id}'])
    }

    const url = (ollamaInputs.url as string) || 'http://localhost:11434';
    const model = (ollamaInputs.model as string) || 'llama3.2';
    const temperature = (ollamaInputs.temperature as number) ?? 0.7;
    const systemPrompt = (ollamaInputs.systemPrompt as string) || undefined;

    console.log(`[executeWorkflow] Calling Ollama for node ${ollamaNode.id}:`, {
      model,
      promptLength: prompt.length,
      systemPromptLength: systemPrompt?.length || 0,
      hasSystemPrompt: !!systemPrompt,
    });

    // Call Ollama API
    const response = await callOllama({
      url,
      model,
      prompt,
      system: systemPrompt,
      temperature,
    });

    // Store result for this node
    const ollamaResponse = response.response;
    nodeResults.set(ollamaNode.id, ollamaResponse);
    
    useExecutionStore.getState().setLogExecution([...useExecutionStore.getState().logExecution, `[executeWorkflow] Ollama API called for node ${ollamaNode.id}: ${ollamaResponse}`])
    console.log(`[executeWorkflow] Ollama node ${ollamaNode.id} completed, response length: ${ollamaResponse.length}`);

    // Update node data with response (for UI feedback)
    ollamaNode.data = { ...ollamaNode.data, lastResponse: ollamaResponse };

    // Find all Output nodes connected to this Ollama node
    // Check both direct edges and edges without sourceHandle (default connection)
    const outputEdges = edges.filter((e) => {
      if (e.source !== ollamaNode.id) return false;
      const targetNode = nodes.find((n) => n.id === e.target);
      const isOutput = targetNode?.type === 'output';
      console.log(`[executeWorkflow] Edge ${e.id}: ${ollamaNode.id} -> ${e.target} (type: ${targetNode?.type}, isOutput: ${isOutput})`);
      return isOutput;
    });

    console.log(`[executeWorkflow] Found ${outputEdges.length} Output edges from Ollama ${ollamaNode.id}`);

    // Update each connected Output node with this Ollama's response
    if (outputEdges.length > 0) {
      for (const outputEdge of outputEdges) {
        console.log(`[executeWorkflow] Adding Output update: ${outputEdge.target} <- "${ollamaResponse.slice(0, 50)}..."`);
        outputUpdates.set(outputEdge.target, ollamaResponse);
      }
    }

    // Notify incrementally so UI can update immediately per node
    try {
      options?.onNodeDone?.({
        node: ollamaNode,
        response: ollamaResponse,
        outputTargetIds: outputEdges.map(e => e.target),
      })
    } catch (e) {
      console.warn('[executeWorkflow] onNodeDone callback threw:', e)
    }
  }

  // Get final response from last Ollama node (for backward compatibility)
  const lastOllamaNode = executionOrder[executionOrder.length - 1];
  const finalResponse = nodeResults.get(lastOllamaNode.id) || '';

  // Get first output node ID (for backward compatibility)
  const firstOutputNodeId = Array.from(outputUpdates.keys())[0];

  useExecutionStore.getState().setLogExecution([
    ...useExecutionStore.getState().logExecution,
    `[executeWorkflow] Finalized. last node: ${lastOllamaNode?.id}, finalResponseLength: ${finalResponse.length}`
  ])
  console.log('[executeWorkflow] Final results:', {
    outputUpdatesCount: outputUpdates.size,
    outputUpdates: Array.from(outputUpdates.entries()).map(([id, text]) => ({ id, textLength: text.length })),
    nodeResultsCount: nodeResults.size,
  });

  return {
    ollamaResponse: finalResponse,
    outputNodeId: firstOutputNodeId,
    outputUpdates: Object.fromEntries(outputUpdates), // all output node updates
    nodeResults: Object.fromEntries(nodeResults), // For debugging
  };
}

