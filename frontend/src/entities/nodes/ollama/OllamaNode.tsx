import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useNodeActions } from '../../../features/canvas/ui/NodeActionsContext';
import { HandleLabel } from '../../../shared/ui/HandleLabel';

export const OllamaNode = ({ id, data, type }: NodeProps) => {
  const { getIncomingData } = useNodeActions();
  const label: string = (data as any)?.label ?? 'Ollama Mock';
  const selfModel: string = (data as any)?.model ?? 'llama3.2';
  const temperature: number = (data as any)?.temperature ?? 0.7;
  // Read prompt from default incoming handle (e.g., TextInput -> Ollama)
  const promptData = (getIncomingData(id as string) as any) || {};
  const prompt: string | undefined = promptData.value ?? promptData.text;

  // Read config from connected Settings node via 'config' handle, override own defaults
  const config = (getIncomingData(id as string, 'config') as any) || {};
  const model: string = config.model ?? selfModel;
  const url: string | undefined = config.url;

  return (
    <div
      style={{
        width: 'auto',
        padding: '10px 14px',
        background: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        minWidth: 180,
        position: 'relative',
        boxSizing: 'border-box',
      }}
    >
      {/* main input (prompt) */}
      <Handle type="target" position={Position.Left} style={{ top: '30%' }} />
      <HandleLabel nodeType={type || 'ollama'} handleId="prompt" handleType="input" position="left" verticalPosition="30%" />
      
      {/* config input from Settings node */}
      <Handle id="config" type="target" position={Position.Left} style={{ top: '70%' }} />
      <HandleLabel nodeType={type || 'ollama'} handleId="config" handleType="input" position="left" verticalPosition="70%" />
      
      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 12, color: '#374151' }}>
        {url && <div><strong>URL:</strong> {url}</div>}
        <div><strong>Model:</strong> {model}</div>
        <div><strong>Temp:</strong> {temperature}</div>
        {prompt && (
          <div style={{ marginTop: 6 }}>
            <strong>Prompt:</strong> <span style={{ color: '#6b7280' }}>{prompt.slice(0, 80)}{prompt.length > 80 ? '…' : ''}</span>
          </div>
        )}
        <div style={{ marginTop: 6, fontStyle: 'italic', color: '#6b7280' }}>
          Mock: no backend call
        </div>
      </div>
      <Handle type="source" position={Position.Right} />
      <HandleLabel nodeType={type || 'ollama'} handleId="output" handleType="output" position="right" />
    </div>
  );
};

