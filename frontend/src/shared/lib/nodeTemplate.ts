import type { Node } from '@xyflow/react';

export type NodeTemplate = {
  id: string;
  label: string;
  type: string;
  color?: string;
  category?: string;
  defaultData?: Record<string, unknown>;
  buildData?: () => Record<string, unknown>;
  buildPosition?: () => { x: number; y: number };
  createNode?: (id: string, position: { x: number; y: number }) => Node;
};

const defaultHorizontalPos = () => ({ x: Math.random() * 600 + 50, y: 200 });

export function buildNodeFromTemplates(templates: NodeTemplate[], templateId: string): Node | null {
  const tpl = templates.find((t) => t.id === templateId);
  if (!tpl) return null;
  
  // Support both createNode and buildData approaches
  if (tpl.createNode) {
    return tpl.createNode(`${tpl.id}-${Date.now()}`, tpl.buildPosition ? tpl.buildPosition() : defaultHorizontalPos());
  }
  
  const nodeData = tpl.buildData ? tpl.buildData() : { label: tpl.label };
  const node: Node = {
    id: `${tpl.id}-${Date.now()}`,
    type: tpl.type,
    position: tpl.buildPosition ? tpl.buildPosition() : defaultHorizontalPos(),
    data: nodeData,
  };
  // Set explicit width and height on the node if they exist in data
  // This helps ReactFlow understand the node dimensions immediately
  if (typeof (nodeData as any)?.width === 'number') {
    node.width = (nodeData as any).width;
  }
  if (typeof (nodeData as any)?.height === 'number') {
    node.height = (nodeData as any).height;
  }
  return node;
}

