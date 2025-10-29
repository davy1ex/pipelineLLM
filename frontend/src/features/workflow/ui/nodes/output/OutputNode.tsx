import { Handle, Position, type NodeProps } from '@xyflow/react';

export const OutputNode = ({ data }: NodeProps) => {
  const label: string = (data as any)?.label ?? 'Output Preview';
  const text: string = (data as any)?.text ?? '';

  return (
    <div
      style={{
        padding: '10px 14px',
        background: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        minWidth: 240,
        position: 'relative',
      }}
    >
      <Handle type="target" position={Position.Left} />
      <div style={{ position: 'absolute', left: -6, top: '50%', transform: 'translateX(-100%) translateY(-50%)', fontSize: 10, color: '#6b7280' }}>
        text
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>{label}</div>
      <div
        style={{
          width: 220,
          minHeight: 70,
          fontSize: 12,
          padding: 8,
          border: '1px solid #e5e7eb',
          borderRadius: 6,
          background: '#fafafa',
          whiteSpace: 'pre-wrap',
        }}
      >
        {text || 'No content yet'}
      </div>
    </div>
  );
};


