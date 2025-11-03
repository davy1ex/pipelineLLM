"""
Executor for TextInput nodes (entry points).
"""

import logging
from typing import Dict, Any

from executors.base import ExecutorResult

logger = logging.getLogger(__name__)


def execute_text_input(node: Dict[str, Any], inputs: Dict[str, Any]) -> ExecutorResult:
    """
    Execute a TextInput node.
    
    TextInput nodes are entry points - they just return their value.
    No inputs required (they are constants).
    
    Node data fields:
        - value: str - text value to output
    
    Returns:
        ExecutorResult with:
            - output: text value from node.data.value
    """
    node_data = node.get('data', {})
    value = node_data.get('value', '')
    
    if not isinstance(value, str):
        value = str(value)
    
    return ExecutorResult(
        output=value,
        error=None,
        metadata={}
    )

