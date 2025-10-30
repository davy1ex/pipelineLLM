import { Position, type NodeProps } from '@xyflow/react';
import { useNodeActions } from '../../../features/canvas/ui/NodeActionsContext';
import { NodeShell } from '../../../shared/ui/NodeShell';

export const SettingsNode = ({ id, data }: NodeProps) => {
  const { updateNodeData } = useNodeActions();

  const label: string = (data as any)?.label ?? 'Settings';
  const url: string = (data as any)?.url ?? 'http://localhost:11434';
  const model: string = (data as any)?.model ?? 'llama3.2';

  const updateData = (updates: Record<string, unknown>) => updateNodeData(id as string, updates);

  return (
    <NodeShell
      title={label}
      connectors={[
        { id: 'config', type: 'source', position: Position.Right, label: 'config', dataType: 'json' },
      ]}
      controls={[
        {
          key: 'url',
          label: `URL: ${url}`,
          editable: true,
          value: url,
          placeholder: 'http://localhost:11434',
          onChange: (next) => updateData({ url: next }),
        },
        {
          key: 'model',
          label: `Model: ${model}`,
          editable: true,
          value: model,
          placeholder: 'llama3.2',
          onChange: (next) => updateData({ model: next }),
        },
      ]}
    >
    </NodeShell>
  );
};

