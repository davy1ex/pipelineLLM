# Legacy Files

This folder contains deprecated files that have been replaced by the new modular architecture.

## Files

- **`workflow_order.py`** - Old topological sorting logic for ComfyUI format
  - Replaced by: `workflow/topological_sort.py` (for ReactFlow format)

- **`node_executors.py`** - Old executor format with `widgets_values`
  - Replaced by: `executors/` (modular architecture with ReactFlow format)

## Replacement Reason

Old files worked with ComfyUI format (`widgets_values`, `links`), new architecture works with ReactFlow format (`node.data`, `edges`).

These files can be deleted after full migration to the new architecture.

