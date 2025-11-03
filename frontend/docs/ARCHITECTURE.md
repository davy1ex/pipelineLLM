# Frontend Architecture

## Overview

PipelineLLM frontend follows **Feature-Sliced Design (FSD)** and renders a node-based workflow using ReactFlow. The system is split by responsibility: the canvas renders, entities provide pluggable nodes, widgets offer UI controls, and shared holds cross-cutting utilities.

## Tech Stack

- **React 19** - UI
- **TypeScript** - Types
- **Vite** - Dev/build
- **@xyflow/react** (ReactFlow) - Graph rendering
- **Zustand** - State store
- **ESLint** - Linting

## Directory Structure (FSD, updated)

```
src/
├── app/                          # App-level
│   └── components/
│       └── ErrorBoundary.tsx
│
├── pages/
│   └── workflow/
│       └── WorkFlowPage.tsx      # Composes Canvas + Toolbar
│
├── features/
│   ├── canvas/                   # Workflow canvas (render + state + init)
│   │   ├── model/
│   │   │   ├── workflowStore.ts  # Zustand store (nodes/edges/handlers)
│   │   │   ├── initWorkflow.ts   # Demo graph (starter nodes/edges)
│   │   │   ├── localStorage.ts   # Persistence layer
│   │   │   └── index.ts
│   │   ├── lib/
│   │   │   └── workflowIO.ts     # Import/export workflow files
│   │   └── ui/
│   │       ├── CanvasFrame.tsx   # ReactFlow canvas
│   │       └── NodeActionsContext.tsx # Interface exposed to nodes
│   │
│   └── workflow-execution/        # Workflow execution engine
│       ├── model/
│       │   └── executionStore.ts # Execution state (running/completed nodes, logs)
│       ├── lib/
│       │   ├── executeWorkflow.ts # Main execution orchestrator (iterative algorithm)
│       │   ├── runWorkflow.ts     # Entry point (UI integration layer)
│       │   ├── order.ts           # Topological sorting for execution order
│       │   ├── utils.ts           # Data resolution utilities
│       │   └── phases/
│       │       ├── pythonPhase.ts # Python node execution phase
│       │       └── ollamaPhase.ts # Ollama node execution phase
│       └── ui/
│           └── LogExecution.tsx   # Execution logs display
│
├── entities/
│   └── nodes/                    # Pluggable node modules (self-contained)
│       ├── text-input/
│       │   ├── TextInputNode.tsx
│       │   └── template.ts
│       ├── ollama/
│       │   ├── OllamaNode.tsx
│       │   └── template.ts
│       ├── settings/
│       │   ├── SettingsNode.tsx
│       │   └── template.ts
│       ├── output/
│       │   ├── OutputNode.tsx
│       │   └── template.ts
│       ├── registry.ts           # Aggregates node templates for toolbar
│       └── index.ts              # Re-exports node components
│
├── widgets/
│   └── toolbar/
│       ├── ui/Toolbar.tsx        # Data-driven toolbar (creates nodes)
│       └── index.ts
│
├── shared/
│   ├── lib/
│   │   ├── nodeTemplate.ts       # NodeTemplate type + build helper
│   │   ├── nodeHandles.ts        # Node handles configuration (inputs/outputs)
│   │   └── dataTypes.ts          # Data type definitions and styling
│   ├── ui/
│   │   └── NodeShell.tsx         # Base node UI component (with visual indicators)
│   └── api/
│       └── ...                    # API clients (executePython, callOllama, etc.)
│
└── assets/
```

## Layers and Dependencies

```
app      → pages
pages    → features/canvas, features/workflow-execution, widgets
features → entities, shared
widgets  → entities, shared
entities → shared
shared   → (no upward deps)
```

Lower layers never depend on upper layers. Features are independent and can be used separately.

## Module Responsibilities

### features/canvas

- Owns the workflow state and initial graph
- Renders ReactFlow via `CanvasFrame`
- Provides `NodeActionsContext` with a minimal interface to nodes (e.g., `updateNodeData`) so nodes remain UI-only and store-agnostic
- Auto-saves workflow state to localStorage (debounced 300ms)
- Colorizes edges based on data types from source node handles

```tsx
// features/canvas/ui/CanvasFrame.tsx (excerpt)
const nodeTypes: NodeTypes = {
  lr: LeftRightNode,
  textInput: TextInputNode,
  ollama: OllamaNode,
  settings: SettingsNode,
  output: OutputNode,
  python: PythonNode,
  fileWriter: FileWriterNode,
};

<NodeActionsProvider value={{ updateNodeData, getIncomingData }}>
  <ReactFlow ... nodeTypes={nodeTypes} />
</NodeActionsProvider>
```

