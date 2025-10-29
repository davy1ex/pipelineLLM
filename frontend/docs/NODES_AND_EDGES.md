# Nodes, Edges and Workflow Structure

## Overview

This document explains the fundamental concepts of workflow construction in PipelineLLM: **Nodes** and **Edges**.

The workflow system is built on top of ReactFlow, which provides a node-based visual programming interface. Understanding nodes and edges is essential for working with workflows.

## 🔵 What is a Node?

A **Node** is a single unit of work in the workflow. It represents a step, operation, or component that processes data.

### Visual Representation

```
┌─────────────────────┐
│   📝 Text Input     │  ← Node label
│  ┌───────────────┐  │
│  │ Input field   │  │  ← Node content
│  └───────────────┘  │
│         ○           │  ← Output handle
└─────────────────────┘
```

### Node Structure

```typescript
interface Node {
  id: string;           // Unique identifier
  type: string;         // Node type ('default', 'input', 'output', etc.)
  position: {           // Position on canvas
    x: number;
    y: number;
  };
  data: {               // Custom data
    label: string;      // Display label
    // ... other custom fields
  };
  // Optional fields
  selected?: boolean;
  dragging?: boolean;
  width?: number;
  height?: number;
}
```

### Node Properties Explained

#### `id: string`
**Purpose**: Unique identifier for the node.

**Requirements:**
- Must be unique across all nodes
- Used to reference node in edges
- Used for CRUD operations

**Example:**
```typescript
id: 'input-1'           // Good
id: `llm-${Date.now()}` // Good (timestamp ensures uniqueness)
id: 'node-1'            // Only if you manage uniqueness
```

#### `type: string`
**Purpose**: Defines how the node looks and behaves.

**Built-in types:**
- `'default'` - Standard rectangular node
- `'input'` - Input node (future custom type)
- `'output'` - Output node (future custom type)

**Example:**
```typescript
type: 'default'  // Current usage
type: 'input'    // Future: custom InputNode component
type: 'llm'      // Future: custom LLMNode component
```

#### `position: { x, y }`
**Purpose**: Node location on the canvas.

**Coordinates:**
- Origin (0, 0) is top-left of canvas
- X increases to the right
- Y increases downward
- Units: pixels

**Example:**
```typescript
position: { x: 100, y: 100 }    // Top-left area
position: { x: 500, y: 300 }    // Middle-right area
```

#### `data: { label, ... }`
**Purpose**: Custom data attached to the node.

**Common fields:**
- `label` - Display text
- Any custom fields for your logic

**Example:**
```typescript
data: { label: '📝 Text Input' }
data: { 
  label: '🤖 LLM Node',
  model: 'llama3.2',
  temperature: 0.7
}
```

### Node Examples

#### Text Input Node
```typescript
{
  id: 'input-1',
  type: 'default',
  position: { x: 100, y: 100 },
  data: { 
    label: '📝 Text Input',
    value: 'User prompt here'
  }
}
```

#### LLM Processing Node
```typescript
{
  id: 'llm-1',
  type: 'default',
  position: { x: 300, y: 100 },
  data: { 
    label: '🤖 LLM Node',
    model: 'ollama/llama3.2',
    temperature: 0.7,
    maxTokens: 1000
  }
}
```

#### Output Node
```typescript
{
  id: 'output-1',
  type: 'default',
  position: { x: 500, y: 100 },
  data: { 
    label: '📤 Output',
    format: 'text'
  }
}
```

## ➡️ What is an Edge?

An **Edge** is a connection between two nodes. It represents the flow of data from one node (source) to another (target).

### Visual Representation

```
┌──────────┐           ┌──────────┐
│  Node A  │ ────────→ │  Node B  │
└──────────┘           └──────────┘
   source      edge       target
```

### Edge Structure

```typescript
interface Edge {
  id: string;               // Unique identifier
  source: string;           // Source node ID
  target: string;           // Target node ID
  type?: string;            // Edge type (visual style)
  sourceHandle?: string;    // Specific output handle
  targetHandle?: string;    // Specific input handle
  label?: string;           // Edge label
  animated?: boolean;       // Animated line
  style?: CSSProperties;    // Custom styling
}
```

### Edge Properties Explained

#### `id: string`
**Purpose**: Unique identifier for the edge.

**Convention**: Usually `source-target` or `e1-2`

