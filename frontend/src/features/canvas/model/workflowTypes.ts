/**
 * ComfyUI-style workflow format
 * 
 * This format represents workflow in a clear, executable structure
 * similar to ComfyUI's workflow format.
 */

/**
 * Link format: [link_id, from_node_id, from_slot_index, to_node_id, to_slot_index, data_type]
 */
export type WorkflowLink = [number, number, number, number, number, string];

/**
 * Node input connection
 */
export interface WorkflowNodeInput {
  name: string;
  type: string;
  link?: number; // link_id if connected, undefined if not connected
}

/**
 * Node output connection
 */
export interface WorkflowNodeOutput {
  name: string;
  type: string;
  links?: number[]; // array of link_ids connected to this output
}

/**
 * Workflow node (ComfyUI-style)
 */
export interface WorkflowNode {
  id: number; // numeric ID
  type: string; // node type: 'textInput', 'ollama', 'python', 'output', 'settings', 'fileWriter'
  order: number; // execution order (computed via topological sort)
  mode: number; // node mode (0 = always execute, reserved for future use)
  inputs: WorkflowNodeInput[]; // input connections
  outputs: WorkflowNodeOutput[]; // output connections
  properties?: Record<string, unknown>; // node properties (e.g., label, position for UI)
  widgets_values?: unknown[]; // node-specific widget values (parameters)
}

/**
 * Workflow state metadata
 */
export interface WorkflowState {
  lastNodeId: number; // highest node ID used
  lastLinkId: number; // highest link ID used
}

/**
 * Complete workflow structure (ComfyUI-style)
 */
export interface Workflow {
  version: number;
  state: WorkflowState;
  nodes: WorkflowNode[];
  links: WorkflowLink[];
}

/**
 * Result workflow - workflow with execution results
 */
export interface ResultWorkflow extends Workflow {
  results?: Record<number, unknown>; // node_id -> execution result
  executionLog?: string[]; // execution log messages
}