**workflowStore** (`features/canvas/model/workflowStore.ts`):
- Zustand store managing `nodes` and `edges`
- Handlers: `onNodesChange`, `onEdgesChange`, `onConnect`
- CRUD operations: `setNodes`, `setEdges`, `addNode`, `removeNode`, `clearWorkflow`
- Loads initial state from localStorage on initialization
- All state changes trigger auto-save (debounced)

### entities/nodes

- Each node is a self-contained module (component + template + local libs if needed)
- Nodes do not import the store; they call the context interface only
- The toolbar pulls available templates from `entities/nodes/registry.ts`

```tsx
// entities/nodes/text-input/TextInputNode.tsx (excerpt)
const { updateNodeData } = useNodeActions();
// Local state prevents caret jump while syncing to store
const [localValue, setLocalValue] = React.useState(value);
const updateValue = (next: string) => {
  setLocalValue(next);
  requestAnimationFrame(() => updateNodeData(id as string, { value: next }));
};
```

```ts
// entities/nodes/registry.ts (excerpt)
export const uiNodeTemplates: NodeTemplate[] = [
  textInputTemplate,
  ollamaMockTemplate,
  settingsTemplate,
  outputTemplate,
];
```

### widgets/toolbar

- Renders buttons from the templates registry (no knowledge of node internals)
- Uses shared helper to instantiate nodes

```tsx
// widgets/toolbar/ui/Toolbar.tsx (excerpt)
const templates = uiNodeTemplates;
const newNode = buildNodeFromTemplates(templates, templateId);
```

### features/workflow-execution

- Orchestrates workflow execution with iterative algorithm
- Separates execution logic from UI (pure functions)
- Tracks execution state (running/completed nodes)
- Supports intermediate callbacks for real-time UI updates

**Key Components:**

1. **runWorkflow** (`lib/runWorkflow.ts`):
   - Entry point from UI (called by `WorkFlowPage`)
   - Integrates with UI via `updateNodeData` callback
   - Subscribes to `onNodeDone` events for real-time updates
   - Applies final results to Output nodes

2. **executeWorkflow** (`lib/executeWorkflow.ts`):
   - Core execution orchestrator
   - Iterative algorithm: Python Phase → Ollama Phase (repeat until stable)
   - Caches results in `nodeResults: Map<string, string>`
   - Tracks `outputUpdates` for Output nodes
   - Stops when no new results are produced

3. **Phases** (`lib/phases/`):
   - `pythonPhase.ts`: Executes Python nodes in topological order
   - `ollamaPhase.ts`: Executes Ollama nodes in topological order
   - Both phases resolve inputs from upstream nodes
   - Results cached in `nodeResults` for downstream consumption

4. **order.ts**:
   - `getPythonExecutionOrder`: Topological sort for Python nodes
   - `getOllamaExecutionOrder`: Topological sort for Ollama nodes
   - Uses DFS to visit dependencies before dependent nodes

5. **executionStore** (`model/executionStore.ts`):
   - Zustand store for execution state
   - `runningNodeIds`: Nodes currently executing
   - `completedNodeIds`: Nodes that finished execution
   - `logExecution`: Execution log messages

### shared/lib

- Cross-cutting utilities and types

```ts
// shared/lib/nodeTemplate.ts (excerpt)
export type NodeTemplate = { id; label; type; ... };
export function buildNodeFromTemplates(templates, id): Node | null { ... }

// shared/lib/nodeHandles.ts
export const NODE_HANDLES: Record<string, { inputs: NodeHandle[]; outputs: NodeHandle[] }>
export const getNodeHandles = (nodeType: string): {...}

// shared/lib/dataTypes.ts
export type DataType = 'string' | 'json' | 'any' | ...
export const getDataTypeColor = (type: DataType): string
```

### shared/ui

**NodeShell** (`shared/ui/NodeShell.tsx`):
- Base UI component for all nodes
- Provides visual execution indicators:
  - Blue border + animation when `runningNodeIds.includes(nodeId)`
  - Green border when `completedNodeIds.includes(nodeId)`
- Handles rendering (inputs/outputs) based on `connectors` prop
- Supports resizing (right edge, bottom edge, corner)
- Renders controls for editing node properties
- Reads execution state from `useExecutionStore`

## Page Composition

