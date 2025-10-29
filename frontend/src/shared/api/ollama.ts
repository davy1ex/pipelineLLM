/**
 * Ollama API client
 */

export interface OllamaChatRequest {
  url: string;
  model: string;
  prompt: string;
  temperature?: number;
}

export interface OllamaChatResponse {
  response: string;
  model: string;
  done: boolean;
}

export interface OllamaError {
  error: string;
}

/**
 * Call Ollama API through backend proxy
 */
export const callOllama = async (request: OllamaChatRequest): Promise<OllamaChatResponse> => {
  try {
    const response = await fetch('/api/ollama/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: request.url,
        model: request.model,
        prompt: request.prompt,
        temperature: request.temperature ?? 0.7,
      }),
    });

    // Get response text first to check if it's empty
    const responseText = await response.text();
    
    if (!response.ok) {
      // Try to parse error message
      try {
        const errorData = JSON.parse(responseText) as OllamaError;
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      } catch (parseError) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}. Response: ${responseText.slice(0, 200)}`);
      }
    }

    // Check if response is empty
    if (!responseText || responseText.trim().length === 0) {
      throw new Error('Empty response from server');
    }

    // Parse JSON response
    try {
      const data = JSON.parse(responseText) as OllamaChatResponse;
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

