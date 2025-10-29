import type { NodeTemplate } from '../../../model/nodeRegistry';

export const textInputTemplate: NodeTemplate = {
  id: 'text-input',
  label: '📝 Text Input',
  type: 'textInput',
  color: '#4CAF50',
  buildData: () => ({ label: '📝 Text Input', value: '' }),
  buildPosition: () => ({ x: Math.random() * 600 + 50, y: 200 }),
};


