import React from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useNodeActions } from '../../../features/canvas/ui/NodeActionsContext';
import { HandleLabel } from '../../../shared/ui/HandleLabel';

export const OutputNode = ({ id, data, type }: NodeProps) => {
  const { getIncomingData } = useNodeActions();
  const label: string = (data as any)?.label ?? 'Output Preview';
  
  // Priority: 1) data.text (updated from workflow execution), 2) incoming data from connected node
  const nodeText = (data as any)?.text || '';
  const incomingData = (getIncomingData(id as string) as any) || {};
  const incomingText = incomingData.text || incomingData.output || incomingData.value || '';
  
  // Use node's own text if set (from workflow execution), otherwise use incoming data
  const text: string = nodeText || incomingText;
  
  // Debug logging - only log when text changes or on first render
  // Use a ref to track previous text to avoid spam
  const prevTextRef = React.useRef<string>('');
  const hasChanged = prevTextRef.current !== text;
  
  if (hasChanged || !prevTextRef.current) {
    console.log(`[OutputNode ${id}] ${hasChanged ? '🔄 TEXT CHANGED' : '🆕 FIRST RENDER'}:`, {
      nodeText: nodeText,
      nodeTextLength: nodeText?.length || 0,
      incomingText: incomingText,
      incomingTextLength: incomingText?.length || 0,
      finalText: text,
      finalTextLength: text?.length || 0,
      dataKeys: Object.keys(data || {}),
      willDisplay: text || 'No content yet',
    });
    prevTextRef.current = text;
  }

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

