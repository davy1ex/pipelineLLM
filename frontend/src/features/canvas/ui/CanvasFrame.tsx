import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  Handle,
  Position,
  type NodeTypes,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useWorkflowStore } from '../model';
import { TextInputNode, OllamaNode, SettingsNode, OutputNode } from '../../../entities/nodes';

export const CanvasFrame = () => {
  const nodes = useWorkflowStore((state) => state.nodes);
  const edges = useWorkflowStore((state) => state.edges);
  const onNodesChange = useWorkflowStore((state) => state.onNodesChange);
  const onEdgesChange = useWorkflowStore((state) => state.onEdgesChange);
  const onConnect = useWorkflowStore((state) => state.onConnect);

  const LeftRightNode = ({ data }: NodeProps) => {
    const title: string = (data as any)?.label ?? 'Node';
    return (
      <div style={{
        padding: '10px 14px',
        background: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
      }}>
        <Handle type="target" position={Position.Left} />
        <div style={{ fontSize: 12, fontWeight: 600 }}>{title}</div>
        <Handle type="source" position={Position.Right} />
      </div>
    );
  };

  const nodeTypes: NodeTypes = {
    lr: LeftRightNode,
    textInput: TextInputNode,
    ollama: OllamaNode,
    settings: SettingsNode,
    output: OutputNode,
  };

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
      >
        <Controls />
        <MiniMap />
        <Background gap={12} size={1} />
      </ReactFlow>
    </div>
  );
}


