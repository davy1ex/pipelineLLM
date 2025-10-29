import type { NodeTemplate } from '../../../model/nodeRegistry';

export const ollamaMockTemplate: NodeTemplate = {
  id: 'ollama-mock',
  label: '🧪 Ollama Mock',
  type: 'ollama',
  color: '#9C27B0',
  buildData: () => ({ label: '🧪 Ollama Mock', model: 'llama3.2', temperature: 0.7 }),
  buildPosition: () => ({ x: Math.random() * 600 + 50, y: 200 }),
};


