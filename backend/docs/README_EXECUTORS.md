# Backend Execution Architecture

Modular architecture for workflow execution on backend.

## Structure

```
backend/
├── executors/              # Node executors (by node types)
│   ├── __init__.py        # Export all executors
│   ├── base.py            # Base types (ExecutorResult, NodeExecutor)
│   ├── ollama_executor.py # Executor for Ollama nodes
│   ├── python_executor.py # Executor for Python nodes
│   ├── text_input_executor.py # Executor for TextInput nodes
│   ├── settings_executor.py   # Executor for Settings nodes
│   ├── filewriter_executor.py # Executor for FileWriter nodes
│   └── registry.py        # Registry to get executors by type
├── graph_builder.py        # Dependency graph builder
├── topological_sort.py     # Topological sorting
├── execution_engine.py     # Execution engine (orchestration)
└── server.py              # Flask API endpoints
```

## Principles

### 1. Executors (executors/)

Each executor is a pure function that:
- Takes: `(node: Dict, inputs: Dict)`
- Returns: `ExecutorResult`
- Has no side-effects (except logging)
- Works with ReactFlow format (`node.data` instead of `widgets_values`)

**Example**:
```python
def execute_ollama(node: Dict[str, Any], inputs: Dict[str, Any]) -> ExecutorResult:
    node_data = node.get('data', {})
    prompt = inputs.get('prompt') or node_data.get('prompt', '')
    # ... execution ...
    return ExecutorResult(output=response_text, error=None)
```

### 2. Graph Builder (graph_builder.py)

Builds dependency graph from ReactFlow format:
- Parses `nodes` and `edges`
- Creates `DependencyGraph` with dependencies
- Stores connections for input resolution

### 3. Topological Sort (topological_sort.py)

Determines execution order:
- Uses Kahn's algorithm
- Considers only executable nodes
- Handles cycles (adds to end)

### 4. Execution Engine (execution_engine.py)

Orchestrates execution:
- Resolves inputs from upstream nodes
- Executes nodes in topological order
- Caches results
- Supports iterative passes (for cycles)

## API

### POST /api/workflow/execute

Accepts:
```json
{
  "version": 1,
  "nodes": [...],
  "edges": [...]
}
```

Returns:
```json
{
  "results": {
    "node-id-1": {
      "output": "...",
      "error": null,
      "metadata": {...}
    }
  },
  "executionLog": ["Executing node...", ...],
  "iterations": 2
}
```

## Adding New Node Type

1. Create executor in `executors/`:
   ```python
   # executors/my_node_executor.py
   def execute_my_node(node: Dict, inputs: Dict) -> ExecutorResult:
       # execution logic
       return ExecutorResult(output=result, error=None)
   ```

2. Register in `executors/registry.py`:
   ```python
   _EXECUTOR_REGISTRY['myNode'] = execute_my_node
   ```

3. Add input resolution in `execution_engine.py.resolve_inputs()`:
   ```python
   elif node_type == 'myNode':
       # resolve inputs
   ```

Done! Engine automatically supports the new node type.

## Data Format

### Node (ReactFlow)
```python
{
  "id": "node-1",
  "type": "ollama",
  "position": {"x": 100, "y": 200},
  "data": {
    "label": "🧪 Ollama",
    "model": "llama3.2",
    "temperature": 0.7,
    # ... other fields
  }
}
```

### Edge (ReactFlow)
```python
{
  "id": "edge-1",
  "source": "node-1",
  "target": "node-2",
  "sourceHandle": "output",
  "targetHandle": "prompt"
}
```

## Data Resolution Priority

When resolving input from source node:
1. **Cached result** (`self.results[source_id].output`) - execution result
2. **Node data** (`source_node.data.value|text|output|lastResponse`) - fallback

This allows iterative passes to use fresh results.