**Example:**
```typescript
id: 'input-1-llm-1'    // Descriptive
id: 'e1-2'             // Short form
id: `edge-${Date.now()}` // Auto-generated
```

#### `source: string`
**Purpose**: ID of the node where data flows FROM.

**Must match**: An existing node's `id`

**Example:**
```typescript
source: 'input-1'   // Data flows FROM input-1 node
```

#### `target: string`
**Purpose**: ID of the node where data flows TO.

**Must match**: An existing node's `id`

**Example:**
```typescript
target: 'llm-1'     // Data flows TO llm-1 node
```

#### `type?: string`
**Purpose**: Visual style of the edge.

**Available types:**
- `'default'` - Bezier curve
- `'straight'` - Straight line
- `'step'` - Step/stair style
- `'smoothstep'` - Smooth step style
- `'simplebezier'` - Simple bezier curve

**Example:**
```typescript
type: 'step'        // Step-style connection
type: 'smoothstep'  // Smooth step connection
```

**Visual comparison:**
```
default:     ∿∿∿∿∿∿→
straight:    ──────→
step:        ┐
             └────→
smoothstep:  ╮
             ╰────→
```

#### `animated?: boolean`
**Purpose**: Animate the edge (moving dashes).

**Use case**: Show active/running connections

**Example:**
```typescript
animated: true  // Flowing animation
```

### Edge Examples

#### Basic Connection
```typescript
{
  id: 'e1-2',
  source: 'input-1',
  target: 'llm-1'
}
```

#### Styled Step Connection
```typescript
{
  id: 'e1-2',
  type: 'step',
  source: 'input-1',
  target: 'llm-1',
  animated: false
}
```

#### Animated Connection (Running)
```typescript
{
  id: 'e2-3',
  type: 'smoothstep',
  source: 'llm-1',
  target: 'output-1',
  animated: true,
  style: { stroke: '#2196F3', strokeWidth: 2 }
}
```

#### Labeled Connection
```typescript
{
  id: 'e1-2',
  source: 'input-1',
  target: 'llm-1',
  label: 'prompt',
  type: 'step'
}
```

## 🔗 How Nodes and Edges Form a Workflow

### Simple Linear Workflow

```
Input → Process → Output
```

**Nodes:**
```typescript
const nodes = [
  { id: 'input-1', position: { x: 0, y: 100 }, data: { label: 'Input' } },
  { id: 'llm-1', position: { x: 200, y: 100 }, data: { label: 'LLM' } },
  { id: 'output-1', position: { x: 400, y: 100 }, data: { label: 'Output' } }
];
```

**Edges:**
```typescript
const edges = [
  { id: 'e1-2', source: 'input-1', target: 'llm-1' },
  { id: 'e2-3', source: 'llm-1', target: 'output-1' }
];
```

**Visual:**
```
┌─────────┐      ┌─────────┐      ┌─────────┐
│ Input   │ ───→ │   LLM   │ ───→ │ Output  │
└─────────┘      └─────────┘      └─────────┘
```

### Branching Workflow

```
         ┌→ Output A
Input →  │
         └→ Output B
```

**Nodes:**
```typescript
const nodes = [
  { id: 'input-1', position: { x: 0, y: 150 }, data: { label: 'Input' } },
  { id: 'output-a', position: { x: 200, y: 100 }, data: { label: 'Output A' } },
  { id: 'output-b', position: { x: 200, y: 200 }, data: { label: 'Output B' } }
];
```

**Edges:**
```typescript
const edges = [
  { id: 'e1-a', source: 'input-1', target: 'output-a' },
  { id: 'e1-b', source: 'input-1', target: 'output-b' }
];
```

**Visual:**
```
              ┌──────────┐
         ┌──→ │ Output A │
┌───────┐│    └──────────┘
│ Input ││
└───────┘│    ┌──────────┐
         └──→ │ Output B │
              └──────────┘
```

### Complex Workflow

```
Input → LLM → Conditional → Output A
                    ↓
                Output B
```

**Nodes:**
```typescript
const nodes = [
  { id: 'input-1', position: { x: 0, y: 150 }, data: { label: 'Input' } },
  { id: 'llm-1', position: { x: 200, y: 150 }, data: { label: 'LLM' } },
  { id: 'cond-1', position: { x: 400, y: 150 }, data: { label: 'Conditional' } },
  { id: 'out-a', position: { x: 600, y: 100 }, data: { label: 'Output A' } },
  { id: 'out-b', position: { x: 600, y: 200 }, data: { label: 'Output B' } }
];
```

