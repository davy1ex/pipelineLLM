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

const defaultHorizontalPos = (centerPosition?: { x: number; y: number }) => {
  console.log('[nodeTemplate] defaultHorizontalPos called with centerPosition:', centerPosition);
  
  if (centerPosition) {
    // Use provided center position (viewport center)
    const result = { x: centerPosition.x - 100, y: centerPosition.y - 50 };
    console.log('[nodeTemplate] using centerPosition, result:', result);
    return result;
  }
  // Fallback to random position if no center provided
  const result = { x: Math.random() * 600 + 50, y: 200 };
  console.log('[nodeTemplate] no centerPosition, using random fallback:', result);
  return result;
};

export function buildNodeFromTemplates(
  templates: NodeTemplate[], 
  templateId: string,
  centerPosition?: { x: number; y: number }
): Node | null {
  console.log('[nodeTemplate] ========== buildNodeFromTemplates ==========');
  console.log('[nodeTemplate] templateId:', templateId);
  console.log('[nodeTemplate] centerPosition parameter:', centerPosition);
  
  const tpl = templates.find((t) => t.id === templateId);
  if (!tpl) {
    console.error('[nodeTemplate] template not found for id:', templateId);
    return null;
  }
  
  console.log('[nodeTemplate] template found:', {
    id: tpl.id,
    label: tpl.label,
    type: tpl.type,
    hasBuildPosition: !!tpl.buildPosition,
    hasCreateNode: !!tpl.createNode
  });
  
  // Calculate position: 
  // - If centerPosition is provided, use it (has priority over buildPosition)
  // - Otherwise, use buildPosition if provided
  // - Otherwise, use defaultHorizontalPos
  const position = centerPosition
    ? (() => {
        const pos = defaultHorizontalPos(centerPosition);
        console.log('[nodeTemplate] centerPosition provided, using it instead of buildPosition, result:', pos);
        return pos;
      })()
    : tpl.buildPosition 
      ? (() => {
          const pos = tpl.buildPosition!();
          console.log('[nodeTemplate] using tpl.buildPosition(), result:', pos);
          return pos;
        })()
      : defaultHorizontalPos(centerPosition);
  
  console.log('[nodeTemplate] final position calculated:', position);
  
  // Support both createNode and buildData approaches
  if (tpl.createNode) {
    const node = tpl.createNode(`${tpl.id}-${Date.now()}`, position);
    console.log('[nodeTemplate] node created via createNode:', {
      id: node.id,
      position: node.position
    });
    return node;
  }
  
  const nodeData = tpl.buildData ? tpl.buildData() : { label: tpl.label };
  const node: Node = {
    id: `${tpl.id}-${Date.now()}`,
    type: tpl.type,
    position,
    data: nodeData,
  };
  // Set explicit width and height on the node if they exist in data
  // This helps ReactFlow understand the node dimensions immediately
  if (typeof (nodeData as any)?.width === 'number') {
    node.width = (nodeData as any).width;
  }
  if (typeof (nodeData as any)?.height === 'number') {
    // NodeShell displays height as height*2, so we need to set node.height to height*2
    // for ReactFlow to correctly calculate selection box size
    node.height = (nodeData as any).height * 2;
  }
  
  console.log('[nodeTemplate] node created:', {
    id: node.id,
    type: node.type,
    position: node.position,
    'position.x': node.position.x,
    'position.y': node.position.y,
    width: node.width,
    height: node.height
  });
  console.log('[nodeTemplate] ========== END buildNodeFromTemplates ==========');
  
  return node;
}

