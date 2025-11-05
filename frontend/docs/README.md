# PipelineLLM Frontend Docs

This directory documents the frontend of PipelineLLM – a ComfyUI‑inspired visual workflow builder for LLM pipelines using a node‑based canvas.

Use this README as your entry point: it explains what the project is about, how it is structured, how the canvas and nodes work, how a workflow is executed (now backend‑driven), and how to add new functionality.

---

## What is PipelineLLM?

A visual editor to compose LLM pipelines from reusable nodes (Text Input, Settings, Ollama, Python, Output, File Writer, etc.). Users connect nodes on a canvas to define data flow; the workflow is executed on the backend, while the frontend visualizes progress and results.

- UI: React + TypeScript + Vite
- Canvas: ReactFlow (`@xyflow/react`)
- State: Zustand
- Execution: Backend‑driven (Flask). Frontend serializes nodes+edges and polls progress

Key docs:
- `ARCHITECTURE.md` – module‑level architecture and feature slices
- `WORKFLOW_FORMAT.md` – workflow JSON format
- `EXECUTION.md` – historical frontend execution notes (now superseded by backend execution)

---

## High‑Level Architecture

Frontend responsibilities:
- Provide canvas UX (create/edit/connect nodes)
- Persist workflow locally (localStorage) and export/import as JSON
- Send workflow JSON to backend to execute; poll progress and update the UI
- Render per‑node state (running/completed, outputs, errors)

Backend responsibilities:
- Build graph, validate, determine topological order
- Execute nodes, cache results, handle iterative passes and errors
- Expose `/api/workflow/execute` (enqueue) and `/api/workflow/{queueId}/status` (progress)

---

## Canvas and Nodes

The canvas is implemented with ReactFlow. Nodes are React components with a consistent outer shell and connector layout.

- Canvas feature: `src/features/canvas`
  - `model/workflowStore.ts` – Zustand store for nodes/edges, connect handlers, persistence
  - `lib/workflowIO.ts` – export/import workflow JSON (ReactFlow format)
  - `lib/workflowAdapter.ts` – adapters (if needed) for format transforms
  - `ui/*` – canvas frame, property panel, toolbar

- Node components: `src/entities/nodes/<type>`
  - Each node renders using `shared/ui/NodeShell.tsx`
  - Each node defines connectors (inputs/outputs) and controls (editable UI)
  - Nodes read/write their `data` via the page‑level callbacks provided by `WorkFlowPage`

- State persistence: `workflowStore` saves `{ nodes, edges }` to `localStorage` (debounced)
  - `onConnect` and `onEdgesChange` colorize edges using data‑type palette
  - Tests cover that edges persist across reloads and external imports

---

## Run Workflow (Backend‑Driven)

Entry points:
- `src/features/workflow-execution/lib/runWorkflow.ts` – thin wrapper for backward compatibility
- `src/features/workflow-execution/lib/runWorkflowBackend.ts` – real client

Flow:
1. Collect current `nodes` and `edges` from store
2. POST `/api/workflow/execute` with `{ nodes, edges }` → receive `queueId`
3. Poll GET `/api/workflow/{queueId}/status` until `completed`/`failed`
4. On progress updates:
   - Update `executionStore` (`runningNodeIds`, `completedNodeIds`)
   - Map backend `results` into node `data` (e.g., `ollama.lastResponse`, `python.output`)
   - Log backend execution lines into `LogExecution` component
   - Display node‑level errors (`data.error`) and status banners

Configuration:
- Default polling interval: 500ms (can be adjusted via `pollInterval`)
- Max polling duration: 5 minutes (configurable)
- Progress logging is appended with `[backend]` prefix

Error handling:
- Backend provides `hasErrors`, `failedNodes`, `stats`, and per‑node `error`
- Frontend surfaces errors in logs and node `data`

---

## File Map (Frontend)

- `src/pages/workflow/WorkFlowPage.tsx` – page that wires canvas, toolbar, and run button
- `src/features/canvas/model/workflowStore.ts` – nodes/edges state and persistence
- `src/shared/api/workflow.ts` – API client for `/execute` and `/status`
- `src/features/workflow-execution/model/executionStore.ts` – UI execution state
- `src/features/workflow-execution/ui/LogExecution.tsx` – execution log panel
- `src/features/workflow-execution/lib/runWorkflowBackend.ts` – enqueue/poll logic
- `src/shared/ui/NodeShell.tsx` – common node wrapper with connectors and controls

---

## Workflow JSON Format

We use a ReactFlow‑style export for frontend storage and transport to backend. The backend expects:

```json
{
  "version": 1,
  "nodes": [...],
  "edges": [...]
}
```

See `WORKFLOW_FORMAT.md` for the complete formal spec and examples.

---

## Adding a New Node Type (Frontend)

1. Create component under `src/entities/nodes/<your-node>` with a NodeShell wrapper
   - Define connectors (inputs/outputs) and controls (editable fields)
   - Update `entities/nodes/registry.ts` to register your node type
2. Ensure `data` keys the backend needs are present (e.g., `prompt`, `model`)
3. If the node produces an output string, use a conventional field name (e.g., `output`, `lastResponse`)
4. Add any UI indicators in NodeShell (errors, status, previews)

Minimal example:
```tsx
<NodeShell
  nodeId={id}
  title={label}
  connectors={[
    { id: 'input', type: 'target', position: Position.Left, label: 'input' },
    { id: 'output', type: 'source', position: Position.Right, label: 'output' }
  ]}
  controls={[{ key: 'label', label: `Label: ${label}`, editable: true, value: label, onChange: v => updateNodeData(id, { label: v }) }]}
/>
```

---

## Adding a New Node Type (Backend)

1. Implement executor: `backend/executors/<your>_executor.py`
2. Register in `backend/executors/registry.py`
3. Add input resolution in `backend/workflow/execution_engine.py.resolve_inputs`
4. (Optional) Extend `WORKFLOW_FORMAT.md` if your node introduces new conventions

---

## How to Extend the Frontend

- Add UI features under the relevant feature slice (`features/*`)
- Keep side effects outside of components (use store/actions)
- Prefer pure functions in utilities and selectors
- Add tests:
  - API client and execution orchestrator tests (Vitest)
  - Store persistence tests (edges/nodes across reloads)

Run tests:
```bash
npm run test
```

---

## Development

- Start dev server: `npm run dev`
- Vite dev server with proxy for `/api/*` to backend (see `vite.config.ts`)
- Recommended backend dev: `python -m app` (see backend README)

---

## Conventions

- TypeScript: explicit types for public APIs; avoid `any`
- State: keep minimal and serializable state in Zustand
- Logs: use `LogExecution` for execution messages; prefix backend lines with `[backend]`
- Errors: set `node.data.error` to show errors inline in nodes

---

## Troubleshooting

- Seeing many `/status` requests? It’s normal polling until backend marks `completed`.
  - Adjust `pollInterval` or enable early break on the backend when all nodes are successful.
- Edges disappear after reload? Covered by tests; ensure `workflowStore.loadFromStorage()` is called on mount.
- Ollama connection issues? Use Settings node URL. Backend normalizes `localhost` to `host.docker.internal` for Docker.

---

## See Also

- `ARCHITECTURE.md` – deeper module‑level architecture and feature slices
- `WORKFLOW_FORMAT.md` – complete schema and rules
- Backend docs: `backend/README.md`, `backend/docs/README_EXECUTORS.md`

