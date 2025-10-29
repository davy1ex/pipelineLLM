import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useNodeActions } from '../../../features/canvas/ui/NodeActionsContext';

export const OllamaNode = ({ id, data }: NodeProps) => {
  const { getIncomingData } = useNodeActions();
  const label: string = (data as any)?.label ?? 'Ollama Mock';
  const selfModel: string = (data as any)?.model ?? 'llama3.2';
  const temperature: number = (data as any)?.temperature ?? 0.7;
  // Read config from connected Settings node via 'config' handle, override own defaults
  const config = (getIncomingData(id as string, 'config') as any) || {};
  const model: string = config.model ?? selfModel;
  const url: string | undefined = config.url;

  return (
    <div
      style={{
        padding: '10px 14px',
        background: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        minWidth: 180,
        position: 'relative',
      }}
    >
      {/* main input (prompt) */}
      <Handle type="target" position={Position.Left} style={{ top: '30%' }} />
      <div style={{ position: 'absolute', left: -6, top: '30%', transform: 'translate(-100%, -50%)', fontSize: 10, color: '#6b7280' }}>
        prompt
      </div>
      {/* config input from Settings node */}
      <Handle id="config" type="target" position={Position.Left} style={{ top: '70%' }} />
      <div style={{ position: 'absolute', left: -6, top: '70%', transform: 'translate(-100%, -50%)', fontSize: 10, color: '#6b7280' }}>
        config
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 12, color: '#374151' }}>
        {url && <div><strong>URL:</strong> {url}</div>}
        <div><strong>Model:</strong> {model}</div>
        <div><strong>Temp:</strong> {temperature}</div>
        <div style={{ marginTop: 6, fontStyle: 'italic', color: '#6b7280' }}>
          Mock: no backend call
        </div>
      </div>
      <Handle type="source" position={Position.Right} />
      <div style={{ position: 'absolute', right: -6, top: '50%', transform: 'translate(100%, -50%)', fontSize: 10, color: '#6b7280' }}>
        output
      </div>
    </div>
  );
};

