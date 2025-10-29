import type { Node, Edge } from '@xyflow/react';

export const getInitialNodes = (): Node[] => [
  {
    id: 'settings-1',
    type: 'settings',
    position: { x: 50, y: 140 },
    data: { label: '⚙️ Settings', url: 'http://localhost:11434', model: 'qwen3:8b' },
  },
  {
    id: 'input-1',
    type: 'textInput',
    position: { x: 100, y: 240 },
    data: { label: '📝 Text Input', value: '' },
  },
  {
    id: 'output-1',
    type: 'output',
    position: { x: 560, y: 240 },
    data: { label: '📤 Output', text: '' },
  },
];

export const getInitialEdges = (): Edge[] => [
  { id: 'e1-3', type: 'step', source: 'input-1', target: 'output-1' },
];

