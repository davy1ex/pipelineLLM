# Execution Model (Backend-Driven)

This document describes how workflows are executed now. Execution is handled by the backend; the frontend only submits the workflow JSON and visualizes progress.

- Submit: `POST /api/workflow/execute` with `{ nodes, edges }` → returns `queueId`
- Poll: `GET /api/workflow/{queueId}/status` until `status` is `completed` or `failed`
- Render: update node UIs and `LogExecution` from the backend `results` and `executionLog`

See also:
- `README.md` – high-level overview
- `WORKFLOW_FORMAT.md` – workflow JSON specification

---

## Frontend flow

- Entry point: `features/workflow-execution/lib/runWorkflow.ts` (wrapper)
- Core client: `features/workflow-execution/lib/runWorkflowBackend.ts`
  - Serializes `{ nodes, edges }`
  - Enqueues execution and polls status
  - Updates:
    - `executionStore`: running/completed node IDs, execution log
    - Node data: `ollama.lastResponse`, `python.output`, `data.error` when present

### Polling configuration
- Default `pollInterval`: 500ms (can be tuned per call)
- Default `maxPollDuration`: 5 minutes

### Error handling
- Backend status contains:
  - `hasErrors`, `failedNodes`, `stats`
  - `results[nodeId].error` per node
- Frontend surfaces errors in `LogExecution` and sets `node.data.error`

---

## Backend responsibilities (summary)

- Build dependency graph and validate
- Compute topological execution order
- Execute nodes with caching and iterative passes (for cyclical dependencies)
- Aggregate partial results and errors

Note: Iterations are internal passes inside a single run. They allow dependent nodes to re-evaluate when new upstream results appear. This does not re-run the whole workflow multiple times; it stays within one execution until no new results are produced or limits are reached.

---

## Migration note

The previous frontend-based execution (phases and topological ordering inside the client) is deprecated and removed. Files like `executeWorkflow.ts`, `phases/*`, and `order.ts` no longer exist. Use the backend-driven model described above.
