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
│   └── canvas/                   # Workflow canvas (render + state + init)
│       ├── model/
│       │   ├── workflowStore.ts  # Zustand store (nodes/edges/handlers)
│       │   └── initWorkflow.ts   # Demo graph (starter nodes/edges)
│       └── ui/
│           ├── CanvasFrame.tsx   # ReactFlow canvas
│           └── NodeActionsContext.tsx # Interface exposed to nodes
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
│   └── lib/
│       └── nodeTemplate.ts       # NodeTemplate type + build helper
│
└── assets/
```

## Layers and Dependencies

```
app      → pages
pages    → features/canvas, widgets/toolbar
features → entities, shared
widgets  → entities, shared
entities → shared
shared   → (no upward deps)
```

Lower layers never depend on upper layers.

## Module Responsibilities

### features/canvas

- Owns the workflow state and initial graph
- Renders ReactFlow via `CanvasFrame`
- Provides `NodeActionsContext` with a minimal interface to nodes (e.g., `updateNodeData`) so nodes remain UI-only and store-agnostic

```tsx
// features/canvas/ui/CanvasFrame.tsx (excerpt)
const nodeTypes: NodeTypes = {
  lr: LeftRightNode,
  textInput: TextInputNode,
  ollama: OllamaNode,
  settings: SettingsNode,
  output: OutputNode,
};

<NodeActionsProvider value={{ updateNodeData }}>
  <ReactFlow ... nodeTypes={nodeTypes} />
</NodeActionsProvider>
```

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

### shared/lib

- Cross-cutting utilities and types

```ts
// shared/lib/nodeTemplate.ts (excerpt)
export type NodeTemplate = { id; label; type; ... };
export function buildNodeFromTemplates(templates, id): Node | null { ... }
```

## Page Composition

```tsx
// pages/workflow/WorkFlowPage.tsx
export const WorkFlowPage = () => {
  const setNodes = useWorkflowStore((s) => s.setNodes);
  const setEdges = useWorkflowStore((s) => s.setEdges);
  const nodes = useWorkflowStore((s) => s.nodes);

  useEffect(() => {
    if (nodes.length === 0) {
      setNodes(getInitialNodes());
      setEdges(getInitialEdges());
    }
  }, []);

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
      <CanvasFrame />
      <Toolbar />
    </div>
  );
};
```

## Data & Control Flow

1) User clicks a toolbar button → toolbar builds a node from a template → adds it to the store
2) Store updates → CanvasFrame re-renders ReactFlow → new node appears
3) Node updates its own data via `NodeActionsContext.updateNodeData(id, patch)`
4) Edges are always created as `type: 'step'` for consistent left→right connectors
5) Nodes describe connectors via `connectors` array (rendered рядами в `NodeShell`)

## TypeScript & Patterns

- Prefer type-only imports (`import type {...}`) to avoid runtime imports
- Nodes consume a minimal context API instead of importing the store
- Templates declare `type`, `data` defaults, and positioning; toolbar remains generic

## Current Nodes

- TextInputNode: right `output`; local input state to avoid caret jump
- SettingsNode: right `config` (url, model, temperature)
- OllamaNode: left `prompt`, left `systemPrompt`, left `config`, right `output`; UI объединяет локальные данные с входящими; во время исполнения приоритет у входящих
- PythonNode: left `input`, right `output`; выполняет Python код на backend, результат берётся из переменной `output` (или stdout) и идёт дальше
- OutputNode: left `text`; markdown rendering + autosize/expand, перенос при ~1200px

## Performance

- Zustand selectors are used to avoid unnecessary re-renders
- ReactFlow provides virtualized rendering and optimized edge calculations

## Error Handling

- `ErrorBoundary` wraps the page for graceful errors

## Resources

- [Nodes and Edges](./NODES_AND_EDGES.md)
- [Workflow Store Details](./WORKFLOW_STORE.md)
- [ReactFlow Documentation](https://reactflow.dev/)
- [Feature-Sliced Design](https://feature-sliced.design/)
- [Zustand Documentation](https://zustand-demo.pmnd.rs/)

---

**Last Updated**: October 29, 2025

**Version**: 0.1.0-alpha