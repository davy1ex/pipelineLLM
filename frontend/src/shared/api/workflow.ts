/**
 * Response from workflow execution endpoint (async queue)
 */
export interface WorkflowExecuteResponse {
  queueId: string; // Queue ID for polling status
  status: 'pending'; // Initial status
}

/**
 * Workflow execution status response
 */
export interface WorkflowStatusResponse {
  queueId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  runningNodeIds: string[];
  completedNodeIds: string[];
  results: Record<string, {
    output: string;
    error: string | null;
    metadata?: Record<string, unknown>;
  }>;
  executionLog: string[];
  iterations: number;
  error?: string | null;
}

/**
 * Execute workflow on backend (async via queue)
 * 
 * Sends workflow JSON to backend for asynchronous execution.
 * Returns queue ID for polling status.
 */
export const enqueueWorkflow = async (
  workflow: { nodes: unknown[]; edges: unknown[] }
): Promise<WorkflowExecuteResponse> => {
  try {
    const response = await fetch('/api/workflow/execute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(workflow),
    });

    const responseText = await response.text();

    if (!response.ok) {
      try {
        const errorData = JSON.parse(responseText);
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      } catch (parseError) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}. Response: ${responseText.slice(0, 200)}`);
      }
    }

    if (!responseText || responseText.trim().length === 0) {
      throw new Error('Empty response from server');
    }

    try {
      const data = JSON.parse(responseText) as WorkflowExecuteResponse;
      return data;
    } catch (parseError) {
      console.error('Failed to parse response:', responseText);
      throw new Error(`Invalid JSON response from server: ${responseText.slice(0, 200)}`);
    }
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Network error: ${String(error)}`);
  }
};

/**
 * Get workflow execution status by queue ID
 */
export const getWorkflowStatus = async (
  queueId: string
): Promise<WorkflowStatusResponse> => {
  try {
    const response = await fetch(`/api/workflow/${queueId}/status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const responseText = await response.text();

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Workflow execution ${queueId} not found`);
      }
      try {
        const errorData = JSON.parse(responseText);
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      } catch (parseError) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}. Response: ${responseText.slice(0, 200)}`);
      }
    }

    if (!responseText || responseText.trim().length === 0) {
      throw new Error('Empty response from server');
    }

    try {
      const data = JSON.parse(responseText) as WorkflowStatusResponse;
      return data;
    } catch (parseError) {
      console.error('Failed to parse response:', responseText);
      throw new Error(`Invalid JSON response from server: ${responseText.slice(0, 200)}`);
    }
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Network error: ${String(error)}`);
  }
};

