# Execution Engine (runWorkflow / executeWorkflow)

This document explains how execution starts, node ordering, data flow, and how to extend the engine (conditions/loops/new node types).

## Start
- Entry point: `features/workflow-execution/lib/runWorkflow.ts`
- Invocation: the page (`WorkFlowPage.tsx`) calls `runWorkflow({ nodes, edges, updateNodeData, ... })`
- `runWorkflow` delegates to `executeWorkflow.ts` and subscribes to intermediate results via `onNodeDone`

## Data flow
- Nodes read inputs from connected upstream sources.
- Reading rule when no cached result is present: `sourceNode.data.value || sourceNode.data.text || sourceNode.data.output`.
- After a node executes, its result is cached in `nodeResults` and is preferred by downstream consumers over direct `sourceNode.data` reads.

## Execution order
1) Python nodes
   - Topological order: `getPythonExecutionOrder(nodes, edges)`
   - The code is posted to backend: `POST /api/python/execute`
   - Input comes from an upstream node via edge on handle `input` (or default edge)
   - The input value is injected into your code as `data_input` (compat alias `input_data`)
   - The final result is saved to `node.data.output` and cached in `nodeResults`
2) Ollama nodes
   - Order: `getOllamaExecutionOrder(nodes, edges)` (topological sort by `prompt`/default input dependencies)
   - Inputs:
     - `prompt`: from `prompt` handle (or default input), priority is `nodeResults → data`
     - `systemPrompt`: from `systemPrompt` handle; fallback to `node.data.systemPrompt`
     - `config`: from Settings via `config` handle; fallback to `node.data`
   - Calls backend `/api/ollama/chat` (proxy)
   - The result is cached and propagated downstream

3) Updating Output nodes
- After a node (Python/Ollama) finishes, all connected `Output` nodes receive the result text (`updateNodeData(outputId, { text })`).

## Intermediate events
- `runWorkflow` receives `onNodeDone` from `executeWorkflow`
  - For Ollama: updates node `lastResponse` and connected Output `text`
  - For Python: updates node `output` and connected Output `text`

## How to extend/refactor

### Conditional nodes (if/else)
Idea: a new `condition` node type
- Connectors:
  - Inputs: `input` (data), `predicate` (boolean or a comparable string/number)
  - Outputs: `true`, `false` (two outgoing handles)
- Execution:
  - Add a phase in `executeWorkflow.ts` before or between Python/Ollama phases for topologically evaluating `condition` nodes
  - Resolve predicate from `nodeResults` of the source (preferred) or from `sourceNode.data`
  - Route outputs: either mark enabled edges (e.g., `edgeEnabled`) or push updates only through the selected branch
  - Alternative: skip non-selected outgoing edges during traversal

Pseudo-code:
```ts
for (const conditionNode of getConditionExecutionOrder(nodes, edges)) {
  const pred = resolvePredicate(conditionNode);
  const trueEdges = edges.filter(e => e.source === conditionNode.id && e.sourceHandle === 'true');
  const falseEdges = edges.filter(e => e.source === conditionNode.id && e.sourceHandle === 'false');
  markEnabledEdges(pred ? trueEdges : falseEdges);
  markDisabledEdges(pred ? falseEdges : trueEdges);
}
```

### Loops (while/loop)
Approach 1: a dedicated `loop` node with `iterations` or an exit condition
- Connectors: `input`, `body` (subgraph), `output`
- Execution: iteratively traverse the `body` subgraph until the condition is met or a limit is reached
- Constraints: implement iteration/time limits to avoid infinite loops

Approach 2 (simpler): control via `PythonNode`
- Implement loop logic in Python and emit the final `output`.
- Useful for early iterations without changing the engine itself.

### Adding a new node type
1) UI: create a component using `NodeShell` + a template (see `entities/nodes/python`)
2) Register in `nodeTypes` and `uiNodeTemplates`
3) Execution: add a new phase to `executeWorkflow.ts` (before/after existing ones) and define:
   - ordering (topologically by relevant dependencies)
   - how to resolve inputs
   - how to perform calls/computation
   - what to write into `node.data` and `nodeResults`

## Reliability & security
- Python is executed via `exec` — use trusted code only; for production use sandbox/containers, resource/time limits, and import allow-lists.
- Timeouts: long operations (Ollama/Python/HTTP) will block requests; account for this in UX.

## Diagnostics
- Console logs: `[executeWorkflow]`, `[runWorkflow]`
- `executionStore.setLogExecution` — short execution history
- Inspect node inputs/outputs and the `nodeResults` cache
