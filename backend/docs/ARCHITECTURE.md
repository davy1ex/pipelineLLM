# Backend Architecture

This document summarizes the internal architecture of the PipelineLLM backend and how components interact to execute workflows submitted by the frontend.

## Goals
- Centralize workflow execution on the backend
- Provide a clean, extensible architecture (executors per node type)
- Enable asynchronous execution with progress reporting
- Return partial results and clear error information

## Components

```
workflow/
  graph_builder.py     # Build dependency graph from nodes/edges (ReactFlow format)
  topological_sort.py  # Kahn's algorithm; validate graph (missing nodes, self-deps, broken edges)
  execution_engine.py  # Resolve inputs, execute nodes, cache results, iterative passes
  queue.py             # Background execution, progress tracking, status API data

executors/
  base.py              # ExecutorResult + NodeExecutor protocol
  registry.py          # Map node type → executor function
  *executors           # ollama, python, text_input, settings, filewriter

shared/
  python_service.py    # Safe-ish exec with stdout/err capture
  ollama_service.py    # HTTP client; URL normalization for Docker/host

app/
  server.py            # Flask API endpoints (enqueue + status + legacy proxies)
```

## Data Flow

1) Frontend sends workflow JSON
- `{ nodes, edges }` (ReactFlow format)
- `POST /api/workflow/execute` → `queueId`

2) Backend enqueues execution
- Builds and validates graph
- Starts background execution thread

3) Engine executes
- Compute topological order of executable nodes
- Resolve inputs for each node (cached results → node.data fallback)
- Execute via appropriate executor; cache `ExecutorResult`
- Repeat passes while new results appear (supports cycles)

4) Frontend polls status
- `GET /api/workflow/{queueId}/status` returns `status`, `results`, `runningNodeIds`, `completedNodeIds`, `executionLog`, `iterations`, and error/stats information

## Error Handling
- Graph validation: early fail (`GraphValidationError`)
- Per-node execution:
  - Unresolved dependencies → error result
  - Input resolution/timeout/exception → error result
- Aggregation:
  - If all executable nodes failed → `failed`
  - Otherwise → `completed` with `hasErrors=true` and list of `failedNodes`

## Extensibility

### Add a new node type
- Implement executor `(node, inputs) -> ExecutorResult`
- Register in `executors/registry.py`
- Extend `resolve_inputs()` if special handles are used

### Add a service
- Put IO/network logic into `shared/` (reused by executors and routes)

### Add an endpoint
- Keep routes thin; delegate to services/engine/queue

## References
- Executors guide: `docs/README_EXECUTORS.md`
- Testing guide: `docs/README_TESTING.md`
- Project overview & API: `../README.md`


