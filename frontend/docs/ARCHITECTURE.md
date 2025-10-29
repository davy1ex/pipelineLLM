# Frontend Architecture

## Overview

PipelineLLM frontend is a React-based application following **Feature-Sliced Design (FSD)** methodology. The application provides a visual node-based interface for building LLM workflows.

## Tech Stack

- **React 19** - UI library with modern hooks
- **TypeScript** - Type safety and better DX
- **Vite** - Fast build tool and dev server
- **ReactFlow (@xyflow/react)** - Node-based workflow visualization
- **Zustand** - Lightweight state management
- **ESLint** - Code quality and consistency

## Architecture Pattern: Feature-Sliced Design

### Why FSD?

Traditional approaches organize code by technical layers (components/, hooks/, utils/), which leads to:
- ❌ Features scattered across multiple directories
- ❌ Hard to find all code related to a feature
- ❌ Difficult to scale and maintain
- ❌ Tight coupling between unrelated features

FSD organizes code by **business features** (slices), where each feature is self-contained:
- ✅ All feature code in one place
- ✅ Clear boundaries and dependencies
- ✅ Easy to find, modify, and test
- ✅ Scalable architecture

### Directory Structure

```
src/
├── app/                    # Application initialization
│   └── components/         # Global components
│       └── ErrorBoundary.tsx
│
├── pages/                  # Page-level routing
│   └── workflow/
│       └── WorkFlowPage.tsx
│
├── features/               # Business features (main layer)
│   └── workflow/           # Workflow feature
│       ├── model/          # Business logic & state
│       │   ├── workflowStore.ts
│       │   ├── initWorkflow.ts
│       │   └── index.ts
│       ├── ui/             # UI components
│       │   ├── WorkFlowFrame.tsx
│       │   ├── WorkFlowToolbar.tsx
│       │   └── index.ts
│       └── index.ts        # Public API
│
├── widgets/                # Composite UI blocks (future)
├── entities/               # Business entities (future)
├── shared/                 # Reusable utilities (future)
└── assets/                 # Static files
```

## Layers Hierarchy

```
app      → uses → pages, features, widgets, entities, shared
pages    → uses → features, widgets, entities, shared
features → uses → entities, shared
widgets  → uses → features, entities, shared
entities → uses → shared
shared   → uses → nothing (self-contained)
```

**Rule**: Lower layers **cannot** import from upper layers.

## State Management

### Zustand Approach

We use **Zustand** for state management instead of Redux because:
- ✅ Minimal boilerplate
- ✅ No providers needed
- ✅ Simple API
- ✅ TypeScript friendly
- ✅ DevTools support

### Store Organization

Each feature has its own store in `features/{feature}/model/`:

```
features/workflow/
  model/
    workflowStore.ts    ← Zustand store for workflow state
```

**Benefits:**
- Feature isolation
- No global state pollution
- Easy to test
- Clear ownership

See [WORKFLOW_STORE.md](./WORKFLOW_STORE.md) for detailed store documentation.

## Component Architecture

### 1. Pages Layer

**Purpose**: Route-level components that compose features.

```typescript
// pages/workflow/WorkFlowPage.tsx
export const WorkFlowPage = () => {
  // Initialize workflow with demo data
  const setNodes = useWorkflowStore((state) => state.setNodes);
  const setEdges = useWorkflowStore((state) => state.setEdges);

  useEffect(() => {
    if (nodes.length === 0) {
      setNodes(getInitialNodes());
      setEdges(getInitialEdges());
    }
  }, []);

  return (
    <div>
      <WorkFlowFrame />
      <WorkFlowToolbar />
    </div>
  );
};
```

### 2. Features Layer

**Purpose**: Business features with state, logic, and UI.

#### Workflow Feature Structure

```
features/workflow/
├── model/                      # State & Logic
│   ├── workflowStore.ts        # Zustand store
│   ├── initWorkflow.ts         # Initial data
│   └── index.ts                # Exports
├── ui/                         # UI Components
│   ├── WorkFlowFrame.tsx       # Canvas component
│   ├── WorkFlowToolbar.tsx     # Toolbar component
│   └── index.ts                # Exports
└── index.ts                    # Public API
```

#### Public API Pattern

```typescript
// features/workflow/index.ts
export { WorkFlowFrame, WorkFlowToolbar } from './ui';
export { useWorkflowStore, getInitialNodes, getInitialEdges } from './model';
```

