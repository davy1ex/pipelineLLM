import type { NodeTemplate } from '../../../shared/lib/nodeTemplate';
import type { Node } from '@xyflow/react';

export const pythonTemplate: NodeTemplate = {
  id: 'python',
  label: '🐍 Python',
  type: 'python',
  category: 'processing',
  defaultData: {
    label: '🐍 Python',
    code: '# Enter Python code\n# Use data_input to read from connected node (via input connector)\noutput = data_input if data_input else "No input"',
    output: '',
  },
  createNode: (id: string, position: { x: number; y: number }): Node => ({
    id,
    type: 'python',
    position,
    data: {
      label: '🐍 Python',
      code: '# Enter Python code\n# Use data_input to read from connected node (via input connector)\noutput = data_input if data_input else "No input"',
      output: '',
      width: 500,
      height: 180,
    },
  }),
};

