import type { Node } from '@xyflow/react';

export type NodeTemplate = {
  id: string;
  label: string;
  type: string;
  color?: string;
  buildData?: () => Record<string, unknown>;
  buildPosition?: () => { x: number; y: number };
};

const defaultHorizontalPos = () => ({ x: Math.random() * 600 + 50, y: 200 });

export function buildNodeFromTemplates(templates: NodeTemplate[], templateId: string): Node | null {
  const tpl = templates.find((t) => t.id === templateId);
  if (!tpl) return null;
  return {
    id: `${tpl.id}-${Date.now()}`,
    type: tpl.type,
    position: tpl.buildPosition ? tpl.buildPosition() : defaultHorizontalPos(),
    data: tpl.buildData ? tpl.buildData() : { label: tpl.label },
  } as Node;
}

