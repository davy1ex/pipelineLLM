import { Position, type NodeProps } from '@xyflow/react';
import { useNodeActions } from '../../../features/canvas/ui/NodeActionsContext';
import { NodeShell } from '../../../shared/ui/NodeShell';

export const OllamaNode = ({ id, data, type }: NodeProps) => {
  const { getIncomingData, updateNodeData } = useNodeActions();
  const nodeData = (data as any) || {};
  const label: string = nodeData.label ?? 'Ollama';
  const selfModel: string = nodeData.model ?? 'llama3.2';
  const temperature: number = nodeData.temperature ?? 0.7;
  // Read prompt: ONLY from 'prompt' handle (do not fall back to generic incoming)
  const promptIncoming = ((getIncomingData(id as string, 'prompt') as any) || {}) as any;
  const promptIncomingValue: string | undefined = promptIncoming.value ?? promptIncoming.text ?? promptIncoming.output;
  const prompt: string | undefined = (promptIncomingValue !== undefined && promptIncomingValue !== null) ? promptIncomingValue : nodeData.prompt;

  // Read system prompt merging own data and incoming
  const systemIncoming = (getIncomingData(id as string, 'systemPrompt') as any) || {};
  const systemIncomingValue: string | undefined = systemIncoming.value ?? systemIncoming.text;
  const systemPrompt: string | undefined = (systemIncomingValue !== undefined && systemIncomingValue !== null) ? systemIncomingValue : nodeData.systemPrompt;

  // Merge config from own data and incoming 'config' handle (incoming overrides own)
  const configIncoming = (getIncomingData(id as string, 'config') as any) || {};
  const ownConfig = nodeData.config || {};
  const config = { ...ownConfig, ...configIncoming } as any;
  const model: string = config.model ?? selfModel;
  const url: string | undefined = config.url;

  // Build stacked controls (each on its own row)
  const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);
  const controls = [
    // ...(url ? [{ key: 'url', label: `URL: ${url}` }] : []),
    { key: 'model', value: model, label: `Model: ${model}`, editable: true, onChange: (next: any) => updateNodeData(id, {config: { model: next }}) },
    { key: 'url', value: url, label: `URL: ${url}`, editable: true, onChange: (next: any) => updateNodeData(id, {config: { url: next }}) },
    { key: 'temp', value: temperature.toString(), label: `Temp: ${temperature}`, editable: true, onChange: (next: any) => updateNodeData(id, {config: { temperature: parseFloat(next) }}) },
    { key: 'prompt', value: prompt, label: `Prompt: ${truncate(prompt ?? '', 80)}`, editable: true, onChange: (next: any) => updateNodeData(id, {prompt: next }) },
    { key: 'system', value: systemPrompt, label: `System prompt: ${truncate(systemPrompt ?? '', 60)}`, editable: true, onChange: (next: any) => updateNodeData(id, {systemPrompt: next}) },
  ];

  return (
    <NodeShell
      title={label}
      connectors={
        [
          { id: 'prompt', type: 'target', position: Position.Left, label: 'prompt', dataType: 'string' },
          { id: 'systemPrompt', type: 'target', position: Position.Left, label: 'systemPrompt', dataType: 'string' },
          { id: 'config', type: 'target', position: Position.Left, label: 'config', dataType: 'json' },
          { type: 'source', position: Position.Right, label: 'output', dataType: 'string' },
        ]
      }
      controls={controls}
    >
      <div style={{ fontSize: 12, color: '#6b7280', fontStyle: 'italic' }}>Mock: no backend call</div>
    </NodeShell>
  );
};

