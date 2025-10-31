# Frontend Documentation

Documentation for PipelineLLM frontend architecture, patterns, and components.

## 📚 Documentation Index

### [ARCHITECTURE.md](./ARCHITECTURE.md)
Complete overview of frontend architecture:
- **Feature-Sliced Design** methodology
- Directory structure and layers
- Component architecture
- State management approach
- TypeScript patterns
- Performance optimization
- Future architecture plans

**Start here** if you're new to the project.

### [WORKFLOW_FRAME.md](./WORKFLOW_FRAME.md)
How the canvas renders and how to extend it:
- WorkFlowFrame data flow and responsibilities
- Registered node types (`textInput`, `ollama`, `settings`, `output`)
- Edge policy (forced `step` on connect)
- NodeShell-based nodes with `connectors` array
- Step-by-step: add a new node type using `NodeShell`
- Toolbar and demo initialization integration

### [NODES_AND_EDGES.md](./NODES_AND_EDGES.md) 🆕
Fundamental concepts of workflow construction:
- What is a Node (structure, properties, examples)
- What is an Edge (connections, types, styling)
- How nodes and edges form a workflow
- Workflow execution flow
- How `systemPrompt` is resolved (edge first, then node data fallback)
- Saving and loading workflows
- Visual best practices
- Common issues and solutions

**Start here** to understand workflow basics.

### [WORKFLOW_STORE.md](./WORKFLOW_STORE.md)
Detailed documentation for `workflowStore` (Zustand):
- Store structure and state
- All actions and methods
- ReactFlow handlers
- Usage examples and patterns
- Performance best practices
- Common patterns (save/load, initialization)
- Troubleshooting guide

**Read this** to understand workflow state management.

### [EXECUTION.md](./EXECUTION.md)
Как запускается выполнение, порядок исполнения (Python → Ollama), правила входов/выходов, и как расширять двигатель (условия/циклы/новые узлы).

### [PYTHON_NODE.md](./PYTHON_NODE.md)
Подробно о PythonNode:
- Как исполняется код
- Что такое `input_data` и `output`
- Как подключать новые библиотеки (requirements/Docker)

### Node specifics (current)
- TextInputNode: local input state prevents caret jump; right `output`
- SettingsNode: emits `config` (url, model, temperature)
- OllamaNode: `prompt`, `systemPrompt`, `config` inputs; incoming edges override local data; в исполнении приоритет у входящих
- PythonNode: `input` → `output`, выполняет код на backend, результат берётся из переменной `output` (или stdout)
- OutputNode: autosize на контент/expand, markdown wrap при ~1200px

## 🎯 Quick Links

### For New Developers
1. Read [NODES_AND_EDGES.md](./NODES_AND_EDGES.md) - Understand workflow concepts ⭐
2. Read [ARCHITECTURE.md](./ARCHITECTURE.md) - Understand the structure
3. Read [WORKFLOW_STORE.md](./WORKFLOW_STORE.md) - Learn state management
4. Check root [docs/FSD_STRUCTURE.md](../../docs/FSD_STRUCTURE.md) - FSD guidelines

### For Feature Development
1. Follow FSD structure in [ARCHITECTURE.md](./ARCHITECTURE.md)
2. Use store patterns from [WORKFLOW_STORE.md](./WORKFLOW_STORE.md)
3. Keep features isolated and self-contained

### For Debugging
1. Check [WORKFLOW_STORE.md](./WORKFLOW_STORE.md) - Troubleshooting section
2. Use Redux DevTools for store inspection
3. Check console for TypeScript errors

## 🏗️ Architecture Overview

```
frontend/src/
├── app/                    # Global setup
├── pages/                  # Routing
├── features/               # Business features ← Main development here
│   └── workflow/
│       ├── model/          # State & logic
│       └── ui/             # Components
├── widgets/                # Composite blocks (future)
├── entities/               # Business entities (future)
└── shared/                 # Utilities (future)
```

## 🔧 Key Technologies

- **React 19** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool
- **ReactFlow** - Node visualization
- **Zustand** - State management

## 📖 Additional Resources

### Project Root Documentation
- [../../docs/FSD_STRUCTURE.md](../../docs/FSD_STRUCTURE.md) - FSD guidelines
- [../../docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md) - Overall architecture
- [../../docs/MIGRATION_TO_FSD.md](../../docs/MIGRATION_TO_FSD.md) - Migration details
- [../../TODO.md](../../TODO.md) - Development roadmap
- [../../CHANGELOG.md](../../CHANGELOG.md) - Project changes

### External Resources
- [Feature-Sliced Design](https://feature-sliced.design/)
- [ReactFlow Documentation](https://reactflow.dev/)
- [Zustand Documentation](https://zustand-demo.pmnd.rs/)
- [React 19 Documentation](https://react.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

## 🤝 Contributing

When adding new features or components:

1. **Follow FSD structure** - Put code in appropriate layer
2. **Document store changes** - Update WORKFLOW_STORE.md if modifying state
3. **Update architecture docs** - Add new patterns to ARCHITECTURE.md
4. **Keep docs in sync** - Update this README if adding new docs

## 📝 Documentation Conventions

- Use **Markdown** for all documentation
- Include **code examples** for complex concepts
- Add **diagrams** where helpful (mermaid/ascii)
- Keep examples **up-to-date** with actual code
- Use **emojis** for visual navigation
- Link to **relevant resources**

---

**Last Updated**: October 30, 2025  
**Maintainers**: Development Team