**Usage:**
```typescript
import {
  WorkFlowFrame,
  useWorkflowStore,
  getInitialNodes
} from '../../features/workflow';
```

### 3. App Layer

**Purpose**: Global application setup.

Currently contains:
- `ErrorBoundary` - Catches React errors globally

## Data Flow

### Typical User Interaction Flow

```
1. User clicks "Add Node" button
         ↓
2. WorkFlowToolbar.handleAddNode()
         ↓
3. useWorkflowStore.addNode(newNode)
         ↓
4. Zustand updates store state
         ↓
5. WorkFlowFrame re-renders (subscribed to store)
         ↓
6. ReactFlow displays new node
```

### State Management Flow

```typescript
// Subscribe to specific state
const nodes = useWorkflowStore((state) => state.nodes);

// Component only re-renders when nodes change
// Not when edges or other state changes
```

## TypeScript Patterns

### Type-Only Imports

For types from external libraries, use `import type`:

```typescript
// ✅ Correct
import type { Node, Edge } from '@xyflow/react';

// ❌ Wrong - runtime import error
import { Node, Edge } from '@xyflow/react';
```

**Why?** With `verbatimModuleSyntax` enabled, TypeScript requires explicit type-only imports for types.

### Store Typing

```typescript
interface WorkflowState {
  // State
  nodes: Node[];
  edges: Edge[];
  
  // Actions
  addNode: (node: Node) => void;
  removeNode: (nodeId: string) => void;
  
  // Handlers
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
}

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  // Implementation
}));
```

## Performance Optimization

### Zustand Selectors

```typescript
// ✅ Good - only re-renders when nodes change
const nodes = useWorkflowStore((state) => state.nodes);

// ❌ Bad - re-renders on any store change
const store = useWorkflowStore();
const nodes = store.nodes;
```

### ReactFlow Optimization

ReactFlow has built-in optimizations:
- Virtual rendering (only visible nodes)
- Optimized drag/drop
- Memoized edge calculations

## Error Handling

### ErrorBoundary

Global error boundary catches React errors:

```typescript
// app/components/ErrorBoundary.tsx
<ErrorBoundary>
  <WorkFlowPage />
</ErrorBoundary>
```

**Features:**
- Catches render errors
- Displays error details
- Try again button
- Reload page button

## Build & Development

### Development Server

```bash
npm run dev
```

- Hot Module Replacement (HMR)
- Fast refresh
- TypeScript checking
- ESLint on save

### Production Build

```bash
npm run build
```

- TypeScript compilation
- Vite optimization
- Code splitting
- Tree shaking
- Minification

## Testing Strategy (Future)

### Unit Tests
- Store actions
- Utility functions
- Custom hooks

### Component Tests
- UI component behavior
- User interactions
- Store integration

### E2E Tests
- Full workflow creation
- Node operations
- Save/load workflows

## Future Architecture

### Shared Layer

```
shared/
├── ui/               # UI kit components
│   ├── Button/
│   ├── Input/
│   └── Modal/
├── lib/              # Utilities
│   ├── date.ts
│   └── format.ts
└── api/              # API client
    └── client.ts
```

### Entities Layer

```
entities/
└── node/
    ├── model/
    │   ├── types.ts
    │   └── schema.ts
    └── ui/
        └── NodeCard.tsx
```

### Widgets Layer

```
widgets/
├── header/
│   └── ui/Header.tsx
└── sidebar/
    └── ui/Sidebar.tsx
```

## Key Principles

### 1. Feature Isolation
Each feature is self-contained with its own:
- State management
- UI components
- Business logic
- Public API

### 2. Single Responsibility
- **Pages**: Composition
- **Features**: Business logic
- **App**: Global setup
- **Shared**: Utilities

### 3. Clear Dependencies
- Top layers depend on bottom layers
- Bottom layers never depend on top layers
- Features don't depend on other features' internals

### 4. Public API
Each feature exports only what's needed:
- Hide implementation details
- Easy to refactor internally
- Prevents tight coupling

## Resources

### Internal Documentation
- [Nodes and Edges](./NODES_AND_EDGES.md) ← Workflow concepts (nodes, edges, execution)
- [Workflow Store Details](./WORKFLOW_STORE.md) ← Detailed store documentation

### External Resources
- [Feature-Sliced Design](https://feature-sliced.design/)
- [ReactFlow Documentation](https://reactflow.dev/)
- [Zustand Documentation](https://zustand-demo.pmnd.rs/)

---

**Last Updated**: October 29, 2025  
**Version**: 0.1.0-alpha

