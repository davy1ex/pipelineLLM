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
│   └── workflow-execution/        # Backend-driven execution client
│       ├── model/
│       │   └── executionStore.ts # Execution state (running/completed nodes, logs)
│       ├── lib/
│       │   ├── runWorkflow.ts     # Entry point (UI integration layer; wrapper)
│       │   ├── runWorkflowBackend.ts # Backend client: enqueue + poll + UI updates
│       │   └── utils.ts           # Data resolution utilities (UI-side)
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
│       ├── python/
│       │   ├── PythonNode.tsx
│       │   └── template.ts
│       ├── file-writer/
│       │   ├── FileWriterNode.tsx
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
│       ├── workflow.ts           # /api/workflow client (enqueue + status)
│       ├── ollama.ts             # /api/ollama/chat proxy client
│       └── python.ts             # /api/python/execute proxy client
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

### features/workflow-execution

- `runWorkflow.ts`: thin wrapper used by the page (for backward compatibility)
- `runWorkflowBackend.ts`: the real client
  - POST `/api/workflow/execute` with `{ nodes, edges }` → `queueId`
  - Poll `/api/workflow/{queueId}/status`
  - Update `executionStore`, per-node `data`, and append to log (`LogExecution`)
- `executionStore.ts`: UI execution state (running/completed nodes and `logExecution`)
- `LogExecution.tsx`: docked log panel with auto-scroll and resize

### entities/nodes

- Each node is a self-contained module (component + template + local libs if needed)
- Nodes do not import the store; they call the context interface only
- Common patterns:
  - Put editable fields in `data` (e.g., `prompt`, `model`, `code`)
  - Read connected inputs via `getIncomingData` when needed
  - Surface errors in `data.error` to show banners in NodeShell

### shared/api

- `workflow.ts`: enqueue + status clients with robust error parsing
- `ollama.ts`, `python.ts`: proxy clients used by nodes or legacy flows

## Execution Model

See `docs/EXECUTION.md` (backend-driven).

## Tests

- Vitest covers:
  - `runWorkflowBackend`: enqueue/poll, per-node updates, logs, error surfacing, progress
  - `workflowStore` persistence: edges survive connect → save → reload; handle IDs preserved

## Notes

- The previous frontend-based execution files were removed: `executeWorkflow.ts`, `order.ts`, `phases/*`
- Prefer passing workflow to backend; frontend focuses on UX and visualization
