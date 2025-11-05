"""
Registry for node executors.
"""

from typing import Dict, Callable, Optional
from executors.base import ExecutorResult
from executors.ollama_executor import execute_ollama
from executors.python_executor import execute_python
from executors.text_input_executor import execute_text_input
from executors.settings_executor import execute_settings
from executors.filewriter_executor import execute_filewriter
from executors.docling_executor import execute_docling

# Registry mapping node type -> executor function
_EXECUTOR_REGISTRY: Dict[str, Callable] = {
    'ollama': execute_ollama,
    'python': execute_python,
    'textInput': execute_text_input,
    'settings': execute_settings,
    'fileWriter': execute_filewriter,
    'docling': execute_docling,
}


def get_executor(node_type: str) -> Optional[Callable]:
    """
    Get executor for a node type.
    
    Args:
        node_type: Node type string (e.g., 'ollama', 'python')
        
    Returns:
        Executor function or None if not found
    """
    return _EXECUTOR_REGISTRY.get(node_type)


def register_executor(node_type: str, executor: Callable) -> None:
    """
    Register a custom executor for a node type.
    
    Args:
        node_type: Node type string
        executor: Executor function (node, inputs) -> ExecutorResult
    """
    _EXECUTOR_REGISTRY[node_type] = executor


def get_executable_types() -> list:
    """Get list of executable node types."""
    return list(_EXECUTOR_REGISTRY.keys())

