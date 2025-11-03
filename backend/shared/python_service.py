"""
Python code execution service.

Pure function for executing Python code - used by both executors and API endpoints.
"""

import io
import sys
import logging
from typing import Dict, Any
from contextlib import redirect_stdout, redirect_stderr

logger = logging.getLogger(__name__)


def execute_python_code(code: str) -> Dict[str, Any]:
    """
    Execute Python code and return result.
    
    Args:
        code: Python code to execute
        
    Returns:
        Dict with:
            - output: value of 'output' variable or stdout
            - stdout: captured stdout
            - stderr: captured stderr
            - error: execution error if any
    """
    stdout_capture = io.StringIO()
    stderr_capture = io.StringIO()
    output_var = None
    error = None
    
    try:
        namespace = {}
        with redirect_stdout(stdout_capture), redirect_stderr(stderr_capture):
            exec(code, namespace)
        
        # Extract 'output' variable if it exists
        if 'output' in namespace:
            output_var = str(namespace['output'])
        
        stdout_value = stdout_capture.getvalue()
        stderr_value = stderr_capture.getvalue()
        
        logger.info(
            f'Python execution completed. '
            f'output={output_var is not None}, '
            f'stdout_length={len(stdout_value)}, '
            f'error={error is not None}'
        )
        
        # Use output variable if available, otherwise stdout
        final_output = output_var or stdout_value
        
        return {
            'output': final_output,
            'stdout': stdout_value,
            'stderr': stderr_value,
            'error': error
        }
        
    except Exception as e:
        error = str(e)
        stderr_value = stderr_capture.getvalue() + (f'\nExecution error: {error}' if error else '')
        logger.error(f'Python execution error: {error}')
        
        return {
            'output': '',
            'stdout': stdout_capture.getvalue(),
            'stderr': stderr_value,
            'error': error
        }

