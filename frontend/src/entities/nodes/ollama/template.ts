import type { NodeTemplate } from '../../../shared/lib/nodeTemplate';

export const ollamaMockTemplate: NodeTemplate = {
  id: 'ollama',
  label: '🧪 Ollama',
  type: 'ollama',
  color: '#9C27B0',
  buildData: () => ({ label: '🧪 Ollama', model: 'llama3.2', temperature: 0.7, width: 155, height: 200 }),
  buildPosition: () => ({ x: Math.random() * 600 + 50, y: 200 }),
};

