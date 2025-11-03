"""
Executor for Python code execution nodes.
"""

import logging
from typing import Dict, Any

from executors.base import ExecutorResult
from shared.python_service import execute_python_code

logger = logging.getLogger(__name__)


def execute_python(node: Dict[str, Any], inputs: Dict[str, Any]) -> ExecutorResult:
    """
    Execute a Python node.
    
    Node data fields:
        - code: str (required) - Python code to execute
    
    Inputs:
        - input: str (optional) - input data from connected node
            Injected as 'data_input' and 'input_data' variables
    
    Returns:
        ExecutorResult with:
            - output: value of 'output' variable or stdout
            - error: execution error if any
            - metadata: {'stdout': str, 'stderr': str}
    """
    node_data = node.get('data', {})
    code = node_data.get('code', '')
    
    if not code or not code.strip():
        return ExecutorResult(
            output='',
            error='Python node has no code',
            metadata={'stdout': '', 'stderr': ''}
        )
    
    # Get input data (default to empty string)
    input_data = inputs.get('input', '')
    if not isinstance(input_data, str):
        input_data = str(input_data)
    
    # Escape triple quotes in input
    escaped_input = input_data.replace('"""', '\\"""')
    
    # Inject input data into code
    code_to_execute = f'data_input = """{escaped_input}"""\ninput_data = data_input\n{code}'
    
    # Use shared service for execution
    result = execute_python_code(code_to_execute)
    
    return ExecutorResult(
        output=result['output'],
        error=result.get('error'),
        metadata={
            'stdout': result.get('stdout', ''),
            'stderr': result.get('stderr', '')
        }
    )

