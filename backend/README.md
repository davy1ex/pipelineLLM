# Backend - PipelineLLM Workflow Execution

Flask-based backend that builds and executes node-based workflows submitted by the frontend. It owns graph building, ordering, execution, progress tracking and error handling. The frontend only sends `{ nodes, edges }` and visualizes progress.

- Architecture: see `docs/ARCHITECTURE.md`
- Executors: see `docs/README_EXECUTORS.md`
- Testing: see `docs/README_TESTING.md`

---

## Overview

- Framework: Python 3.11 + Flask
- Execution: Modular node executors (Ollama, Python, TextInput, Settings, FileWriter)
- Orchestration: Dependency graph + topological sort + iterative passes
- Async: Background queue + status polling API
- Error handling: Per-node errors, graph validation errors, timeouts, partial results

---

## Directory Structure

```
backend/
├── app/                 # Flask application (module entrypoint)
│   ├── server.py        # Main Flask app with API endpoints
│   └── __main__.py      # python -m app entrypoint
│
├── workflow/            # Core execution logic
│   ├── graph_builder.py     # Build dependency graph from nodes/edges
│   ├── topological_sort.py  # Kahn's algorithm + validation helpers
│   ├── execution_engine.py  # Resolve inputs, execute nodes, cache results
│   └── queue.py             # Background queue + progress state
│
├── executors/           # Node executors (pure functions)
│   ├── base.py              # ExecutorResult, NodeExecutor protocol
│   ├── registry.py          # Map node type → executor
│   ├── ollama_executor.py   # Ollama node execution
│   ├── python_executor.py   # Python node execution
│   ├── text_input_executor.py
│   ├── settings_executor.py
│   └── filewriter_executor.py
│
├── shared/              # Shared services (used by API and executors)
│   ├── python_service.py    # Safe-ish exec wrapper + stdout/err capture
│   └── ollama_service.py    # HTTP client with URL normalization
│
├── config/              # Packaging and dependencies
│   ├── Dockerfile
│   └── requirements.txt
│
├── tests/               # API and standalone tests
│   ├── fixtures/            # JSON workflows
│   ├── test_workflow_api.py # Queue-based API test (enqueue + poll)
│   ├── test_workflow_e2e.py # End-to-end tests (order + outputs)
│   └── test_workflow_standalone.py # Direct engine test
│
└── README.md            # This guide
```

---

## Execution Flow

1) Frontend sends workflow
- `POST /api/workflow/execute` with `{ nodes, edges }`
- Backend creates a `WorkflowExecution` and starts a background thread
- Response: `202 Accepted`, `{ queueId, status: 'pending' }`

2) Backend builds and validates graph
- `graph_builder.build_dependency_graph(nodes, edges)`
- Validate with `topological_sort.validate_graph`
  - Missing nodes, self-dependencies, broken edges → GraphValidationError

3) Engine runs iterative passes
- Compute topological order of executable nodes
- Resolve inputs for each node (from cached results or `node.data`)
- Execute node via its executor; cache `ExecutorResult`
- Repeat passes while new results appear or until limits reached

4) Progress + results
- `GET /api/workflow/{queueId}/status` returns:
  - `status`: pending | running | completed | failed
  - `runningNodeIds`, `completedNodeIds`
  - `results`: `{ nodeId: { output, error, ... } }` (partial results included)
  - `executionLog`, `iterations`, `stats`, `failedNodes`, `hasErrors`, `error`

---

## API

- `POST /api/workflow/execute` → enqueue workflow execution (returns `queueId`)
- `GET /api/workflow/{queueId}/status` → poll progress and gather results
- Legacy proxies (still available):
  - `POST /api/python/execute` → `shared/python_service.execute_python_code`
  - `POST /api/ollama/chat` → `shared/ollama_service.call_ollama_api`

---

## Queue & Progress Model

- `workflow/queue.py`
  - Stores `WorkflowExecution` state: `runningNodeIds`, `completedNodeIds`, `results`, `executionLog`, `iterations`, `status`, `error`, `stats`, `failedNodes`
  - Runs engine in a background thread and updates state as nodes finish
  - Status endpoint reads the current snapshot for polling clients

---

## Executors Architecture

- Each executor is a pure function: `(node: Dict, inputs: Dict) -> ExecutorResult`
- Keep I/O in `shared/` services
- Use `ExecutorResult(output: str, error?: str, metadata?: Dict)`
- Register new executor in `executors/registry.py`

Current executors:
- `textInput` → returns `data.value` as output
- `settings` → passes connection config (url, model, temperature)
- `python` → executes `data.code` (via `shared.python_service`), returns `output`
- `ollama` → calls `shared.ollama_service` with prompt/config, returns response text
- `fileWriter` → writes text to file, returns path/summary

---

## Error Handling

- Graph validation: `GraphValidationError` (fails early)
- Node execution:
  - Dependency check: unresolved upstream results → error result
  - Input resolution failures → error result
  - Timeout per node (default 300s) → error result
  - Generic exception → error result
- Partial results are returned; final status:
  - If all executable nodes failed → `failed`
  - Else → `completed` with `hasErrors=true` and `failedNodes`

---

## Development

Local run (recommended):
```
# From backend directory
python -m app
# or
python app/server.py
```

Docker (compose):
```
# In project docker/
docker compose up -d --build
```
- Backend listens on 5000 inside container (mapped to host 5001 by default in docker-compose)
- Nginx proxies `/api/*` to backend

---

## How to Add Functionality

### Add a new node type (backend)
1) Create executor: `executors/<my>_executor.py`
```python
from typing import Dict, Any
from executors.base import ExecutorResult

def execute_my_node(node: Dict[str, Any], inputs: Dict[str, Any]) -> ExecutorResult:
    data = node.get('data', {})
    result_text = '...'
    return ExecutorResult(output=result_text)
```
2) Register in `executors/registry.py`
```python
from .my_executor import execute_my_node
_EXECUTOR_REGISTRY['myNode'] = execute_my_node
```
3) Add input resolution in `workflow/execution_engine.py` if the node needs special inputs

### Add a new API endpoint
- Define route in `app/server.py` and delegate work to `shared/` or a new service
- Keep endpoints thin; avoid embedding business logic in routes

### Extend execution engine
- Update `resolve_inputs()` for new handle conventions
- Update error handling/timeouts if needed
- Keep orchestration pure and well-logged

---

## Tests

- API queue test: `tests/test_workflow_api.py` (enqueue + poll)
- End-to-end: `tests/test_workflow_e2e.py` (topology + outputs + partial failures)
- Standalone engine: `tests/test_workflow_standalone.py`

Run locally:
```
python tests/test_workflow_api.py
python tests/test_workflow_e2e.py
python tests/test_workflow_standalone.py
```

---

## Troubleshooting

- 502 Bad Gateway (via nginx)
  - Ensure backend is running and listening on 5000 in the container
  - Check nginx proxy target matches container service name/port
- Ollama connection refused
  - For host: use `http://localhost:11434` in Settings; backend normalizes to `host.docker.internal` for Docker
  - Pull model: `ollama pull <model>`
- Too many `/status` polls
  - Increase frontend `pollInterval` (e.g., 800–1000ms)
  - Optional: early stop when all executable nodes succeeded (engine tweak)

---

## Docs
- Architecture: `docs/ARCHITECTURE.md`
- Executors: `docs/README_EXECUTORS.md`
- Testing: `docs/README_TESTING.md`
