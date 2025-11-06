import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  Handle,
  Position,
  type NodeTypes,
  type NodeProps,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useWorkflowStore } from '../model';
import { TextInputNode, OllamaNode, SettingsNode, OutputNode, PythonNode, FileWriterNode, DoclingNode } from '../../../entities/nodes';
import { useEffect } from 'react';

// Define nodeTypes outside component to avoid recreation on each render
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
  python: PythonNode,
  fileWriter: FileWriterNode,
  docling: DoclingNode,
};

// Component inside ReactFlow to provide viewport center getter
const ViewportCenterProvider = () => {
  const { screenToFlowPosition } = useReactFlow();
  const setViewportCenterGetter = useWorkflowStore((state) => state.setViewportCenterGetter);
  const viewport = useWorkflowStore((state) => state.viewport);

  useEffect(() => {
    // Provide function to get viewport center
    // This function is called every time a node is added, so it always uses current viewport
    const getCenter = () => {
      // Get ReactFlow container element to get its center in screen coordinates
      const reactFlowElement = document.querySelector('.react-flow');
      if (!reactFlowElement) {
        // Fallback: use window center
        const centerScreenX = window.innerWidth / 2;
        const centerScreenY = window.innerHeight / 2;
        const result = screenToFlowPosition({
          x: centerScreenX,
          y: centerScreenY,
        });
        console.log('[ViewportCenterProvider] fallback - center flow coords:', result);
        return result;
      }

      // Get canvas bounds in screen coordinates
      const rect = reactFlowElement.getBoundingClientRect();
      
      // Calculate center of canvas in screen coordinates
      const centerScreenX = rect.left + rect.width / 2;
      const centerScreenY = rect.top + rect.height / 2;
      
      // Convert screen coordinates to flow coordinates using ReactFlow's built-in function
      // screenToFlowPosition automatically uses current viewport and zoom
      const centerFlow = screenToFlowPosition({
        x: centerScreenX,
        y: centerScreenY,
      });
      
      console.log('[ViewportCenterProvider] canvas rect:', {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height
      });
      console.log('[ViewportCenterProvider] center screen coords:', centerScreenX, centerScreenY);
      console.log('[ViewportCenterProvider] current viewport:', viewport);
      console.log('[ViewportCenterProvider] center flow coords:', centerFlow);
      
      return centerFlow;
    };

    setViewportCenterGetter(getCenter);

    return () => {
      setViewportCenterGetter(() => null);
    };
  }, [screenToFlowPosition, setViewportCenterGetter, viewport]);

  return null;
};

export const CanvasFrame = () => {
  const nodes = useWorkflowStore((state) => state.nodes);
  const edges = useWorkflowStore((state) => state.edges);
  const onNodesChange = useWorkflowStore((state) => state.onNodesChange);
  const onEdgesChange = useWorkflowStore((state) => state.onEdgesChange);
  const onConnect = useWorkflowStore((state) => state.onConnect);

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
        onMove={(_event, viewport) => {
          console.log('[CanvasFrame] onMove - viewport changed:', {
            x: viewport.x,
            y: viewport.y,
            zoom: viewport.zoom,
            source: 'onMove'
          });
          const setViewport = useWorkflowStore.getState().setViewport;
          setViewport({ x: viewport.x, y: viewport.y, zoom: viewport.zoom });
        }}
        onMoveStart={(_event, viewport) => {
          console.log('[CanvasFrame] onMoveStart - viewport changed:', {
            x: viewport.x,
            y: viewport.y,
            zoom: viewport.zoom,
            source: 'onMoveStart'
          });
          const setViewport = useWorkflowStore.getState().setViewport;
          setViewport({ x: viewport.x, y: viewport.y, zoom: viewport.zoom });
        }}
      >
        <ViewportCenterProvider />
        <Controls />
        <MiniMap />
        <Background gap={12} size={1} />
      </ReactFlow>
    </div>
  );
}