```tsx
// pages/workflow/WorkFlowPage.tsx
export const WorkFlowPage = () => {
  const nodes = useWorkflowStore((s) => s.nodes);
  const edges = useWorkflowStore((s) => s.edges);
  const [isRunning, setIsRunning] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const loaded = loadFromStorage();
    if (!loaded && nodes.length === 0) {
      setNodes(getInitialNodes());
      setEdges(getInitialEdges());
    }
  }, []);

  // Update node data callback
  const updateNodeData = (nodeId: string, patch: Record<string, unknown>) => {
    const currentNodes = getWorkflowStore.getState().nodes;
    const nodeIndex = currentNodes.findIndex((n) => n.id === nodeId);
    if (nodeIndex === -1) return;
    
    const node = currentNodes[nodeIndex];
    const updatedData = { ...(node.data as any), ...patch };
    const updatedNode = { ...node, data: updatedData };
    const newNodes = [...currentNodes];
    newNodes[nodeIndex] = updatedNode;
    setNodes(newNodes);
  };

  // Run workflow
  const handleRun = async () => {
    setIsRunning(true);
    try {
      await runWorkflow({
        nodes,
        edges,
        updateNodeData,
        getCurrentNodes: () => getWorkflowStore.getState().nodes,
        verbose: true,
      });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header handleStart={handleRun} isRunning={isRunning} />
      <NodeActionsProvider value={{ updateNodeData, getIncomingData }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <CanvasFrame />
          <Toolbar />
        </div>
      </NodeActionsProvider>
      <LogExecution logExecution={useExecutionStore((s) => s.logExecution)} />
    </div>
  );
};
```

## Data & Control Flow

### Canvas Interactions

1) User clicks a toolbar button → toolbar builds a node from a template → adds it to the store
2) Store updates → CanvasFrame re-renders ReactFlow → new node appears
3) Node updates its own data via `NodeActionsContext.updateNodeData(id, patch)`
4) Edges are always created as `type: 'step'` for consistent left→right connectors
5) Edges are colorized based on source node handle's data type
6) Nodes describe connectors via `connectors` array (rendered by `NodeShell`)
7) All changes auto-save to localStorage (debounced 300ms)

### Workflow Execution Flow

```
User clicks "Run" button
  ↓
WorkFlowPage.handleRun()
  ↓
runWorkflow({ nodes, edges, updateNodeData, ... })
  ↓
executeWorkflow({ nodes, edges }, { onNodeDone, ... })
  ↓
[ITERATIVE LOOP:]
  1. executePythonPhase()
     - Get execution order: getPythonExecutionOrder()
     - For each Python node:
       * Resolve input from upstream node (nodeResults → node.data)
       * Inject input as `data_input` variable
       * POST /api/python/execute
       * Cache result in nodeResults
       * Update node.data.output
       * Call onNodeDone → update UI (node + Output nodes)
  
  2. executeOllamaPhase()
     - Get execution order: getOllamaExecutionOrder()
     - For each Ollama node:
       * Resolve inputs: prompt, systemPrompt, config
       * POST /api/ollama/chat
       * Cache result in nodeResults
       * Update node.data.lastResponse
       * Call onNodeDone → update UI (node + Output nodes)
  
  3. Check progress: if no new results → break
  ↓
Return final results to runWorkflow
  ↓
runWorkflow applies final updates to Output nodes
  ↓
ExecutionStore.completeAll() → mark all nodes as completed
```

### Data Resolution Priority

When a node needs input from an upstream node:
1. **First priority**: `nodeResults.get(sourceNodeId)` - cached execution result
2. **Fallback**: `sourceNode.data.value || sourceNode.data.text || sourceNode.data.output`
3. **For Ollama nodes**: Also checks `node.data` for local overrides (e.g., `systemPrompt`)

### Execution State Management

- **ExecutionStore** (`features/workflow-execution/model/executionStore.ts`):
  - Tracks `runningNodeIds` and `completedNodeIds`
  - Used by `NodeShell` for visual indicators
  - Logs execution messages via `logExecution`
  - Reset before each execution run

- **Visual Feedback**:
  - Nodes show blue border + animation while in `runningNodeIds`
  - Nodes show green border when in `completedNodeIds`
  - Progress indicator appears at top of node during execution

## TypeScript & Patterns

- Prefer type-only imports (`import type {...}`) to avoid runtime imports
- Nodes consume a minimal context API instead of importing the store
- Templates declare `type`, `data` defaults, and positioning; toolbar remains generic

## Current Nodes

- **TextInputNode**: 
  - Outputs: `output` (string)
  - Local input state to avoid caret jump
  - Template: `entities/nodes/text-input/template.ts`

- **SettingsNode**: 
  - Outputs: `config` (json: url, model, temperature)
  - Provides default Ollama configuration
  - Template: `entities/nodes/settings/template.ts`

