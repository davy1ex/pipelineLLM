import React from 'react';
import { Position, type NodeProps } from '@xyflow/react';
import { useNodeActions } from '../../../features/canvas/ui/NodeActionsContext';
import { NodeShell } from '../../../shared/ui/NodeShell';

export const PythonNode = ({ id, data }: NodeProps) => {
  const { updateNodeData, getIncomingData } = useNodeActions();

  const code: string = (data as any)?.code ?? '';
  const label: string = (data as any)?.label ?? 'Python';
  const output: string = (data as any)?.output ?? '';
  const lastError: string = (data as any)?.lastError ?? '';
  
  // Get input data from connected node (for display)
  const inputData = getIncomingData(id as string, 'input') as any;
  const inputValue: string = inputData?.value || inputData?.text || inputData?.output || '';

  // Local state to prevent caret jump
  const [localCode, setLocalCode] = React.useState<string>(code);
  React.useEffect(() => {
    setLocalCode(code);
  }, [code, id]);

  const updateCode = (next: string) => {
    setLocalCode(next);
    requestAnimationFrame(() => updateNodeData(id as string, { code: next }));
  };

  const controls = [
    ...(inputValue ? [{ key: 'input', label: `Input: ${inputValue.slice(0, 50)}${inputValue.length > 50 ? '...' : ''}`, fullValue: inputValue }] : []),
    ...(output ? [{ key: 'output', label: `Output: ${output.slice(0, 50)}${output.length > 50 ? '...' : ''}`, fullValue: output }] : []),
    ...(lastError ? [{ key: 'error', label: `Error: ${lastError.slice(0, 50)}${lastError.length > 50 ? '...' : ''}`, fullValue: lastError }] : []),
  ];

  return (
    <NodeShell
      nodeId={id as string}
      title={label}
      connectors={[
        { id: 'input', type: 'target', position: Position.Left, label: 'input', dataType: 'string' },
        { id: 'output', type: 'source', position: Position.Right, label: 'output', dataType: 'string' },
      ]}
      controls={controls}
    >
      <textarea
        value={localCode}
        onChange={(e) => updateCode(e.target.value)}
        placeholder="# Enter Python code...\n# Use 'data_input' to read from connected node (via 'input' connector):\n# data_input contains the string from the source node\noutput = f'Received: {data_input}'\n# Or: output = data_input.upper()"
        style={{
          width: '100%',
          minHeight: 120,
          fontSize: 12,
          fontFamily: 'monospace',
          padding: 8,
          border: '1px solid #e5e7eb',
          borderRadius: 6,
          resize: 'vertical',
          boxSizing: 'border-box',
          background: '#fff',
        }}
      />
      {output && (
        <div style={{ marginTop: 8, padding: 8, background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 4, fontSize: 11 }}>
          <strong>Last output:</strong> {output}
        </div>
      )}
      {lastError && (
        <div style={{ marginTop: 8, padding: 8, background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 4, fontSize: 11, color: '#dc2626' }}>
          <strong>Error:</strong> {lastError}
        </div>
      )}
    </NodeShell>
  );
};

