import type { NodeTemplate } from '../../../model/nodeRegistry';

export const outputTemplate: NodeTemplate = {
  id: 'output',
  label: '📤 Output',
  type: 'output',
  color: '#FF9800',
  buildData: () => ({ label: '📤 Output', text: '' }),
  buildPosition: () => ({ x: Math.random() * 600 + 50, y: 200 }),
};


