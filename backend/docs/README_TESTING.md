# Testing Backend Workflow Execution

## Quick Test

### 1. Start Backend Server

```bash
cd backend
python server.py
```

Server should start on `http://localhost:5000`

### 2. Test with Python Script

```bash
# Simple test (no Ollama required)
python test_workflow_api.py test_workflow_simple.json

# Test with Ollama (requires Ollama running)
python test_workflow_api.py test_workflow_mock.json
```

### 3. Test with curl

```bash
# Simple test
curl -X POST http://localhost:5000/api/workflow/execute \
  -H "Content-Type: application/json" \
  -d @test_workflow_simple.json | python3 -m json.tool

# Or use the script
./test_curl_example.sh
```

## Test Files

- **`test_workflow_simple.json`**: Simple Python workflow (TextInput → Python → Output)
- **`test_workflow_mock.json`**: Ollama workflow (TextInput → Ollama → Output, with Settings)

## Expected Output

```json
{
  "results": {
    "input-1": {
      "output": "Hello World",
      "error": null
    },
    "python-1": {
      "output": "HELLO WORLD",
      "error": null,
      "stdout": "",
      "stderr": ""
    }
  },
  "executionLog": [
    "Starting workflow execution: 2 executable nodes",
    "Iteration 1",
    "Executing node input-1 (textInput)",
    "Node input-1 completed successfully",
    ...
  ],
  "iterations": 2
}
```

## Troubleshooting

### 502 Bad Gateway
- **Problem**: Server error (usually import issues)
- **Solution**: Check server logs, ensure all imports are absolute (not relative)

### Connection Refused
- **Problem**: Server not running
- **Solution**: Start server with `python server.py`

### Timeout
- **Problem**: Ollama not responding or taking too long
- **Solution**: Check Ollama is running, reduce timeout or use simple test

### Import Errors
- **Problem**: Relative imports failing
- **Solution**: All imports should be absolute:
  - ✅ `from executors.base import ExecutorResult`
  - ❌ `from .base import ExecutorResult`

