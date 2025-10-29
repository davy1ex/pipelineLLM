import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useNodeActions } from '../../../features/canvas/ui/NodeActionsContext';
import { HandleLabel } from '../../../shared/ui/HandleLabel';

export const OutputNode = ({ id, data, type }: NodeProps) => {
  const { getIncomingData } = useNodeActions();
  const label: string = (data as any)?.label ?? 'Output Preview';
  
  // Get text from connected node (e.g., Ollama output)
  const incomingData = (getIncomingData(id as string) as any) || {};
  const text: string = incomingData.text || incomingData.output || incomingData.value || (data as any)?.text || '';

  return (
    <div
      style={{
        width: 'auto',
        padding: '10px 14px',
        background: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        minWidth: 240,
        position: 'relative',
        boxSizing: 'border-box',
      }}
    >
      <Handle type="target" position={Position.Left} />
      <HandleLabel nodeType={type || 'output'} handleId="text" handleType="input" position="left" />
      
      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>{label}</div>
      <div
        style={{
          minHeight: 70,
          fontSize: 12,
          padding: 8,
          border: '1px solid #e5e7eb',
          borderRadius: 6,
          background: '#fafafa',
          whiteSpace: 'pre-wrap',
          boxSizing: 'border-box',
          wordBreak: 'break-word',
          overflow: 'hidden',
        }}
      >
        {text || 'No content yet'}
      </div>
    </div>
  );
};

