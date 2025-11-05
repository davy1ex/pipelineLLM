import type { NodeTemplate } from '../../../shared/lib/nodeTemplate';

export const doclingTemplate: NodeTemplate = {
  id: 'docling',
  label: '📄 Docling (to Markdown)',
  type: 'docling',
  color: '#6366F1',
  buildData: () => ({ label: '📄 Docling (to Markdown)', width: 520, height: 220 }),
  buildPosition: () => ({ x: Math.random() * 600 + 50, y: 200 }),
};




