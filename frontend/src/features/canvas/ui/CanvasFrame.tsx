import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  Handle,
  Position,
  SelectionMode,
  type NodeTypes,
  type NodeProps,
  useReactFlow,
  PanOnScrollMode,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useWorkflowStore } from '../model';
import { TextInputNode, OllamaNode, SettingsNode, OutputNode, PythonNode, FileWriterNode, DoclingNode } from '../../../entities/nodes';
import { useEffect, useState } from 'react';

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

// Component to handle shift+scroll for zoom
const ZoomOnShiftScroll = () => {
  const { zoomIn, zoomOut } = useReactFlow();

  useEffect(() => {
    const handleWheel = (event: WheelEvent) => {
      // Only handle zoom when shift is pressed
      if (event.shiftKey) {
        const reactFlowElement = document.querySelector('.react-flow');
        if (reactFlowElement && event.target instanceof Node && reactFlowElement.contains(event.target)) {
          event.preventDefault();
          event.stopPropagation();
          
          // Zoom based on scroll direction
          if (event.deltaY > 0) {
            zoomOut();
          } else {
            zoomIn();
          }
        }
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      window.removeEventListener('wheel', handleWheel);
    };
  }, [zoomIn, zoomOut]);

  return null;
};

// Component to handle pan on drag with middle/right mouse button
const PanOnMiddleRightDrag = () => {
  const { getViewport, setViewport } = useReactFlow();
  const [isPanning, setIsPanning] = useState(false);
  const [lastPosition, setLastPosition] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const handleMouseDown = (event: MouseEvent) => {
      // Only handle middle (1) or right (2) mouse button
      if (event.button === 1 || event.button === 2) {
        const reactFlowElement = document.querySelector('.react-flow');
        if (reactFlowElement && reactFlowElement.contains(event.target as Node)) {
          event.preventDefault();
          setIsPanning(true);
          setLastPosition({ x: event.clientX, y: event.clientY });
        }
      }
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (isPanning && lastPosition) {
        const viewport = getViewport();
        const deltaX = event.clientX - lastPosition.x;
        const deltaY = event.clientY - lastPosition.y;
        
        setViewport({
          x: viewport.x - deltaX / viewport.zoom,
          y: viewport.y - deltaY / viewport.zoom,
          zoom: viewport.zoom
        });
        
        setLastPosition({ x: event.clientX, y: event.clientY });
      }
    };

    const handleMouseUp = () => {
      setIsPanning(false);
      setLastPosition(null);
    };

    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    // Prevent context menu on right click
    window.addEventListener('contextmenu', (e) => {
      const reactFlowElement = document.querySelector('.react-flow');
      if (reactFlowElement && reactFlowElement.contains(e.target as Node)) {
        e.preventDefault();
      }
    });

    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isPanning, lastPosition, getViewport, setViewport]);

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
        // Selection box for multi-select (drag with left mouse button on empty area)
        selectionMode={SelectionMode.Full}
        // Enable lasso/area selection by dragging on empty pane
        // @ts-ignore - selectionOnDrag may not be in types but exists in runtime
        selectionOnDrag={true}
        // Pan on scroll: use scroll wheel for panning (both vertical and horizontal)
        panOnScroll={true}
        panOnScrollMode={PanOnScrollMode.Free}
        // Pan on drag: disable default pan on drag to allow selection box
        // Use middle (1) or right (2) mouse button for panning instead
        panOnDrag={false} // Disable pan on drag with left button to allow selection box
        // Zoom: shift+scroll for zoom, pinch for zoom on trackpad
        zoomOnScroll={false} // Disable zoom on scroll (use shift+scroll instead via ZoomOnShiftScroll component)
        zoomOnPinch={true}
        zoomOnDoubleClick={true}
        // Allow selecting nodes when dragging selection box (not when dragging individual nodes)
        // This should work with selectionMode.Full
        selectNodesOnDrag={true}
        // Enable node selection and dragging
        nodesDraggable={true}
        nodesConnectable={true}
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
        onSelectionChange={(params) => {
          console.log('[CanvasFrame] Selection changed:', {
            nodes: params.nodes.map(n => n.id),
            edges: params.edges.map(e => e.id),
            count: params.nodes.length
          });
        }}
        onPaneClick={() => {
          console.log('[CanvasFrame] Pane clicked - clearing selection');
        }}
      >
        <ViewportCenterProvider />
        <ZoomOnShiftScroll />
        <PanOnMiddleRightDrag />
        <Controls />
        <MiniMap />
        <Background gap={12} size={1} />
      </ReactFlow>
    </div>
  );
}


