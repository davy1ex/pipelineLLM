import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useNodeActions } from '../../../features/canvas/ui/NodeActionsContext';
import { HandleLabel } from '../../../shared/ui/HandleLabel';

export const TextInputNode = ({ id, data, type }: NodeProps) => {
  const { updateNodeData } = useNodeActions();

  const value: string = (data as any)?.value ?? '';
  const label: string = (data as any)?.label ?? 'Text Input';

  const updateValue = (next: string) => updateNodeData(id as string, { value: next });

  return (
    <div
      style={{
        width: 'auto',
        padding: '10px 14px',
        background: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        minWidth: 220,
        position: 'relative',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>{label}</div>
      <textarea
        value={value}
        onChange={(e) => updateValue(e.target.value)}
        placeholder="Enter text..."
        style={{
          width: '100%',
          maxWidth: 200,
          height: 70,
          fontSize: 12,
          padding: 8,
          border: '1px solid #e5e7eb',
          borderRadius: 6,
          resize: 'vertical',
          boxSizing: 'border-box',
        }}
      />
      <Handle type="source" position={Position.Right} />
      <HandleLabel nodeType={type || 'textInput'} handleId="output" handleType="output" position="right" />
    </div>
  );
};