- **OllamaNode**: 
  - Inputs: `prompt` (string), `systemPrompt` (string), `config` (json)
  - Outputs: `output` (string)
  - UI merges local data with incoming connections
  - During execution: incoming connections take priority
  - Stores result in `node.data.lastResponse`
  - Template: `entities/nodes/ollama/template.ts`

- **PythonNode**: 
  - Inputs: `input` (string)
  - Outputs: `output` (string)
  - Executes Python code on backend via `POST /api/python/execute`
  - Input injected as `data_input` variable (alias: `input_data`)
  - Result taken from `output` variable or `stdout`
  - Stores result in `node.data.output`
  - Template: `entities/nodes/python/template.ts`

- **OutputNode**: 
  - Inputs: `text` (string)
  - Displays markdown-rendered text
  - Auto-sizes and expands
  - Word wrap at ~1200px
  - Updated in real-time during execution
  - Template: `entities/nodes/output/template.ts`

- **FileWriterNode**: 
  - Inputs: `text` (string)
  - Writes text to file on backend
  - Template: `entities/nodes/file-writer/template.ts`

## Performance

- Zustand selectors are used to avoid unnecessary re-renders
- ReactFlow provides virtualized rendering and optimized edge calculations

## Error Handling

- `ErrorBoundary` wraps the page for graceful errors

## Key Design Decisions

### Iterative Execution Algorithm

The workflow execution uses an iterative algorithm that allows for cycles between Python and Ollama nodes:

```typescript
while (progress) {
  // Execute all Python nodes that can run
  pythonPhase.execute();
  
  // Execute all Ollama nodes that can run
  ollamaPhase.execute();
  
  // Stop if no new results were produced
  if (nodeResults.size === lastResultsCount) break;
}
```

This enables workflows like:
- Python → Ollama → Python (data processing → LLM → more processing)
- Multiple passes until convergence

### Result Caching

Results are cached in `nodeResults: Map<string, string>` to:
- Avoid re-reading from `node.data` (which may be stale)
- Support iterative execution where nodes may re-execute
- Provide consistent data resolution priority

### Separation of Concerns

- **Canvas Feature**: UI rendering and state management (nodes/edges)
- **Workflow Execution Feature**: Pure execution logic, no UI dependencies
- **Shared**: Reusable components and utilities
- **Entities**: Self-contained node components

### Visual Feedback

Execution state is managed separately (`executionStore`) from workflow state (`workflowStore`), allowing:
- Real-time visual feedback during execution
- Nodes can show running/completed states independently
- Logs can track execution progress

## Extension Points

### Adding a New Node Type

See [NODES_AND_EDGES.md](./NODES_AND_EDGES.md) for detailed instructions.

### Adding a New Execution Phase

1. Create phase file: `features/workflow-execution/lib/phases/myPhase.ts`
2. Implement execution order function (or reuse existing topological sort)
3. Add phase to `executeWorkflow.ts` iteration loop
4. Define input resolution logic
5. Cache results in `nodeResults` for downstream consumption

### Adding Conditional Logic

See [EXECUTION.md](./EXECUTION.md) for approaches to conditional nodes and loops.

## Workflow JSON Format

The project uses a standardized JSON format for workflow import/export and (future) backend execution:

```typescript
interface WorkflowFile {
  version: number;
  nodes: Node[];      // ReactFlow nodes with id, type, position, data
  edges: Edge[];      // Connections with source, target, handles
  exportedAt?: string;
}
```

**Key points**:
- Current export/import format (`features/canvas/lib/workflowIO.ts`) is **sufficient for backend execution**
- All node execution parameters are stored in `node.data`
- All connections are stored in `edges` with proper handle mapping (`sourceHandle`/`targetHandle`)
- Backend can build dependency graph and determine execution order from this format
- No format changes needed for migration to backend execution

See [WORKFLOW_FORMAT.md](./WORKFLOW_FORMAT.md) for complete format specification.

## Resources

- [Workflow Format](./WORKFLOW_FORMAT.md) - Complete JSON format specification
- [Execution Engine Details](./EXECUTION.md) - How workflow execution works
- [Workflow Store Details](./WORKFLOW_STORE.md) - Zustand store documentation
- [Nodes and Edges](./NODES_AND_EDGES.md) - Node development guide
- [Python Node](./PYTHON_NODE.md) - Python node specifics
- [ReactFlow Documentation](https://reactflow.dev/)
- [Feature-Sliced Design](https://feature-sliced.design/)
- [Zustand Documentation](https://zustand-demo.pmnd.rs/)

---

**Last Updated**: December 2024

**Version**: 0.2.0