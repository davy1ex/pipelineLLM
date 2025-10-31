# Workflow Store Documentation

## Overview

`workflowStore` is a Zustand store that manages the entire state of the workflow canvas, including nodes, edges, and all operations on them.

**Location**: `features/workflow/model/workflowStore.ts`

## Why Zustand?

We chose Zustand over Redux because:
- ✅ **Minimal boilerplate** - No actions, reducers, or middleware setup
- ✅ **No providers** - Works without context providers
- ✅ **Simple API** - Easy to learn and use
- ✅ **TypeScript friendly** - Great type inference
- ✅ **Performance** - Optimized re-renders with selectors
- ✅ **DevTools support** - Compatible with Redux DevTools

## Store Structure

```typescript
interface WorkflowState {
  // State
  nodes: Node[];
  edges: Edge[];
  
  // ReactFlow event handlers
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  
  // CRUD actions
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  addNode: (node: Node) => void;
  removeNode: (nodeId: string) => void;
  clearWorkflow: () => void;
}
```

## State Properties

### `nodes: Node[]`

Array of all nodes in the workflow.

**Node Structure:**
```typescript
{
  id: string;           // Unique identifier
  type: string;         // Node type ('default', 'input', 'output')
  position: {           // Canvas position
    x: number;
    y: number;
  };
  data: {               // Custom node data
    label: string;
    // ... other custom fields
  };
}
```

**Example:**
```typescript
const nodes = useWorkflowStore((state) => state.nodes);

console.log(nodes);
// [
//   { id: 'input-1', type: 'default', position: { x: 100, y: 100 }, data: { label: '📝 Text Input' } },
//   { id: 'llm-1', type: 'default', position: { x: 300, y: 100 }, data: { label: '🤖 LLM Node' } },
// ]
```

### `edges: Edge[]`

Array of all edges (connections) between nodes.

**Edge Structure:**
```typescript
{
  id: string;           // Unique identifier
  type?: string;        // Edge type ('default', 'step', 'smoothstep')
  source: string;       // Source node ID
  target: string;       // Target node ID
  sourceHandle?: string;
  targetHandle?: string;
}
```

**Example:**
```typescript
const edges = useWorkflowStore((state) => state.edges);

console.log(edges);
// [
//   { id: 'e1-2', type: 'step', source: 'input-1', target: 'llm-1' }
// ]
```

## Actions

### `setNodes(nodes: Node[]): void`

Replace all nodes with a new array.

**Use case**: Initial workflow load, reset to saved state.

**Example:**
```typescript
const setNodes = useWorkflowStore((state) => state.setNodes);

// Load initial nodes
setNodes(getInitialNodes());

// Load from saved workflow
const savedNodes = JSON.parse(localStorage.getItem('workflow'));
setNodes(savedNodes);
```

### `setEdges(edges: Edge[]): void`

Replace all edges with a new array.

**Use case**: Initial workflow load, reset to saved state.

**Example:**
```typescript
const setEdges = useWorkflowStore((state) => state.setEdges);

// Load initial edges
setEdges(getInitialEdges());

// Clear all connections
setEdges([]);
```

### `addNode(node: Node): void`

Add a new node to the workflow.

**Use case**: User clicks "Add Node" button, programmatic node creation.

**Example:**
```typescript
const addNode = useWorkflowStore((state) => state.addNode);

// Add text input node
addNode({
  id: `input-${Date.now()}`,
  type: 'default',
  position: { x: 100, y: 100 },
  data: { label: '📝 Text Input' },
});

// Add LLM node
addNode({
  id: `llm-${Date.now()}`,
  type: 'default',
  position: { x: 300, y: 100 },
  data: { label: '🤖 LLM Node' },
});
```

**Implementation:**
```typescript
addNode: (node) => {
  set({
    nodes: [...get().nodes, node],
  });
}
```

### `removeNode(nodeId: string): void`

Remove a node and all its connected edges.

