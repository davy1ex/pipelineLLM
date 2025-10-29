import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useNodeActions } from '../../../features/canvas/ui/NodeActionsContext';
import { HandleLabel } from '../../../shared/ui/HandleLabel';

export const SettingsNode = ({ id, data, type }: NodeProps) => {
  const { updateNodeData } = useNodeActions();

  const label: string = (data as any)?.label ?? 'Settings';
  const url: string = (data as any)?.url ?? 'http://localhost:11434';
  const model: string = (data as any)?.model ?? 'llama3.2';

  const updateData = (updates: Record<string, unknown>) => updateNodeData(id as string, updates);

  return (
    <div
      style={{
        width: 'auto',
        padding: '12px 14px',
        background: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        minWidth: 240,
        position: 'relative',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 12, color: '#374151' }}>
        <div style={{ marginBottom: 6 }}>
          <strong>URL:</strong>
          <input
            value={url}
            onChange={(e) => updateData({ url: e.target.value })}
            style={{
              fontSize: 12,
              padding: 4,
              marginTop: 2,
              width: '100%',
              border: '1px solid #d1d5db',
              borderRadius: 4,
            }}
          />
        </div>
        <div>
          <strong>Model:</strong>
          <input
            value={model}
            onChange={(e) => updateData({ model: e.target.value })}
            style={{
              fontSize: 12,
              padding: 4,
              marginTop: 2,
              width: '100%',
              border: '1px solid #d1d5db',
              borderRadius: 4,
            }}
          />
        </div>
      </div>
      <Handle id="config" type="source" position={Position.Right} />
      <HandleLabel nodeType={type || 'settings'} handleId="config" handleType="output" position="right" />
    </div>
  );
};

