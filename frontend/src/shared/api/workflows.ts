/**
 * API client for workflow file management
 */

export interface WorkflowMetadata {
  name: string;
  filename: string;
  created: string;
  modified: string;
  size: number;
  description: string;
}

export interface WorkflowListResponse {
  workflows: WorkflowMetadata[];
}

export interface WorkflowData {
  name: string;
  nodes: unknown[];
  edges: unknown[];
  description?: string;
  version?: number;
}

export interface SaveWorkflowRequest {
  name: string;
  nodes: unknown[];
  edges: unknown[];
  description?: string;
}

export interface SaveWorkflowResponse {
  name: string;
  filename: string;
  message: string;
}

/**
 * List all available workflows
 */
export const listWorkflows = async (): Promise<WorkflowListResponse> => {
  const res = await fetch('/api/workflows', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to list workflows: ${errorText}`);
  }
  
  return await res.json();
};

/**
 * Load a workflow by name
 */
export const loadWorkflow = async (name: string): Promise<WorkflowData> => {
  const res = await fetch(`/api/workflows/${encodeURIComponent(name)}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  
  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(`Workflow "${name}" not found`);
    }
    const errorText = await res.text();
    throw new Error(`Failed to load workflow: ${errorText}`);
  }
  
  return await res.json();
};

/**
 * Save a workflow
 */
export const saveWorkflow = async (
  request: SaveWorkflowRequest
): Promise<SaveWorkflowResponse> => {
  const res = await fetch('/api/workflows/save', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });
  
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to save workflow: ${errorText}`);
  }
  
  return await res.json();
};

