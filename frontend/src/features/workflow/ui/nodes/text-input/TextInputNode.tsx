import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useWorkflowStore } from '../../../model';

export const TextInputNode = ({ id, data }: NodeProps) => {
  const nodes = useWorkflowStore((s) => s.nodes);
  const setNodes = useWorkflowStore((s) => s.setNodes);

  const value: string = (data as any)?.value ?? '';
  const label: string = (data as any)?.label ?? 'Text Input';

  const updateValue = (next: string) => {
    const updated = nodes.map((n) =>
      n.id === id ? { ...n, data: { ...(n.data as any), value: next } } : n
    );
    setNodes(updated);
  };

  return (
    <div
      style={{
        padding: '10px 14px',
        background: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        minWidth: 220,
        position: 'relative',
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>{label}</div>
      <textarea
        value={value}
        onChange={(e) => updateValue(e.target.value)}
        placeholder="Enter text..."
        style={{
          width: 200,
          height: 70,
          fontSize: 12,
          padding: 8,
          border: '1px solid #e5e7eb',
          borderRadius: 6,
          resize: 'vertical',
        }}
      />
      <Handle type="source" position={Position.Right} />
      <div style={{ position: 'absolute', right: -6, top: '50%', transform: 'translate(100%, -50%)', fontSize: 10, color: '#6b7280' }}>
        output
      </div>
    </div>
  );
};



