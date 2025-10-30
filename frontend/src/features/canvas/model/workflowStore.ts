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

interface WorkflowState {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
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

  onNodesChange: (changes) => {
    const newNodes = applyNodeChanges(changes, get().nodes);
    set({ nodes: newNodes });
    saveToStorage(newNodes, get().edges);
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

