"""
Node executors package.

Each executor handles execution of a specific node type.
Executors are pure functions that take node data and inputs, return results.
"""

from executors.base import ExecutorResult, NodeExecutor
from executors.ollama_executor import execute_ollama
from executors.python_executor import execute_python
from executors.text_input_executor import execute_text_input
from executors.settings_executor import execute_settings
from executors.filewriter_executor import execute_filewriter
from executors.registry import get_executor

__all__ = [
    'ExecutorResult',
    'NodeExecutor',
    'execute_ollama',
    'execute_python',
    'execute_text_input',
    'execute_settings',
    'execute_filewriter',
    'get_executor',
]

