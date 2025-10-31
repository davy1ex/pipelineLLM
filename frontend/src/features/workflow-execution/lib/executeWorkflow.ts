import type { Node, Edge } from '@xyflow/react';
import { callOllama, executePython } from '../../../shared/api';
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
        // Check nodeResults first (for executed nodes like Ollama or Python)
        if ((sourceNode.type === 'ollama' || sourceNode.type === 'python') && nodeResults.has(sourceNode.id)) {
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
        // Check nodeResults first (for executed nodes)
        if ((sourceNode.type === 'ollama' || sourceNode.type === 'python') && nodeResults.has(sourceNode.id)) {
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
 * Topological sort of Python nodes based on dependencies
 */
function getPythonExecutionOrder(nodes: Node[], edges: Edge[]): Node[] {
  const pythonNodes = nodes.filter((n) => n.type === 'python');
  const visited = new Set<string>();
  const result: Node[] = [];

  function visit(node: Node) {
    if (visited.has(node.id)) return;

    visited.add(node.id);

    // Find dependencies (nodes feeding into this Python node)
    const dependencies = edges
      .filter((e) => e.target === node.id)
      .map((e) => nodes.find((n) => n.id === e.source))
      .filter((n): n is Node => n !== undefined && (n.type === 'python' || n.type === 'textInput' || n.type === 'ollama'));

    for (const dep of dependencies) {
      visit(dep);
    }

    result.push(node);
  }

  for (const node of pythonNodes) {
    visit(node);
  }

  return result;
}

/**
 * Execute workflow - traverse graph and call Ollama API for all Ollama nodes and execute Python nodes
 */
export async function executeWorkflow(
  context: WorkflowExecutionContext,
  options?: WorkflowExecutionOptions
): Promise<Record<string, unknown>> {
  const { nodes, edges } = context;

  // Store results of each node (Ollama and Python)
  const nodeResults = new Map<string, string>();
  // Store which Output nodes should be updated
  const outputUpdates = new Map<string, string>();

  // Execute Python nodes first (before Ollama, if they feed into Ollama)
  const pythonNodes = nodes.filter((n) => n.type === 'python');
  let pythonExecutionOrder: Node[] = [];
  if (pythonNodes.length > 0) {
    pythonExecutionOrder = getPythonExecutionOrder(nodes, edges);
    
    for (const pythonNode of pythonExecutionOrder) {
      const code = (pythonNode.data as any)?.code || '';
      if (!code.trim()) {
        console.warn(`[executeWorkflow] Python node ${pythonNode.id} has no code, skipping`);
        continue;
      }

      // Get input data from connected nodes (via 'input' handle or default)
      const inputEdge = edges.find((e) => 
        e.target === pythonNode.id && (e.targetHandle === 'input' || !e.targetHandle)
      );
      let inputData: string | undefined;
      if (inputEdge) {
        const sourceNode = nodes.find((n) => n.id === inputEdge.source);
        if (sourceNode) {
          const sourceData = sourceNode.data as any;
          // For Python nodes, also check nodeResults (for results from other executed nodes)
          if (sourceNode.type === 'python' && nodeResults.has(sourceNode.id)) {
            inputData = nodeResults.get(sourceNode.id)!;
          } else if (sourceNode.type === 'ollama' && nodeResults.has(sourceNode.id)) {
            inputData = nodeResults.get(sourceNode.id)!;
          } else {
            inputData = sourceData?.value || sourceData?.text || sourceData?.output || '';
          }
        }
      }

      // Inject input data into code if available
      let codeToExecute = code;
      if (inputData) {
        // Prepend input data as a variable (both names for compatibility)
        const escapedData = inputData.replace(/"""/g, '\\"""');
        codeToExecute = `data_input = """${escapedData}"""\ninput_data = data_input  # alias for backward compatibility\n${code}`;
      }

      console.log(`[executeWorkflow] Executing Python for node ${pythonNode.id}:`, {
        codeLength: code.length,
        hasInput: !!inputData,
      });

      try {
        const response = await executePython({ code: codeToExecute });
        
        // Extract output from response (prioritize output variable, fallback to stdout)
        const pythonOutput = response.output || response.stdout || '';
        const pythonError = response.error || response.stderr || '';
        
        // Store result in node.data.output
        pythonNode.data = { 
          ...pythonNode.data, 
          output: pythonOutput,
          lastError: pythonError || undefined,
        };
        
        // Store in results map for downstream nodes
        nodeResults.set(pythonNode.id, pythonOutput);
        
        useExecutionStore.getState().setLogExecution([
          ...useExecutionStore.getState().logExecution,
          `[executeWorkflow] Python node ${pythonNode.id} completed: ${pythonOutput.slice(0, 100)}`
        ]);
        
        console.log(`[executeWorkflow] Python node ${pythonNode.id} completed, output: ${pythonOutput.slice(0, 100)}`);

        // Find connected Output nodes
        const outputEdges = edges.filter((e) => {
          if (e.source !== pythonNode.id) return false;
          const targetNode = nodes.find((n) => n.id === e.target);
          return targetNode?.type === 'output';
        });

        // Update connected Output nodes
        for (const outputEdge of outputEdges) {
          outputUpdates.set(outputEdge.target, pythonOutput);
        }

        // Notify incrementally
        try {
          options?.onNodeDone?.({
            node: pythonNode,
            response: pythonOutput,
            outputTargetIds: outputEdges.map(e => e.target),
          });
        } catch (e) {
          console.warn('[executeWorkflow] onNodeDone callback threw:', e);
        }

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        pythonNode.data = { 
          ...pythonNode.data, 
          lastError: errorMsg,
        };
        useExecutionStore.getState().setLogExecution([
          ...useExecutionStore.getState().logExecution,
          `[executeWorkflow] Python node ${pythonNode.id} error: ${errorMsg}`
        ]);
        console.error(`[executeWorkflow] Python node ${pythonNode.id} failed:`, error);
      }
    }
  }

  // Find all Ollama nodes
  const ollamaNodes = nodes.filter((n) => n.type === 'ollama');
  if (ollamaNodes.length === 0 && pythonNodes.length === 0) {
    throw new Error('No executable node found in workflow (need Ollama or Python nodes)');
    useExecutionStore.getState().setLogExecution([...useExecutionStore.getState().logExecution, '[executeWorkflow] No executable node found in workflow'])
  }

  // Get execution order (topological sort)
  const executionOrder = getOllamaExecutionOrder(nodes, edges);

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

  // Get final response from last executed node (Ollama or Python, for backward compatibility)
  let finalResponse = '';
  let lastNodeId: string | undefined;
  
  if (executionOrder.length > 0) {
    const lastOllamaNode = executionOrder[executionOrder.length - 1];
    finalResponse = nodeResults.get(lastOllamaNode.id) || '';
    lastNodeId = lastOllamaNode.id;
  } else if (pythonNodes.length > 0) {
    // If no Ollama nodes, use last Python node
    const lastPythonNode = pythonExecutionOrder[pythonExecutionOrder.length - 1];
    finalResponse = nodeResults.get(lastPythonNode.id) || '';
    lastNodeId = lastPythonNode.id;
  }

  // Get first output node ID (for backward compatibility)
  const firstOutputNodeId = Array.from(outputUpdates.keys())[0];

  useExecutionStore.getState().setLogExecution([
    ...useExecutionStore.getState().logExecution,
    `[executeWorkflow] Finalized. last node: ${lastNodeId || 'none'}, finalResponseLength: ${finalResponse.length}`
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