**Edges:**
```typescript
const edges = [
  { id: 'e1-2', source: 'input-1', target: 'llm-1' },
  { id: 'e2-3', source: 'llm-1', target: 'cond-1' },
  { id: 'e3-a', source: 'cond-1', target: 'out-a', label: 'if true' },
  { id: 'e3-b', source: 'cond-1', target: 'out-b', label: 'if false' }
];
```

## 📋 Workflow Structure in Store

### How Store Manages Workflow

```typescript
interface WorkflowState {
  nodes: Node[];    // Array of all nodes
  edges: Edge[];    // Array of all edges
  // ... actions
}
```

### Adding to Workflow

**Add a node:**
```typescript
useWorkflowStore.getState().addNode({
  id: `node-${Date.now()}`,
  type: 'default',
  position: { x: 100, y: 100 },
  data: { label: 'New Node' }
});
```

**Add an edge (connect nodes):**
```typescript
// Manually
useWorkflowStore.getState().setEdges([
  ...edges,
  { id: 'e1-2', source: 'node-1', target: 'node-2' }
]);

// Or let ReactFlow handle it via onConnect
// User drags from one node to another
```

### Complete Workflow Example

```typescript
// Initial workflow state
const workflow = {
  nodes: [
    {
      id: 'input-1',
      type: 'default',
      position: { x: 100, y: 100 },
      data: { label: '📝 Text Input', value: '' }
    },
    {
      id: 'llm-1',
      type: 'default',
      position: { x: 300, y: 100 },
      data: { label: '🤖 LLM Node', model: 'llama3.2' }
    },
    {
      id: 'output-1',
      type: 'default',
      position: { x: 500, y: 100 },
      data: { label: '📤 Output' }
    }
  ],
  edges: [
    { id: 'e1-2', type: 'step', source: 'input-1', target: 'llm-1' },
    { id: 'e2-3', type: 'step', source: 'llm-1', target: 'output-1' }
  ]
};

// Load into store
useWorkflowStore.getState().setNodes(workflow.nodes);
useWorkflowStore.getState().setEdges(workflow.edges);
```

## 🎯 Node Types (Current & Future)

### Current Implementation

All nodes use `type: 'default'`:
```typescript
{ id: '1', type: 'default', position: {...}, data: { label: '...' } }
```

### Future Custom Nodes

#### Text Input Node
```typescript
{
  id: 'input-1',
  type: 'textInput',  // Custom type
  position: { x: 100, y: 100 },
  data: {
    label: 'Text Input',
    value: '',
    placeholder: 'Enter text...'
  }
}
```

**Will render:**
```
┌─────────────────────┐
│   📝 Text Input     │
│ ┌─────────────────┐ │
│ │ [Enter text...] │ │
│ └─────────────────┘ │
│         ○           │ output
└─────────────────────┘
```

#### LLM Node
```typescript
{
  id: 'llm-1',
  type: 'llm',
  position: { x: 300, y: 100 },
  data: {
    label: 'LLM Processor',
    model: 'ollama/llama3.2',
    temperature: 0.7,
    maxTokens: 1000,
    systemPrompt: 'You are a helpful assistant'
  }
}
```

**Will render:**
```
┌─────────────────────┐
│   🤖 LLM Processor  │
│                     │
│ Model: llama3.2     │
│ Temp: 0.7          │
│ Max tokens: 1000    │
│                     │
○         ○           │ input/output
└─────────────────────┘
```

#### Output Node
```typescript
{
  id: 'output-1',
  type: 'output',
  position: { x: 500, y: 100 },
  data: {
    label: 'Output Display',
    format: 'text',
    result: 'LLM response here...'
  }
}
```

**Will render:**
```
┌─────────────────────┐
○ input
│  📤 Output Display  │
│ ┌─────────────────┐ │
│ │ LLM response    │ │
│ │ here...         │ │
│ └─────────────────┘ │
└─────────────────────┘
```

## 🔄 Workflow Execution Flow

### How Data Flows Through Workflow

1. **User provides input** in Input Node
2. **Input Node** outputs data
3. **Edge** carries data to next node
4. **LLM Node** receives data, processes it
5. **LLM Node** outputs result
6. **Edge** carries result to Output Node
7. **Output Node** displays result

