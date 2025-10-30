import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useNodeActions } from '../../../features/canvas/ui/NodeActionsContext';
import { HandleLabel } from '../../../shared/ui/HandleLabel';
import { NodeShell } from '../../../shared/ui/NodeShell';

export const OllamaNode = ({ id, data, type }: NodeProps) => {
  const { getIncomingData } = useNodeActions();
  const label: string = (data as any)?.label ?? 'Ollama Mock';
  const selfModel: string = (data as any)?.model ?? 'llama3.2';
  const temperature: number = (data as any)?.temperature ?? 0.7;
  // Read prompt from default incoming handle (e.g., TextInput -> Ollama or Ollama -> Ollama)
  const promptData = (getIncomingData(id as string, 'prompt') as any) || getIncomingData(id as string) || {};
  const prompt: string | undefined = promptData.value ?? promptData.text ?? promptData.output;

  // Read system prompt from systemPrompt handle
  const systemPromptData = (getIncomingData(id as string, 'systemPrompt') as any) || {};
  const systemPrompt: string | undefined = systemPromptData.value ?? systemPromptData.text;

  // Read config from connected Settings node via 'config' handle, override own defaults
  const config = (getIncomingData(id as string, 'config') as any) || {};
  const model: string = config.model ?? selfModel;
  const url: string | undefined = config.url;

  // Build stacked controls (each on its own row)
  const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);
  const controls = [
    ...(url ? [{ key: 'url', label: `URL: ${url}` }] : []),
    { key: 'model', label: `Model: ${model}` },
    { key: 'temp', label: `Temp: ${temperature}` },
    ...(prompt ? [{ key: 'prompt', label: `Prompt: ${truncate(prompt, 80)}` }] : []),
    ...(systemPrompt ? [{ key: 'system', label: `System: ${truncate(systemPrompt, 60)}` }] : []),
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

