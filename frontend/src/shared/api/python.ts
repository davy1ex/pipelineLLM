/**
 * Python execution API client
 */

export interface PythonExecuteRequest {
  code: string;
}

export interface PythonExecuteResponse {
  output: string; // result from Python's 'output' variable, or stdout
  stdout?: string; // captured stdout
  stderr?: string; // captured stderr
  error?: string; // execution error
}

export interface PythonError {
  error: string;
}

/**
 * Execute Python code through backend
 */
export const executePython = async (request: PythonExecuteRequest): Promise<PythonExecuteResponse> => {
  try {
    const response = await fetch('/api/python/execute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code: request.code,
      }),
    });

    const responseText = await response.text();
    
    if (!response.ok) {
      try {
        const errorData = JSON.parse(responseText) as PythonError;
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      } catch (parseError) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}. Response: ${responseText.slice(0, 200)}`);
      }
    }

    if (!responseText || responseText.trim().length === 0) {
      throw new Error('Empty response from server');
    }

    try {
      const data = JSON.parse(responseText) as PythonExecuteResponse;
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