**Use case**: User deletes a node, cleanup operations.

**Example:**
```typescript
const removeNode = useWorkflowStore((state) => state.removeNode);

// Remove node by ID
removeNode('input-1');

// Removes:
// - The node with id 'input-1'
// - All edges connected to this node
```

**Implementation:**
```typescript
removeNode: (nodeId) => {
  set({
    nodes: get().nodes.filter((node) => node.id !== nodeId),
    edges: get().edges.filter(
      (edge) => edge.source !== nodeId && edge.target !== nodeId
    ),
  });
}
```

### `clearWorkflow(): void`

Remove all nodes and edges from the workflow.

**Use case**: Reset canvas, start new workflow.

**Example:**
```typescript
const clearWorkflow = useWorkflowStore((state) => state.clearWorkflow);

// Clear everything
clearWorkflow();

// Result: nodes = [], edges = []
```

**Implementation:**
```typescript
clearWorkflow: () => {
  set({
    nodes: [],
    edges: [],
  });
}
```

## ReactFlow Handlers

### `onNodesChange: OnNodesChange`

Handles node updates from ReactFlow (drag, select, remove).

**Handled automatically by ReactFlow.**

**Implementation:**
```typescript
onNodesChange: (changes) => {
  set({
    nodes: applyNodeChanges(changes, get().nodes),
  });
}
```

**Change Types:**
- `position` - Node dragged
- `select` - Node selected/deselected
- `remove` - Node removed
- `dimensions` - Node resized

### `onEdgesChange: OnEdgesChange`

Handles edge updates from ReactFlow (select, remove).

**Handled automatically by ReactFlow.**

**Implementation:**
```typescript
onEdgesChange: (changes) => {
  set({
    edges: applyEdgeChanges(changes, get().edges),
  });
}
```

**Change Types:**
- `select` - Edge selected/deselected
- `remove` - Edge removed

### `onConnect: OnConnect`

Handles new edge creation when user connects two nodes.

**Triggered when user drags from one node handle to another.**

**Implementation:**
```typescript
onConnect: (connection) => {
  set({
    edges: addEdge(connection, get().edges),
  });
}
```

**Connection Structure:**
```typescript
{
  source: string;        // Source node ID
  target: string;        // Target node ID
  sourceHandle?: string;
  targetHandle?: string;
}
```

## Usage Examples

### Basic Usage in Component

```typescript
import { useWorkflowStore } from '../../features/workflow';

export const MyComponent = () => {
  // Subscribe to specific state
  const nodes = useWorkflowStore((state) => state.nodes);
  const addNode = useWorkflowStore((state) => state.addNode);
  
  const handleAddNode = () => {
    addNode({
      id: `node-${Date.now()}`,
      type: 'default',
      position: { x: 100, y: 100 },
      data: { label: 'New Node' },
    });
  };
  
  return (
    <div>
      <button onClick={handleAddNode}>Add Node</button>
      <div>Total nodes: {nodes.length}</div>
    </div>
  );
};
```

### Multiple Selectors

```typescript
// Subscribe to multiple pieces of state
const nodes = useWorkflowStore((state) => state.nodes);
const edges = useWorkflowStore((state) => state.edges);
const addNode = useWorkflowStore((state) => state.addNode);

// Or destructure from one call (re-renders on any change)
const { nodes, edges, addNode } = useWorkflowStore();
```

### Performance Optimization

```typescript
// ✅ Good - Only re-renders when nodes change
const nodes = useWorkflowStore((state) => state.nodes);

// ✅ Good - Only re-renders when node count changes
const nodeCount = useWorkflowStore((state) => state.nodes.length);

// ❌ Bad - Re-renders on ANY store change
const store = useWorkflowStore();
const nodes = store.nodes;
```

### Computed Values

