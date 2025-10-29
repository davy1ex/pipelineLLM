import type { NodeTemplate } from '../../../model/nodeRegistry';

export const settingsTemplate: NodeTemplate = {
  id: 'settings',
  label: '⚙️ Settings',
  type: 'settings',
  color: '#607D8B',
  buildData: () => ({ label: '⚙️ Settings', url: 'http://localhost:11434', model: 'llama3.2' }),
  buildPosition: () => ({ x: Math.random() * 600 + 20, y: 140 }),
};


