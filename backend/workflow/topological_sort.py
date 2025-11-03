"""
Topological sorting for workflow nodes.

Determines execution order based on dependencies.
"""

from typing import Dict, List, Set, Optional
import logging
from workflow.graph_builder import DependencyGraph

logger = logging.getLogger(__name__)


def topological_sort(graph: DependencyGraph, nodes: List[Dict]) -> List[str]:
    """
    Perform topological sort to get execution order.
    
    Uses Kahn's algorithm:
    1. Build in-degree map
    2. Start with nodes that have no dependencies
    3. Process nodes, updating dependencies as we go
    
    Args:
        graph: DependencyGraph
        nodes: List of node dicts
        
    Returns:
        List of node IDs in execution order
    """
    from executors.registry import get_executable_types
    
    nodes_by_id = {n['id']: n for n in nodes}
    executable_types = get_executable_types()
    
    # Filter to only executable nodes
    executable_nodes = {
        n['id']: n for n in nodes 
        if n.get('type') in executable_types
    }
    
    if not executable_nodes:
        return []
    
    # Build in-degree map (count of dependencies)
    in_degree: Dict[str, int] = {}
    for node_id in executable_nodes:
        dependencies = graph.get_dependencies(node_id)
        # Count only executable dependencies
        executable_deps = [
            dep_id for dep_id in dependencies 
            if dep_id in executable_nodes
        ]
        in_degree[node_id] = len(executable_deps)
    
    # Start with nodes that have no dependencies
    queue: List[str] = [
        node_id for node_id, degree in in_degree.items() 
        if degree == 0
    ]
    queue.sort()  # Deterministic ordering
    
    execution_order: List[str] = []
    
    while queue:
        # Process node
        current_id = queue.pop(0)
        execution_order.append(current_id)
        
        # Update in-degree for dependent nodes
        dependents = graph.get_dependents(current_id)
        for dependent_id in dependents:
            if dependent_id not in executable_nodes:
                continue
            
            if dependent_id in in_degree:
                in_degree[dependent_id] -= 1
                if in_degree[dependent_id] == 0:
                    queue.append(dependent_id)
                    queue.sort()  # Keep sorted
    
    # Check for cycles (nodes not processed)
    unprocessed = set(executable_nodes.keys()) - set(execution_order)
    if unprocessed:
        logger.warning(f'Cycles detected or unprocessed nodes: {unprocessed}')
        # Add unprocessed nodes at the end (will be handled by iterative execution)
        execution_order.extend(sorted(unprocessed))
    
    logger.info(f'Topological sort: {len(execution_order)} nodes in execution order')
    
    return execution_order


def validate_graph(graph: DependencyGraph, nodes: List[Dict]) -> List[str]:
    """
    Validate dependency graph for issues.
    
    Args:
        graph: DependencyGraph
        nodes: List of node dicts
        
    Returns:
        List of error messages (empty if valid)
    """
    errors = []
    nodes_by_id = {n['id']: n for n in nodes}
    
    # Check for missing nodes in dependencies
    for node_id in graph.node_ids:
        if node_id not in nodes_by_id:
            errors.append(f'Node {node_id} referenced in graph but not found in nodes')
    
    # Check for self-dependencies
    for node_id in graph.node_ids:
        dependencies = graph.get_dependencies(node_id)
        if node_id in dependencies:
            errors.append(f'Node {node_id} depends on itself (self-referential cycle)')
    
    # Check for orphaned nodes (no connections at all)
    from executors.registry import get_executable_types
    executable_types = get_executable_types()
    
    for node in nodes:
        node_id = node.get('id')
        node_type = node.get('type', '')
        
        if not node_id:
            errors.append(f'Node missing ID: {node}')
            continue
        
        if node_type in executable_types:
            # Executable nodes should have at least input or output connections
            dependencies = graph.get_dependencies(node_id)
            dependents = graph.get_dependents(node_id)
            
            if not dependencies and not dependents:
                # Allow standalone nodes for now (might be valid entry points)
                pass
    
    # Check for broken dependencies (edges pointing to non-existent nodes)
    for node_id in graph.node_ids:
        dependencies = graph.get_dependencies(node_id)
        for dep_id in dependencies:
            if dep_id not in nodes_by_id:
                errors.append(f'Node {node_id} depends on non-existent node {dep_id}')
    
    return errors

