# PythonNode — executing Python code

## How it works

- Input: Python source code typed in the `PythonNode` textarea. If the node has an incoming `input` (left connector), the upstream string value is available in your code as `data_input` (there is also a backward‑compat alias `input_data`).
- Backend call: the frontend posts your code to `POST /api/python/execute`.
- Execution: the backend runs `exec(code, namespace)` while capturing stdout/stderr in an isolated namespace.
- Output:
  - If your code sets a variable named `output`, that value is returned as the node result.
  - Otherwise, stdout is used as a fallback result.
- Propagation: the result is stored in `node.data.output` and becomes available to downstream nodes via the standard read order `value → text → output`.

Example:
```python
# data_input contains the upstream string (if there's an edge connected to 'input')
import math
output = f"len={len(data_input)}, sqrt(16)={math.isqrt(16)}"
print("processed")  # goes to stdout; used as fallback if 'output' is not set

# Alias for backward compatibility also exists:
# output = input_data.upper()
```

## Connectors
- left target: `input` — string from an upstream node (TextInput, Ollama, or another Python); available in code as `data_input`
- right source: `output` — string result of the node (from `output` variable or stdout)

## Execution order
- Python nodes run first (topologically), then Ollama nodes.
- If the upstream node already executed (Python/Ollama), its cached result `nodeResults` is used.
- Otherwise, the engine reads from `sourceNode.data.value | text | output`.

## Adding Python libraries
To use third‑party modules (pdf, http, nlp, etc.) in your node code:

1) Add the package to `backend/requirements.txt`
- Examples:
  - PDF: `pypdf`
  - DOCX: `python-docx`
  - Tables: `pandas`
  - HTTP: `httpx`
  - NLP: `spacy`, `transformers`
  - Django is possible, but it’s a server framework; for inline scripts prefer focused utility libraries

2) Install dependencies
- Locally:
```bash
cd backend
pip install -r requirements.txt
```
- Docker:
```bash
docker compose -f docker/docker-compose.yml build
docker compose -f docker/docker-compose.yml up
```

3) Import the module in your Python node code
```python
import pypdf
output = f"PDF available: {hasattr(pypdf, 'PdfReader')}"
```

## Recommendations & security
- The request duration equals your code runtime; long tasks increase latency.
- Do not execute untrusted code.
- For production consider:
  - sandboxing/containers,
  - resource/time limits,
  - import allow‑lists.

## Extending functionality
- Files: add a backend upload API and pass file paths/IDs to `data_input` via an edge.
- Networking: use `httpx` in your node code; mind timeouts.
- Post‑processing: write the final value to `output` — it will automatically flow to downstream nodes.
