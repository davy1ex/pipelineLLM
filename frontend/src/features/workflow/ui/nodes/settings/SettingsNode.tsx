import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useWorkflowStore } from '../../../model';

export const SettingsNode = ({ id, data }: NodeProps) => {
  const nodes = useWorkflowStore((s) => s.nodes);
  const setNodes = useWorkflowStore((s) => s.setNodes);

  const label: string = (data as any)?.label ?? 'Settings';
  const url: string = (data as any)?.url ?? 'http://localhost:11434';
  const model: string = (data as any)?.model ?? 'llama3.2';

  const updateData = (updates: Record<string, unknown>) => {
    const updated = nodes.map((n) =>
      n.id === id ? { ...n, data: { ...(n.data as any), ...updates } } : n
    );
    setNodes(updated);
  };

  return (
    <div
      style={{
        padding: '12px 14px',
        background: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        minWidth: 240,
        position: 'relative',
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
      {/* Config goes out to the right; use handle id for clarity */}
      <Handle id="config" type="source" position={Position.Right} />
      <div style={{ position: 'absolute', right: -6, top: '50%', transform: 'translate(100%, -50%)', fontSize: 10, color: '#6b7280' }}>
        config
      </div>
    </div>
  );
};



