import type { NodeTemplate } from '../../../shared/lib/nodeTemplate'
import type { Node } from '@xyflow/react'

export const fileWriterTemplate: NodeTemplate = {
  id: 'file-writer',
  label: '💾 Save To File',
  type: 'fileWriter',
  category: 'io',
  defaultData: {
    label: '💾 Save To File',
    filename: 'result.txt',
  },
  createNode: (id: string, position: { x: number; y: number }): Node => ({
    id,
    type: 'fileWriter',
    position,
    data: {
      label: '💾 Save To File',
      filename: 'result.txt',
    },
  }),
}


