/**
 * Node handles configuration - defines inputs and outputs for each node type
 */

import type { NodeHandle } from './dataTypes';

export const NODE_HANDLES: Record<string, { inputs: NodeHandle[]; outputs: NodeHandle[] }> = {
  settings: {
    inputs: [],
    outputs: [
      {
        id: 'config',
        type: 'output',
        dataType: 'json',
        label: 'config',
      },
    ],
  },
  textInput: {
    inputs: [],
    outputs: [
      {
        id: 'output',
        type: 'output',
        dataType: 'string',
        label: 'output',
      },
    ],
  },
  ollama: {
    inputs: [
      {
        id: 'prompt',
        type: 'input',
        dataType: 'string',
        label: 'prompt',
      },
      {
        id: 'systemPrompt',
        type: 'input',
        dataType: 'string',
        label: 'system prompt',
      },
      {
        id: 'config',
        type: 'input',
        dataType: 'json',
        label: 'config',
      },
    ],
    outputs: [
      {
        id: 'output',
        type: 'output',
        dataType: 'string',
        label: 'output',
      },
    ],
  },
  output: {
    inputs: [
      {
        id: 'text',
        type: 'input',
        dataType: 'string',
        label: 'text',
      },
    ],
    outputs: [],
  },
};

/**
 * Get handles configuration for a node type
 */
export const getNodeHandles = (nodeType: string | undefined): { inputs: NodeHandle[]; outputs: NodeHandle[] } => {
  if (!nodeType) return { inputs: [], outputs: [] };
  return NODE_HANDLES[nodeType] || { inputs: [], outputs: [] };
};

