import type { NodeTemplate } from '../../../shared/lib/nodeTemplate';

export const textInputTemplate: NodeTemplate = {
  id: 'text-input',
  label: '📝 Text Input',
  type: 'textInput',
  color: '#4CAF50',
  buildData: () => ({ label: '📝 Text Input', value: '', width: 400, height: 120 }),
  buildPosition: () => ({ x: Math.random() * 600 + 50, y: 200 }),
};

