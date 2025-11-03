"""
Build dependency graph from ReactFlow workflow format (nodes + edges).

This module parses nodes and edges to build a dependency graph
that can be used for topological sorting and execution.
"""

from typing import Dict, List, Set, Optional
import logging

logger = logging.getLogger(__name__)


class DependencyGraph:
    """Represents a dependency graph of workflow nodes."""
    
    def __init__(self):
        # Map: node_id -> list of node_ids that this node depends on
        self.dependencies: Dict[str, List[str]] = {}
        
        # Map: node_id -> list of node_ids that depend on this node
        self.dependents: Dict[str, List[str]] = {}
        
        # Map: (target_node_id, target_handle) -> (source_node_id, source_handle)
        # Used for input resolution
        self.input_connections: Dict[tuple, tuple] = {}
        
        # Set of all node IDs
        self.node_ids: Set[str] = set()
    
    def add_node(self, node_id: str):
        """Add a node to the graph."""
        self.node_ids.add(node_id)
        if node_id not in self.dependencies:
            self.dependencies[node_id] = []
        if node_id not in self.dependents:
            self.dependents[node_id] = []
    
    def add_dependency(self, source_id: str, target_id: str, 
                      source_handle: Optional[str] = None,
                      target_handle: Optional[str] = None):
        """
        Add a dependency: target_id depends on source_id.
        
        Args:
            source_id: Source node ID (output side)
            target_id: Target node ID (input side)
            source_handle: Handle name on source node (optional)
            target_handle: Handle name on target node (optional)
        """
        self.add_node(source_id)
        self.add_node(target_id)
        
        # Add to dependencies graph
        if target_id not in self.dependencies:
            self.dependencies[target_id] = []
        if source_id not in self.dependencies[target_id]:
            self.dependencies[target_id].append(source_id)
        
        # Add to dependents graph
        if source_id not in self.dependents:
            self.dependents[source_id] = []
        if target_id not in self.dependents[source_id]:
            self.dependents[source_id].append(target_id)
        
        # Store connection for input resolution
        connection_key = (target_id, target_handle)
        self.input_connections[connection_key] = (source_id, source_handle)
    
    def get_dependencies(self, node_id: str) -> List[str]:
        """Get list of node IDs that this node depends on."""
        return self.dependencies.get(node_id, [])
    
    def get_dependents(self, node_id: str) -> List[str]:
        """Get list of node IDs that depend on this node."""
        return self.dependents.get(node_id, [])
    
    def get_input_source(self, node_id: str, handle_name: Optional[str] = None) -> Optional[tuple]:
        """
        Get source node for an input handle.
        
        Args:
            node_id: Target node ID
            handle_name: Handle name (or None for default)
            
        Returns:
            Tuple (source_node_id, source_handle) or None if not connected
        """
        connection_key = (node_id, handle_name)
        return self.input_connections.get(connection_key)
    
    def get_all_input_sources(self, node_id: str) -> Dict[str, tuple]:
        """
        Get all input sources for a node.
        
        Returns:
            Dict mapping target_handle -> (source_node_id, source_handle)
        """
        result = {}
        for (target_id, target_handle), source_info in self.input_connections.items():
            if target_id == node_id:
                result[target_handle] = source_info
        return result


def build_dependency_graph(nodes: List[Dict], edges: List[Dict]) -> DependencyGraph:
    """
    Build dependency graph from ReactFlow format nodes and edges.
    
    Args:
        nodes: List of node dicts with 'id', 'type', 'data' fields
        edges: List of edge dicts with 'source', 'target', 'sourceHandle', 'targetHandle' fields
        
    Returns:
        DependencyGraph object
    """
    graph = DependencyGraph()
    
    # Add all nodes
    nodes_by_id = {}
    for node in nodes:
        node_id = node.get('id')
        if not node_id:
            logger.warning(f'Skipping node without ID: {node}')
            continue
        nodes_by_id[node_id] = node
        graph.add_node(node_id)
    
    # Process edges to build dependencies
    for edge in edges:
        source_id = edge.get('source')
        target_id = edge.get('target')
        
        if not source_id or not target_id:
            logger.warning(f'Skipping invalid edge: {edge}')
            continue
        
        if source_id not in nodes_by_id or target_id not in nodes_by_id:
            logger.warning(f'Edge references non-existent node: {edge}')
            continue
        
        source_handle = edge.get('sourceHandle')
        target_handle = edge.get('targetHandle')
        
        # Add dependency: target depends on source
        graph.add_dependency(
            source_id=source_id,
            target_id=target_id,
            source_handle=source_handle,
            target_handle=target_handle
        )
    
    logger.info(f'Built dependency graph: {len(graph.node_ids)} nodes, {len(edges)} edges')
    
    return graph


def get_entry_points(graph: DependencyGraph, nodes: List[Dict]) -> List[str]:
    """
    Get entry point nodes (nodes with no dependencies or only constant inputs).
    
    Entry points are:
    1. Nodes with no incoming edges
    2. Nodes that only depend on informational nodes (textInput, settings)
    
    Args:
        graph: DependencyGraph
        nodes: List of node dicts
        
    Returns:
        List of node IDs that are entry points
    """
    from executors.registry import get_executable_types
    
    nodes_by_id = {n['id']: n for n in nodes}
    executable_types = get_executable_types()
    informational_types = {'textInput', 'settings', 'output'}  # Don't block execution
    
    entry_points = []
    
    for node_id in graph.node_ids:
        node = nodes_by_id.get(node_id)
        if not node:
            continue
        
        node_type = node.get('type', '')
        
        # Only consider executable nodes
        if node_type not in executable_types:
            continue
        
        dependencies = graph.get_dependencies(node_id)
        
        # Entry point if no dependencies
        if not dependencies:
            entry_points.append(node_id)
            continue
        
        # Entry point if all dependencies are informational
        all_informational = True
        for dep_id in dependencies:
            dep_node = nodes_by_id.get(dep_id)
            if dep_node:
                dep_type = dep_node.get('type', '')
                if dep_type not in informational_types:
                    all_informational = False
                    break
        
        if all_informational:
            entry_points.append(node_id)
    
    return entry_points

