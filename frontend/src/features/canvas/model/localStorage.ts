/**
 * localStorage utilities for workflow persistence
 */

const STORAGE_KEY = 'pipelineLLM_workflow';

export interface StoredWorkflow {
  nodes: unknown[];
  edges: unknown[];
  version?: number;
}

/**
 * Load workflow from localStorage
 */
export function loadWorkflowFromStorage(): StoredWorkflow | null {
  try {
    const item = localStorage.getItem(STORAGE_KEY);
    if (!item) return null;
    return JSON.parse(item) as StoredWorkflow;
  } catch (error) {
    console.error('Failed to load workflow from localStorage:', error);
    return null;
  }
}

/**
 * Save workflow to localStorage
 */
export function saveWorkflowToStorage(nodes: unknown[], edges: unknown[]): void {
  try {
    const workflow: StoredWorkflow = {
      nodes,
      edges,
      version: 1,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workflow));
  } catch (error) {
    console.error('Failed to save workflow to localStorage:', error);
  }
}

/**
 * Clear workflow from localStorage
 */
export function clearWorkflowFromStorage(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear workflow from localStorage:', error);
  }
}

