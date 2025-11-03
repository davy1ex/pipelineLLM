"""
Compute topological execution order for workflow nodes (ComfyUI-style format).

This module provides a pure function that takes a workflow JSON and computes
the execution order for all executable nodes based on their dependencies.
"""

from typing import Dict, List, Optional, Set, Tuple


# Executable node types (nodes that perform work)
EXECUTABLE_TYPES = {'python', 'ollama', 'fileWriter'}

# Informational node types (nodes that only provide/consume data, don't create execution dependencies)
INFORMATIONAL_TYPES = {'textInput', 'output', 'settings'}


def is_executable_node(node: Dict) -> bool:
    """Check if a node is executable (performs work)."""
    node_type = node.get('type', '')
    return node_type in EXECUTABLE_TYPES


def get_executable_dependencies(node: Dict, workflow: Dict) -> List[int]:
    """
    Get all executable node IDs that this node depends on.
    
    Only considers dependencies from executable nodes.
    Informational nodes (textInput, settings) don't create execution dependencies.
    
    Args:
        node: The target node dict
        workflow: The complete workflow dict with nodes and links
        
    Returns:
        List of executable node IDs that must execute before this node
    """
    dependencies = []
    node_id = node['id']
    
    # Find all incoming links to this node
    links = workflow.get('links', [])
    nodes_by_id = {n['id']: n for n in workflow.get('nodes', [])}
    
    for link in links:
        # Link format: [link_id, from_node_id, from_slot, to_node_id, to_slot, data_type]
        if len(link) < 5:
            continue
        
        to_node_id = link[3]
        if to_node_id != node_id:
            continue
        
        # Found an incoming link - check if source is executable
        from_node_id = link[1]
        source_node = nodes_by_id.get(from_node_id)
        
        if source_node and is_executable_node(source_node):
            if from_node_id not in dependencies:
                dependencies.append(from_node_id)
    
    return dependencies


def compute_execution_order(workflow: Dict) -> Dict[int, int]:
    """
    Compute topological execution order for all executable nodes.
    
    Uses Kahn's algorithm for topological sorting:
    1. Build dependency graph
    2. Find nodes with no dependencies (can execute first)
    3. Process nodes, updating dependencies as we go
    
    Args:
        workflow: Workflow dict with 'nodes' and 'links' keys
        
    Returns:
        Dict mapping node_id -> execution order (0-based, 0 = execute first)
    """
    nodes = workflow.get('nodes', [])
    executable_nodes = [n for n in nodes if is_executable_node(n)]
    
    if not executable_nodes:
        return {}
    
    # Build dependency graph: node_id -> list of dependent node_ids
    graph: Dict[int, List[int]] = {}
    in_degree: Dict[int, int] = {}  # Count of incoming dependencies
    
    # Initialize
    for node in executable_nodes:
        node_id = node['id']
        graph[node_id] = []
        in_degree[node_id] = 0
    
    # Build dependencies
    for node in executable_nodes:
        node_id = node['id']
        dependencies = get_executable_dependencies(node, workflow)
        
        for dep_id in dependencies:
            # dep_id must execute before node_id
            if dep_id not in graph:
                continue  # Skip if dependency is not executable
            
            graph[dep_id].append(node_id)
            in_degree[node_id] = in_degree.get(node_id, 0) + 1
    
    # Kahn's algorithm: start with nodes that have no dependencies
    queue: List[int] = [
        node_id for node_id, degree in in_degree.items() if degree == 0
    ]
    queue.sort()  # For deterministic ordering
    
    order_map: Dict[int, int] = {}
    current_order = 0
    
    while queue:
        # Process nodes in queue (sorted for determinism)
        current_id = queue.pop(0)
        order_map[current_id] = current_order
        current_order += 1
        
        # Decrease in-degree for dependent nodes
        for dependent_id in graph.get(current_id, []):
            in_degree[dependent_id] -= 1
            if in_degree[dependent_id] == 0:
                queue.append(dependent_id)
                queue.sort()  # Keep sorted
    
    # If there are cycles or unprocessed nodes, add them at the end
    for node in executable_nodes:
        node_id = node['id']
        if node_id not in order_map:
            order_map[node_id] = current_order
            current_order += 1
    
    return order_map


def update_workflow_order(workflow: Dict) -> Dict:
    """
    Update workflow nodes with computed execution order.
    
    Args:
        workflow: Workflow dict (will be modified in place)
        
    Returns:
        Updated workflow dict with 'order' field set for each node
    """
    order_map = compute_execution_order(workflow)
    
    # Update order in nodes
    for node in workflow.get('nodes', []):
        node_id = node['id']
        if is_executable_node(node):
            node['order'] = order_map.get(node_id, -1)
        else:
            # Informational nodes get order -1 (don't execute)
            node['order'] = -1
    
    return workflow


def get_execution_sequence(workflow: Dict) -> List[Dict]:
    """
    Get executable nodes sorted by execution order.
    
    Args:
        workflow: Workflow dict with nodes having 'order' field
        
    Returns:
        List of executable nodes sorted by execution order (lowest order first)
    """
    nodes = workflow.get('nodes', [])
    executable = [n for n in nodes if is_executable_node(n)]
    
    # Sort by order (nodes with order -1 will be last)
    executable.sort(key=lambda n: (n.get('order', -1), n['id']))
    
    return executable

