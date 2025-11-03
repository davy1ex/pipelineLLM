# Workflow JSON Format

This document describes the workflow JSON format used for import/export and backend execution.

## Format Structure

The workflow is stored as a JSON object with the following structure:

```typescript
interface WorkflowFile {
  version: number;        // Format version (currently 1)
  nodes: Node[];          // Array of workflow nodes
  edges: Edge[];          // Array of connections between nodes
  exportedAt?: string;   // ISO timestamp (optional, for exports)
}
```

## Node Structure

Each node follows the ReactFlow `Node` structure:

```typescript
interface Node {
  id: string;                    // Unique identifier
  type: string;                  // Node type (see below)
  position: {                    // Canvas position (for UI only)
    x: number;
    y: number;
  };
  data: Record<string, unknown>; // Node-specific data (see node types)
}
```

### Node Types

#### `textInput`
**Purpose**: Text input node (entry point)

**Required fields in `data`**:
- `label: string` - Display label
- `value: string` - Text value (user input)

**Example**:
```json
{
  "id": "input-1",
  "type": "textInput",
  "position": { "x": 100, "y": 240 },
  "data": {
    "label": "📝 Text Input",
    "value": "Hello, world!"
  }
}
```

#### `settings`
**Purpose**: Ollama configuration node

**Required fields in `data`**:
- `label: string` - Display label
- `url: string` - Ollama server URL (default: "http://localhost:11434")
- `model: string` - Model name (default: "llama3.2")
- `temperature?: number` - Temperature (default: 0.7)

**Example**:
```json
{
  "id": "settings-1",
  "type": "settings",
  "position": { "x": 50, "y": 140 },
  "data": {
    "label": "⚙️ Settings",
    "url": "http://localhost:11434",
    "model": "llama3.2",
    "temperature": 0.7
  }
}
```

#### `ollama`
**Purpose**: LLM execution node

**Required fields in `data`**:
- `label: string` - Display label
- `model?: string` - Model name (fallback if no config edge)
- `url?: string` - Ollama URL (fallback if no config edge)
- `temperature?: number` - Temperature (default: 0.7)
- `systemPrompt?: string` - System prompt (fallback if no systemPrompt edge)

**Inputs** (via edges):
- `prompt` handle or default edge → prompt text
- `systemPrompt` handle → system prompt (optional)
- `config` handle → settings node (url, model, temperature)

**Example**:
```json
{
  "id": "ollama-1",
  "type": "ollama",
  "position": { "x": 300, "y": 240 },
  "data": {
    "label": "🧪 Ollama",
    "model": "llama3.2",
    "temperature": 0.7
  }
}
```

#### `python`
**Purpose**: Python code execution node

**Required fields in `data`**:
- `label: string` - Display label
- `code: string` - Python code to execute
- `output?: string` - Execution result (set during execution)

**Inputs** (via edges):
- `input` handle or default edge → input data (injected as `data_input` variable)

**Example**:
```json
{
  "id": "python-1",
  "type": "python",
  "position": { "x": 200, "y": 240 },
  "data": {
    "label": "🐍 Python",
    "code": "# Process input\noutput = data_input.upper() if data_input else ''"
  }
}
```

#### `output`
**Purpose**: Output display node

**Required fields in `data`**:
- `label: string` - Display label
- `text: string` - Output text (set during execution)

**Inputs** (via edges):
- `text` handle or default edge → text to display

**Example**:
```json
{
  "id": "output-1",
  "type": "output",
  "position": { "x": 560, "y": 240 },
  "data": {
    "label": "📤 Output",
    "text": ""
  }
}
```

#### `fileWriter`
**Purpose**: File writer node

**Required fields in `data`**:
- `label: string` - Display label
- `filename: string` - Output filename

**Inputs** (via edges):
- `text` handle or default edge → text to write

**Example**:
```json
{
  "id": "file-writer-1",
  "type": "fileWriter",
  "position": { "x": 700, "y": 240 },
  "data": {
    "label": "💾 Save To File",
    "filename": "result.txt"
  }
}
```

## Edge Structure

Each edge represents a connection between nodes:

```typescript
interface Edge {
  id: string;              // Unique identifier
  source: string;          // Source node ID
  target: string;          // Target node ID
  sourceHandle?: string;   // Handle ID on source node (optional)
  targetHandle?: string;   // Handle ID on target node (optional)
  type?: string;           // Edge type (usually "step")
}
```

### Edge Semantics

- **`sourceHandle`**: Specifies which output handle on the source node (if node has multiple outputs)
- **`targetHandle`**: Specifies which input handle on the target node (if node has multiple inputs)
- **Missing handles**: If `targetHandle` is missing, it's treated as the default input handle
- **Handle names**: Match the handles defined in `NODE_HANDLES` (see `shared/lib/nodeHandles.ts`)

