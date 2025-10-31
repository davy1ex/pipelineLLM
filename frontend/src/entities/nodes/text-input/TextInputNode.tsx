import React from 'react'
import { Position, type NodeProps } from '@xyflow/react';
import { useNodeActions } from '../../../features/canvas/ui/NodeActionsContext';
// import { HandleLabel } from '../../../shared/ui/HandleLabel';
import { NodeShell } from '../../../shared/ui/NodeShell';

export const TextInputNode = ({ id, data, type }: NodeProps) => {
  const { updateNodeData } = useNodeActions();

  const value: string = (data as any)?.value ?? '';
  const label: string = (data as any)?.label ?? 'Text Input';

  // Prevent caret jump: keep local state and sync outward
  const [localValue, setLocalValue] = React.useState<string>(value);
  React.useEffect(() => {
    setLocalValue(value);
  }, [value, id]);
  const updateValue = (next: string) => {
    setLocalValue(next);
    requestAnimationFrame(() => updateNodeData(id as string, { value: next }));
  };

  return (
    <NodeShell
      nodeId={id as string}
      title={label}
      connectors={[
        { id: 'output', type: 'source', position: Position.Right, label: 'output', dataType: 'string' },
      ]}
      controls={[
        { key: 'value', label: 'value', value: localValue, placeholder: 'Enter text...' },
      ]}
    >
      <textarea
        value={localValue}
        onChange={(e) => updateValue(e.target.value)}
        placeholder="Enter text..."
        style={{
          width: '100%',
          height: 80,
          fontSize: 12,
          padding: 8,
          border: '1px solid #e5e7eb',
          borderRadius: 6,
          resize: 'vertical',
          boxSizing: 'border-box',
          background: '#fff',
        }}
      />
    </NodeShell>
  );
};

