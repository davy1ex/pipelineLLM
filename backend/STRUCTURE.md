# Backend Structure

## File Organization

```
backend/
├── app/                    # Flask application
│   ├── __init__.py        # App export
│   ├── __main__.py        # Entry point (python -m app)
│   └── server.py          # Flask server with API endpoints
│
├── workflow/               # Workflow execution logic
│   ├── __init__.py        # Workflow module exports
│   ├── execution_engine.py    # Execution engine
│   ├── graph_builder.py       # Dependency graph builder
│   └── topological_sort.py   # Topological sorting
│
├── executors/              # Node executors (by node types)
│   ├── __init__.py
│   ├── base.py            # ExecutorResult, NodeExecutor
│   ├── registry.py        # Executor registry
│   ├── ollama_executor.py
│   ├── python_executor.py
│   ├── text_input_executor.py
│   ├── settings_executor.py
│   └── filewriter_executor.py
│
├── tests/                  # Tests
│   ├── __init__.py
│   ├── fixtures/          # Test data
│   │   ├── test_workflow_simple.json
│   │   └── test_workflow_mock.json
│   ├── test_workflow_api.py       # HTTP API test
│   ├── test_workflow_standalone.py # Standalone test (no server)
│   └── test_curl_example.sh       # Curl test
│
├── docs/                   # Documentation
│   ├── README_EXECUTORS.md
│   └── README_TESTING.md
│
├── config/                 # Configuration
│   ├── requirements.txt
│   ├── Dockerfile
│   └── env.example
│
├── README.md               # Main documentation
└── STRUCTURE.md            # This file
```

## Running

### Development
```bash
# From backend/ root
python -m app

# Or directly
python app/server.py
```

### Testing
```bash
# Standalone (no server)
python tests/test_workflow_standalone.py

# Via API (requires running server)
python tests/test_workflow_api.py
```

## Imports

All imports should be absolute:

```python
# ✅ Correct
from workflow.execution_engine import ExecutionEngine
from executors.ollama_executor import execute_ollama

# ❌ Incorrect
from .execution_engine import ExecutionEngine
from executors import ollama_executor
```

## Legacy Files

Deprecated files moved to `legacy/`:
- `legacy/node_executors.py` - old executor format (replaced by `executors/`)
- `legacy/workflow_order.py` - old sorting logic (replaced by `workflow/topological_sort.py`)

These files can be deleted after full migration to the new architecture.

