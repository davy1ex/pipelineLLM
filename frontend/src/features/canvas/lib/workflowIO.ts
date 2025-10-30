import type { Node, Edge } from '@xyflow/react';

export interface WorkflowFile {
  version: number;
  nodes: Node[];
  edges: Edge[];
  exportedAt?: string;
}

/**
 * Export current workflow (nodes/edges) to a downloadable JSON file
 */
export function exportWorkflow(nodes: Node[], edges: Edge[], filename?: string) {
  const payload: WorkflowFile = {
    version: 1,
    nodes,
    edges,
    exportedAt: new Date().toISOString(),
  };

  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  a.href = url;
  a.download = filename || `pipeline-workflow-${ts}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Parse an imported workflow file and return nodes/edges
 */
export async function parseWorkflowFile(file: File): Promise<WorkflowFile> {
  const text = await file.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new Error('Invalid JSON file');
  }

  const wf = data as Partial<WorkflowFile>;
  if (!wf || !Array.isArray(wf.nodes) || !Array.isArray(wf.edges)) {
    throw new Error('Invalid workflow file: missing nodes/edges');
  }

  return {
    version: typeof wf.version === 'number' ? wf.version : 1,
    nodes: wf.nodes as Node[],
    edges: wf.edges as Edge[],
    exportedAt: wf.exportedAt,
  };
}


