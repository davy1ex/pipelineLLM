"""
Base types and interfaces for node executors.
"""

from typing import Dict, Any, Protocol, Optional
from abc import ABC, abstractmethod


class ExecutorResult:
    """Result of node execution."""
    
    def __init__(
        self,
        output: str = '',
        error: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ):
        self.output = output
        self.error = error
        self.metadata = metadata or {}
    
    def is_success(self) -> bool:
        """Check if execution was successful."""
        return self.error is None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        result = {
            'output': self.output,
        }
        if self.error:
            result['error'] = self.error
        if self.metadata:
            result.update(self.metadata)
        return result


class NodeExecutor(Protocol):
    """
    Protocol for node executors.
    
    Each executor should:
    1. Take node dict and resolved inputs
    2. Execute node logic
    3. Return ExecutorResult
    """
    
    def __call__(self, node: Dict[str, Any], inputs: Dict[str, Any]) -> ExecutorResult:
        """
        Execute node.
        
        Args:
            node: Node dict with 'id', 'type', 'data' fields
            inputs: Resolved input values (mapped by handle name)
            
        Returns:
            ExecutorResult with output, error, metadata
        """
        ...

