"""
Custom exceptions for workflow execution.
"""


class WorkflowExecutionError(Exception):
    """Base exception for workflow execution errors."""
    pass


class GraphValidationError(WorkflowExecutionError):
    """Raised when workflow graph has validation errors."""
    
    def __init__(self, errors: list, message: str = "Graph validation failed"):
        self.errors = errors
        super().__init__(f"{message}: {', '.join(errors)}")


class NodeExecutionError(WorkflowExecutionError):
    """Raised when a node execution fails."""
    
    def __init__(self, node_id: str, error: str):
        self.node_id = node_id
        self.error = error
        super().__init__(f"Node {node_id} execution failed: {error}")


class NodeTimeoutError(NodeExecutionError):
    """Raised when a node execution times out."""
    
    def __init__(self, node_id: str, timeout_seconds: float):
        self.timeout_seconds = timeout_seconds
        super().__init__(node_id, f"Execution timeout after {timeout_seconds}s")


class DependencyError(WorkflowExecutionError):
    """Raised when node dependencies cannot be resolved."""
    
    def __init__(self, node_id: str, missing_dependencies: list):
        self.node_id = node_id
        self.missing_dependencies = missing_dependencies
        super().__init__(
            f"Node {node_id} has unresolved dependencies: {', '.join(missing_dependencies)}"
        )

