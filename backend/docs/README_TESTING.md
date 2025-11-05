# Testing Backend Workflow Execution

## Quick Test

### 1. Start Backend Server

Recommended (module):
```bash
cd backend
python -m app
```

Docker (via project docker/):
```bash
cd docker
docker compose up -d --build backend
```

- Local run: server listens on `http://localhost:5000`
- Docker compose: backend is mapped to host `http://localhost:5001` and proxied by nginx at `http://localhost`

### 2. Test via Python scripts

Queue-based API test (enqueue + poll):
```bash
python tests/test_workflow_api.py tests/fixtures/test_workflow_simple.json
```

Standalone engine (no server):
```bash
python tests/test_workflow_standalone.py tests/fixtures/test_workflow_simple.json
```

End-to-end (order + partial failures):
```bash
python tests/test_workflow_e2e.py
```

### 3. Test with curl (enqueue + poll)

Local server (default 5000):
```bash
# Enqueue
curl -s -X POST http://localhost:5000/api/workflow/execute \
  -H "Content-Type: application/json" \
  -d @tests/fixtures/test_workflow_simple.json | tee /tmp/exec.json

# Extract queueId
QUEUE_ID=$(cat /tmp/exec.json | python3 -c 'import sys,json;print(json.load(sys.stdin).get("queueId",""))')

# Poll status until completed
curl -s http://localhost:5000/api/workflow/$QUEUE_ID/status | python3 -m json.tool
```

Docker compose (backend mapped to 5001):
```bash
curl -s -X POST http://localhost:5001/api/workflow/execute \
  -H "Content-Type: application/json" \
  -d @tests/fixtures/test_workflow_simple.json | tee /tmp/exec.json

QUEUE_ID=$(cat /tmp/exec.json | python3 -c 'import sys,json;print(json.load(sys.stdin).get("queueId",""))')

curl -s http://localhost:5001/api/workflow/$QUEUE_ID/status | python3 -m json.tool
```

### 4. Ollama workflow

- Ensure Ollama is running and the model is pulled:
```bash
ollama serve
ollama pull llama3.2   # or the model from Settings node
```
- For Docker: using `http://localhost:11434` in the Settings node is normalized to `http://host.docker.internal:11434`.

## Test Fixtures

- `tests/fixtures/test_workflow_simple.json`: TextInput → Python → Output (no Ollama)
- `tests/fixtures/test_workflow_mock.json`: TextInput → Ollama → Output (requires Ollama)

## Expected Status Response (excerpt)

```json
{
  "queueId": "...",
  "status": "completed",
  "runningNodeIds": [],
  "completedNodeIds": ["input-1","python-1"],
  "results": {
    "python-1": { "output": "HELLO WORLD", "error": null }
  },
  "executionLog": ["Starting workflow execution: ..."],
  "iterations": 1,
  "hasErrors": false
}
```

## Troubleshooting

- 502 Bad Gateway (nginx): backend not reachable or wrong port mapping. Verify backend logs and compose port mapping (5000→5001).
- Connection refused to Ollama: run `ollama serve`, set Settings URL appropriately; for Docker, `localhost` becomes `host.docker.internal`.
- Long polling: normal while the engine finalizes. Increase frontend pollInterval or enable early-stop when all nodes succeeded.

