import { create } from 'zustand';
import type {
  Node,
  Edge,
  OnNodesChange,
  OnEdgesChange,
  OnConnect,
} from '@xyflow/react';
import {
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
} from '@xyflow/react';
import {
  loadWorkflowFromStorage,
  saveWorkflowToStorage,
  clearWorkflowFromStorage,
} from './localStorage';
import { getNodeHandles } from '../../../shared/lib/nodeHandles';
import { getDataTypeConfig, type DataType } from '../../../shared/lib/dataTypes';
import { MarkerType } from '@xyflow/react';

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

interface WorkflowState {
  nodes: Node[];
  edges: Edge[];
  viewport: Viewport | null;
  getViewportCenter: (() => { x: number; y: number } | null) | null;
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  setViewport: (viewport: Viewport) => void;
  setViewportCenterGetter: (getter: () => { x: number; y: number } | null) => void;
  addNode: (node: Node) => void;
  removeNode: (nodeId: string) => void;
  clearWorkflow: () => void;
  loadFromStorage: () => boolean;
}

// Helper to save after state changes (debounced)
let saveTimeout: ReturnType<typeof setTimeout> | null = null;
const saveToStorage = (nodes: Node[], edges: Edge[]) => {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    saveWorkflowToStorage(nodes, edges);
  }, 300); // Debounce saves by 300ms
};

// Load initial state from localStorage
const loadInitialState = () => {
  const stored = loadWorkflowFromStorage();
  if (stored && stored.nodes && stored.edges) {
    console.log('[workflowStore] Loading initial state from localStorage:', {
      nodesCount: stored.nodes.length,
      edgesCount: stored.edges.length,
    });
    return {
      nodes: stored.nodes as Node[],
      edges: stored.edges as Edge[],
    };
  }
  console.log('[workflowStore] No stored state found in localStorage');
  return {
    nodes: [] as Node[],
    edges: [] as Edge[],
  };
};

const initialState = loadInitialState();

function colorizeEdges(edges: Edge[], nodes: Node[]): Edge[] {
  return edges.map((e) => {
    const sourceNode = nodes.find((n) => n.id === e.source);
    if (!sourceNode) return e;
    const handles = getNodeHandles(sourceNode.type);
    const sourceHandleId = (e as any).sourceHandle as string | undefined;
    const h = (handles.outputs || []).find((x) => x.id === sourceHandleId) || (handles.outputs || [])[0];
    const dt = (h?.dataType || 'any') as DataType;
    const c = getDataTypeConfig(dt);
    const style = { ...(e.style || {}), stroke: c.borderColor, strokeWidth: 2 } as any;
    const markerEnd = { type: MarkerType.ArrowClosed, color: c.borderColor } as any;
    return { ...e, style, markerEnd } as Edge;
  });
}

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  nodes: initialState.nodes,
  edges: initialState.edges,
  viewport: null,
  getViewportCenter: null,

  onNodesChange: (changes) => {
    // Apply changes first
    const newNodes = applyNodeChanges(changes, get().nodes);
    
    // Fix node.height to match displayed height (displayHeight*2 for NodeShell nodes)
    // ReactFlow uses node.height for selection box, so it needs to match the actual displayed height
    // Only update if data.height changed to avoid infinite loops
    const updatedNodes = newNodes.map((node) => {
      // Check if node uses NodeShell (most nodes do)
      // NodeShell displays height as displayHeight*2, but node.height is stored as displayHeight
      // We need to update node.height to match the displayed height for proper selection box
      if (node.data && typeof (node.data as any).height === 'number') {
        const dataHeight = (node.data as any).height;
        const expectedHeight = dataHeight * 2;
        // Only update if height doesn't match (avoid infinite loops)
        if (node.height !== expectedHeight) {
          return { ...node, height: expectedHeight };
        }
      }
      return node;
    });
    
    // Only update if there were actual changes to avoid infinite loops
    const hasChanges = updatedNodes.some((node, idx) => node.height !== newNodes[idx]?.height);
    if (hasChanges) {
      set({ nodes: updatedNodes });
      saveToStorage(updatedNodes, get().edges);
    } else {
      set({ nodes: newNodes });
      saveToStorage(newNodes, get().edges);
    }
  },

  onEdgesChange: (changes) => {
    console.log('[workflowStore] onEdgesChange:', changes);
    const newEdges = colorizeEdges(applyEdgeChanges(changes, get().edges), get().nodes);
    console.log('[workflowStore] Edges after change:', newEdges.map(e => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle, targetHandle: e.targetHandle })));
    set({ edges: newEdges });
    saveToStorage(get().nodes, newEdges);
  },

  onConnect: (connection) => {
    console.log('[workflowStore] onConnect called:', connection);
    const stepConnection = { ...connection, type: 'step' } as any;
    const colored = colorizeEdges(addEdge(stepConnection, get().edges), get().nodes);
    console.log('[workflowStore] New edge added:', stepConnection);
    console.log('[workflowStore] Total edges now:', colored.length);
    set({ edges: colored });
    saveToStorage(get().nodes, colored);
  },

  setNodes: (nodes) => {
    set({ nodes });
    saveToStorage(nodes, get().edges);
  },

  setEdges: (edges) => {
    const colored = colorizeEdges(edges, get().nodes);
    set({ edges: colored });
    saveToStorage(get().nodes, colored);
  },

  setViewport: (viewport) => {
    set({ viewport });
  },

  setViewportCenterGetter: (getter) => {
    set({ getViewportCenter: getter });
  },

  addNode: (node) => {
    const newNodes = [...get().nodes, node];
    set({ nodes: newNodes });
    saveToStorage(newNodes, get().edges);
  },

  removeNode: (nodeId: string) => {
    const newNodes = get().nodes.filter((node) => node.id !== nodeId);
    const newEdges = get().edges.filter(
      (edge) => edge.source !== nodeId && edge.target !== nodeId
    );
    set({ nodes: newNodes, edges: newEdges });
    saveToStorage(newNodes, newEdges);
  },

  clearWorkflow: () => {
    set({ nodes: [], edges: [] });
    clearWorkflowFromStorage();
  },

  loadFromStorage: () => {
    const stored = loadWorkflowFromStorage();
    if (stored && stored.nodes && stored.edges) {
      console.log('[workflowStore] loadFromStorage: Loading', {
        nodesCount: stored.nodes.length,
        edgesCount: stored.edges.length,
      });
      set({
        nodes: stored.nodes as Node[],
        edges: stored.edges as Edge[],
      });
      return true;
    }
    console.log('[workflowStore] loadFromStorage: No data to load');
    return false;
  },
}));