```typescript
// Get node count
const nodeCount = useWorkflowStore((state) => state.nodes.length);

// Get edge count
const edgeCount = useWorkflowStore((state) => state.edges.length);

// Check if workflow is empty
const isEmpty = useWorkflowStore(
  (state) => state.nodes.length === 0 && state.edges.length === 0
);

// Get specific node
const getNode = (id: string) => 
  useWorkflowStore((state) => 
    state.nodes.find((node) => node.id === id)
  );
```

### Integration with ReactFlow

```typescript
import { ReactFlow } from '@xyflow/react';
import { useWorkflowStore } from '../../features/workflow';

export const WorkFlowFrame = () => {
  // Get state and handlers
  const nodes = useWorkflowStore((state) => state.nodes);
  const edges = useWorkflowStore((state) => state.edges);
  const onNodesChange = useWorkflowStore((state) => state.onNodesChange);
  const onEdgesChange = useWorkflowStore((state) => state.onEdgesChange);
  const onConnect = useWorkflowStore((state) => state.onConnect);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
    />
  );
};
```

## Common Patterns

### Initialize Workflow

```typescript
useEffect(() => {
  const setNodes = useWorkflowStore.getState().setNodes;
  const setEdges = useWorkflowStore.getState().setEdges;
  
  // Load demo workflow
  if (nodes.length === 0) {
    setNodes(getInitialNodes());
    setEdges(getInitialEdges());
  }
}, []);
```

### Save Workflow

```typescript
const saveWorkflow = () => {
  const { nodes, edges } = useWorkflowStore.getState();
  
  const workflow = {
    nodes,
    edges,
    version: '1.0',
    timestamp: Date.now(),
  };
  
  localStorage.setItem('workflow', JSON.stringify(workflow));
  // or send to backend
};
```

### Load Workflow

```typescript
const loadWorkflow = () => {
  const workflow = JSON.parse(localStorage.getItem('workflow'));
  
  if (workflow) {
    useWorkflowStore.getState().setNodes(workflow.nodes);
    useWorkflowStore.getState().setEdges(workflow.edges);
  }
};
```

### Add Multiple Nodes

```typescript
const addMultipleNodes = () => {
  const { nodes, setNodes } = useWorkflowStore.getState();
  
  const newNodes = [
    { id: 'n1', type: 'default', position: { x: 0, y: 0 }, data: { label: 'Node 1' } },
    { id: 'n2', type: 'default', position: { x: 200, y: 0 }, data: { label: 'Node 2' } },
    { id: 'n3', type: 'default', position: { x: 400, y: 0 }, data: { label: 'Node 3' } },
  ];
  
  setNodes([...nodes, ...newNodes]);
};
```

### Dynamic Node Position

```typescript
const addNodeAtRandomPosition = () => {
  const addNode = useWorkflowStore.getState().addNode;
  
  addNode({
    id: `node-${Date.now()}`,
    type: 'default',
    position: {
      x: Math.random() * 500,
      y: Math.random() * 500,
    },
    data: { label: 'Random Node' },
  });
};
```

## Store Access Outside Components

```typescript
// Get state without subscription
const nodes = useWorkflowStore.getState().nodes;

// Call actions
useWorkflowStore.getState().addNode(newNode);
useWorkflowStore.getState().clearWorkflow();

// Subscribe to changes
const unsubscribe = useWorkflowStore.subscribe(
  (state) => state.nodes,
  (nodes) => {
    console.log('Nodes changed:', nodes);
  }
);

// Cleanup
unsubscribe();
```

## DevTools Integration

### Redux DevTools

```typescript
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export const useWorkflowStore = create<WorkflowState>()(
  devtools(
    (set, get) => ({
      // ... store implementation
    }),
    { name: 'WorkflowStore' }
  )
);
```

## Future Enhancements

### Undo/Redo

```typescript
import { temporal } from 'zundo';

export const useWorkflowStore = create<WorkflowState>()(
  temporal(
    (set, get) => ({
      // ... store implementation
    })
  )
);

// Usage
const undo = useWorkflowStore.temporal.getState().undo;
const redo = useWorkflowStore.temporal.getState().redo;
```