**Example edges**:
```json
[
  {
    "id": "e1-2",
    "source": "input-1",
    "target": "python-1",
    "type": "step"
  },
  {
    "id": "e2-3",
    "source": "python-1",
    "target": "ollama-1",
    "sourceHandle": "output",
    "targetHandle": "prompt",
    "type": "step"
  },
  {
    "id": "e4-3",
    "source": "settings-1",
    "target": "ollama-1",
    "sourceHandle": "config",
    "targetHandle": "config",
    "type": "step"
  }
]
```

## Complete Example

```json
{
  "version": 1,
  "exportedAt": "2024-12-15T10:30:00.000Z",
  "nodes": [
    {
      "id": "settings-1",
      "type": "settings",
      "position": { "x": 50, "y": 140 },
      "data": {
        "label": "⚙️ Settings",
        "url": "http://localhost:11434",
        "model": "llama3.2"
      }
    },
    {
      "id": "input-1",
      "type": "textInput",
      "position": { "x": 100, "y": 240 },
      "data": {
        "label": "📝 Text Input",
        "value": "Hello!"
      }
    },
    {
      "id": "ollama-1",
      "type": "ollama",
      "position": { "x": 300, "y": 240 },
      "data": {
        "label": "🧪 Ollama",
        "temperature": 0.7
      }
    },
    {
      "id": "output-1",
      "type": "output",
      "position": { "x": 560, "y": 240 },
      "data": {
        "label": "📤 Output",
        "text": ""
      }
    }
  ],
  "edges": [
    {
      "id": "e1-2",
      "source": "input-1",
      "target": "ollama-1",
      "sourceHandle": "output",
      "targetHandle": "prompt",
      "type": "step"
    },
    {
      "id": "e3-4",
      "source": "settings-1",
      "target": "ollama-1",
      "sourceHandle": "config",
      "targetHandle": "config",
      "type": "step"
    },
    {
      "id": "e2-5",
      "source": "ollama-1",
      "target": "output-1",
      "sourceHandle": "output",
      "targetHandle": "text",
      "type": "step"
    }
  ]
}
```

## Backend Execution Requirements

This JSON format is **sufficient** for backend execution. The backend needs:

1. **Graph structure**: `nodes` and `edges` arrays provide complete graph topology
2. **Node data**: Each node's `data` field contains execution parameters:
   - `textInput`: `data.value` → constant input
   - `python`: `data.code` → code to execute
   - `ollama`: `data.model`, `data.url`, `data.temperature` → LLM config
   - `settings`: `data.url`, `data.model`, `data.temperature` → config output
3. **Input resolution**: Edges with `sourceHandle`/`targetHandle` map inputs to outputs
4. **Dependency graph**: Backend can build execution order from edges (topological sort)

### Data Resolution Rules (for Backend)

When resolving inputs for a node:

1. **Find incoming edges**:
   - For specific handle: `edge.target === nodeId && edge.targetHandle === handleId`
   - For default: `edge.target === nodeId && !edge.targetHandle`

2. **Get source data**:
   - Priority 1: Execution result cache (if source node already executed)
   - Priority 2: `sourceNode.data.value || sourceNode.data.text || sourceNode.data.output`

3. **For Ollama nodes**:
   - `prompt`: from edge with `targetHandle='prompt'` or default edge
   - `systemPrompt`: from edge with `targetHandle='systemPrompt'`, fallback to `node.data.systemPrompt`
   - `config`: from edge with `targetHandle='config'` (Settings node), fallback to `node.data`

4. **For Python nodes**:
   - `input`: from edge with `targetHandle='input'` or default edge
   - Input injected as `data_input` and `input_data` variables

## Import/Export

### Export

```typescript
import { exportWorkflow } from '@/features/canvas/lib/workflowIO';

const nodes = useWorkflowStore((state) => state.nodes);
const edges = useWorkflowStore((state) => state.edges);

exportWorkflow(nodes, edges, 'my-workflow.json');
```

### Import

```typescript
import { parseWorkflowFile } from '@/features/canvas/lib/workflowIO';

const file = event.target.files[0];
const workflow = await parseWorkflowFile(file);

useWorkflowStore.getState().setNodes(workflow.nodes);
useWorkflowStore.getState().setEdges(workflow.edges);
```

## Compatibility Notes

- **Position**: `position` field is for UI rendering only and ignored during execution
- **Version**: Format version 1 is current; future versions may add fields
- **Optional fields**: Missing optional fields use defaults (e.g., `temperature: 0.7`)
- **Handles**: Missing handles default to first input/output handle or default connection

## Migration to Backend Execution

The current format is **fully compatible** with backend execution. When migrating:

1. Frontend sends complete `WorkflowFile` JSON to `POST /api/workflow/execute`
2. Backend parses nodes/edges and builds dependency graph
3. Backend performs topological sort and executes nodes
4. Backend returns execution results per node
5. Frontend updates UI with results

No format changes required! 🎉

---

**Last Updated**: December 2024  
**Format Version**: 1

