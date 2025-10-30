# WorkFlowFrame - Rendering and Extensibility

This document explains how the workflow canvas is rendered and how to add a new block (custom node) in the current implementation.

## Overview

`WorkFlowFrame` is the canvas component that renders nodes and edges using ReactFlow. It is a thin view layer that:
- Reads nodes/edges and handlers from the workflow store (Zustand)
- Registers available node types (`nodeTypes`)
- Delegates all interactions (drag, select, connect) to ReactFlow

Location: `features/workflow/ui/WorkFlowFrame.tsx`

## Data Flow

- State source: `features/workflow/model/workflowStore.ts`
  - `nodes`, `edges`
  - `onNodesChange`, `onEdgesChange`, `onConnect`
  - Note: `onConnect` forces new edges to be `type: 'step'` for consistent left→right arrows
- Initial graph: `features/workflow/model/initWorkflow.ts`
  - Provides demo nodes/edges on first load

## Registered Node Types

`nodeTypes` is defined inside `WorkFlowFrame` and passed to `<ReactFlow />`:

```ts
const nodeTypes = {
  lr: LeftRightNode,     // Generic node with left input, right output
  ollama: OllamaNode,    // Ollama mock node with prompt + config inputs
  settings: SettingsNode // Emits LLM config (url, model) from its right side
};
```

### LeftRightNode
- Purpose: generic block with side handles (left input, right output)
- Visual: compact panel with label, side connectors
- Used by: demo nodes like Text Input, LLM placeholder, Output placeholder

### OllamaNode
- Purpose: represents an LLM call node (UI + used by execution engine)
- Inputs (left): `prompt`, `systemPrompt`, `config`
- Output (right): `output`
- UI reads own `data` merged with incoming handles; during execution, incoming handles take precedence

### SettingsNode
- Purpose: provides configuration for LLM nodes (url, model, temperature)
- Output (right): `config`

## Rendering Logic (WorkFlowFrame)

- Subscribes to store slices for `nodes`, `edges`, and handlers
- Passes everything to `<ReactFlow />`
- Renders canvas helpers: `<Controls />`, `<MiniMap />`, `<Background />`
- Uses `fitView` so the initial layout is fully visible

Key snippet:

```tsx
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
```

## Edge Policy

- All user-created edges are converted to `type: 'step'` inside `onConnect`
- Initial demo edges are also created with `type: 'step'`
- This ensures left→right, step-style connectors by default

## How to Add a New Block (Node)

Follow FSD and keep the feature self-contained.

1) Create the node component
- Path: `features/workflow/ui/nodes/MyCustomNode.tsx`

```tsx
import { Position, type NodeProps } from '@xyflow/react';
import { NodeShell } from '../../../shared/ui/NodeShell';

export const MyCustomNode = ({ data }: NodeProps) => {
  const label = (data as any)?.label ?? 'My Custom Node';
  return (
    <NodeShell
      title={label}
      connectors={[
        { type: 'target', position: Position.Left, label: 'input' },
        { type: 'source', position: Position.Right, label: 'output' },
      ]}
    >
      {/* body */}
    </NodeShell>
  );
};
```

2) Export it from nodes index
- Path: `features/workflow/ui/nodes/index.ts`
```ts
export { MyCustomNode } from './MyCustomNode';
```

3) Register in WorkFlowFrame
- Path: `features/workflow/ui/WorkFlowFrame.tsx`
```ts
import { MyCustomNode } from './nodes';

const nodeTypes = { ...existingTypes, mycustom: MyCustomNode };
```

4) Add a toolbar action (optional)
- Path: `features/workflow/ui/WorkFlowToolbar.tsx`
```ts
const handleAddMyCustomNode = () => {
  addNode({
    id: `mycustom-${Date.now()}`,
    type: 'mycustom',
    position: { x: 100, y: 200 },
    data: { label: '✨ My Custom Node' },
  });
};
```
Add a button that calls `handleAddMyCustomNode`.

5) Add to initial demo (optional)
- Path: `features/workflow/model/initWorkflow.ts`
- Insert a new node entry and any connecting edges with `type: 'step'`.

## Tips

- Keep node visuals simple and consistent (padding, border radius, shadows).
- Always place input handles on the left and output handles on the right for readability.
- Prefer `type: 'step'` edges for clear left→right pipelines.
- Use handle IDs when a node has multiple inputs/outputs (e.g., `config`).

## Related Docs

- [Nodes and Edges](./NODES_AND_EDGES.md)
- [Workflow Store](./WORKFLOW_STORE.md)
- [Frontend Architecture](./ARCHITECTURE.md)