### Persistence

```typescript
import { persist } from 'zustand/middleware';

export const useWorkflowStore = create<WorkflowState>()(
  persist(
    (set, get) => ({
      // ... store implementation
    }),
    { name: 'workflow-storage' }
  )
);
```

### Immer for Immutable Updates

```typescript
import { immer } from 'zustand/middleware/immer';

export const useWorkflowStore = create<WorkflowState>()(
  immer((set) => ({
    nodes: [],
    addNode: (node) => set((state) => {
      state.nodes.push(node); // Mutable syntax with Immer
    }),
  }))
);
```

## Best Practices

### 1. Selective Subscriptions

```typescript
// ✅ Good - Subscribe to specific slice
const nodes = useWorkflowStore((state) => state.nodes);

// ❌ Bad - Subscribe to entire store
const store = useWorkflowStore();
```

### 2. Memoize Selectors

```typescript
import { shallow } from 'zustand/shallow';

const { nodes, edges } = useWorkflowStore(
  (state) => ({ nodes: state.nodes, edges: state.edges }),
  shallow
);
```

### 3. Action Creators

```typescript
// Create helper functions for common operations
export const createTextInputNode = () => ({
  id: `input-${Date.now()}`,
  type: 'default',
  position: { x: Math.random() * 400, y: Math.random() * 400 },
  data: { label: '📝 Text Input' },
});

// Usage
const addNode = useWorkflowStore((state) => state.addNode);
addNode(createTextInputNode());
```

### 4. Type Safety

```typescript
// Always define strict types
interface WorkflowState {
  nodes: Node[];
  edges: Edge[];
  addNode: (node: Node) => void;
  // ...
}

// Use TypeScript for better DX
export const useWorkflowStore = create<WorkflowState>(/* ... */);
```

## Troubleshooting

### Store not updating?

Check if you're subscribing correctly:
```typescript
// ✅ Correct
const nodes = useWorkflowStore((state) => state.nodes);

// ❌ Wrong - no subscription
const nodes = useWorkflowStore.getState().nodes;
```

### Too many re-renders?

Use selective subscriptions:
```typescript
// Instead of
const store = useWorkflowStore();

// Use
const nodes = useWorkflowStore((state) => state.nodes);
```

### State not persisting?

Add persistence middleware or save manually:
```typescript
useEffect(() => {
  const unsubscribe = useWorkflowStore.subscribe(
    (state) => {
      localStorage.setItem('workflow', JSON.stringify({
        nodes: state.nodes,
        edges: state.edges,
      }));
    }
  );
  return unsubscribe;
}, []);
```

## Resources
## Adding/Changing Nodes

1) Создайте компонент узла в `entities/nodes/<name>/<Name>Node.tsx` и используйте `NodeShell`.
2) Опишите шаблон в `entities/nodes/<name>/template.ts` (id, label, type, default data).
3) Зарегистрируйте шаблон в `entities/nodes/registry.ts` → `uiNodeTemplates`.
4) Экспортируйте компонент в `entities/nodes/index.ts` и добавьте в `features/canvas/ui/CanvasFrame.tsx` в `nodeTypes` под своим `type`.

Исполнение (если требуется):
- Для HTTP/бэкенд вызовов добавьте клиент в `shared/api/*` и вызовите его из `features/workflow-execution/lib/executeWorkflow.ts`.
- Для передачи данных дальше заполните `node.data.output` (или другое поле) — downstream узлы читают `value|text|output`.

- [Zustand Documentation](https://zustand-demo.pmnd.rs/)
- [ReactFlow State Management](https://reactflow.dev/learn/advanced-use/state-management)
- [Frontend Architecture](./ARCHITECTURE.md)

---

**Last Updated**: October 29, 2025  
**Location**: `features/workflow/model/workflowStore.ts`


