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
    const newEdges = applyEdgeChanges(changes, get().edges);
    console.log('[workflowStore] Edges after change:', newEdges.map(e => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle, targetHandle: e.targetHandle })));
    set({ edges: newEdges });
    saveToStorage(get().nodes, newEdges);
  },

  onConnect: (connection) => {
    console.log('[workflowStore] onConnect called:', connection);
    const stepConnection = { ...connection, type: 'step' } as any;
    const newEdges = addEdge(stepConnection, get().edges);
    console.log('[workflowStore] New edge added:', stepConnection);
    console.log('[workflowStore] Total edges now:', newEdges.length);
    set({ edges: newEdges });
    saveToStorage(get().nodes, newEdges);
  },

  setNodes: (nodes) => {
    set({ nodes });
    saveToStorage(nodes, get().edges);
  },

  setEdges: (edges) => {
    set({ edges });
    saveToStorage(get().nodes, edges);
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