```
┌─────────┐       ┌─────────┐       ┌─────────┐
│ Input   │       │   LLM   │       │ Output  │
│  [text] │ ───→  │ process │ ───→  │ [result]│
└─────────┘       └─────────┘       └─────────┘
     ↓                 ↓                 ↓
   "Hello"    →   (AI process)  →   "Response"
```

### Execution Order

ReactFlow/workflow engine determines execution order based on **topology**:

```
A → B → D
  ↘ C ↗

Execution order: A → (B, C can run in parallel) → D
```

**Topological sort** ensures:
- Dependencies are respected
- Parallel execution where possible
- No cycles (for now)

## 💾 Saving and Loading Workflows

### Save Workflow

```typescript
const saveWorkflow = () => {
  const { nodes, edges } = useWorkflowStore.getState();
  
  const workflow = {
    version: '1.0',
    timestamp: Date.now(),
    nodes,
    edges
  };
  
  // Save to localStorage
  localStorage.setItem('workflow', JSON.stringify(workflow));
  
  // Or save to backend
  fetch('/api/workflows', {
    method: 'POST',
    body: JSON.stringify(workflow)
  });
};
```

### Load Workflow

```typescript
const loadWorkflow = () => {
  // From localStorage
  const saved = localStorage.getItem('workflow');
  const workflow = JSON.parse(saved);
  
  // Or from backend
  // const workflow = await fetch('/api/workflows/123').then(r => r.json());
  
  // Load into store
  useWorkflowStore.getState().setNodes(workflow.nodes);
  useWorkflowStore.getState().setEdges(workflow.edges);
};
```

### Workflow JSON Format

```json
{
  "version": "1.0",
  "timestamp": 1698765432000,
  "nodes": [
    {
      "id": "input-1",
      "type": "default",
      "position": { "x": 100, "y": 100 },
      "data": { "label": "Text Input" }
    },
    {
      "id": "llm-1",
      "type": "default",
      "position": { "x": 300, "y": 100 },
      "data": { "label": "LLM Node" }
    }
  ],
  "edges": [
    {
      "id": "e1-2",
      "type": "step",
      "source": "input-1",
      "target": "llm-1"
    }
  ]
}
```

## 🎨 Visual Best Practices

### Node Positioning

**Good spacing:**
```
┌────┐     ┌────┐     ┌────┐
│ A  │ ──→ │ B  │ ──→ │ C  │
└────┘     └────┘     └────┘
  x=0       x=200      x=400
```

**Recommended:**
- Horizontal spacing: 200px
- Vertical spacing: 100px
- Grid alignment: multiples of 50

### Edge Types by Use Case

- **`default`** - General connections
- **`step`** - Clear directional flow ✅ (current)
- **`smoothstep`** - Smooth appearance
- **`straight`** - Simple, direct connections

### Color Coding (Future)

```typescript
// Node colors by type
data: {
  label: '📝 Input',
  color: '#4CAF50'  // Green for input
}

data: {
  label: '🤖 LLM',
  color: '#2196F3'  // Blue for processing
}

data: {
  label: '📤 Output',
  color: '#FF9800'  // Orange for output
}
```

## 🐛 Common Issues

### Edge Not Connecting

**Problem**: Edge doesn't appear

**Check:**
1. Source node exists: `nodes.find(n => n.id === edge.source)`
2. Target node exists: `nodes.find(n => n.id === edge.target)`
3. Edge ID is unique
4. Nodes have handles enabled

### Node Not Appearing

**Problem**: Added node doesn't show

**Check:**
1. Node ID is unique
2. Position is within canvas bounds
3. Node is added to store: `useWorkflowStore.getState().nodes`
4. ReactFlow is subscribed to store

### Nodes Overlapping

**Solution**: Calculate positions
```typescript
const calculatePosition = (index: number) => ({
  x: index * 250,
  y: 100
});
```

## 📚 Related Documentation

- [WORKFLOW_STORE.md](./WORKFLOW_STORE.md) - Store that manages nodes and edges
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Overall frontend architecture
- [ReactFlow Documentation](https://reactflow.dev/learn) - Official ReactFlow docs

## 🚀 Next Steps

Once you understand nodes and edges:

1. Read [WORKFLOW_STORE.md](./WORKFLOW_STORE.md) - How to manage them
2. Explore custom node types (Milestone 2)
3. Implement workflow execution engine (Milestone 4)
4. Add save/load functionality (Milestone 6)

---

**Last Updated**: October 29, 2025  
**Related**: ReactFlow, workflowStore, workflow execution


