"""
Executor for Settings nodes (configuration providers).
"""

import logging
from typing import Dict, Any

from executors.base import ExecutorResult

logger = logging.getLogger(__name__)


def execute_settings(node: Dict[str, Any], inputs: Dict[str, Any]) -> ExecutorResult:
    """
    Execute a Settings node.
    
    Settings nodes provide configuration (url, model, temperature).
    They output a config object via 'config' handle.
    
    Node data fields:
        - url: str (default: 'http://localhost:11434')
        - model: str (default: 'llama3.2')
        - temperature: float (default: 0.7)
    
    Returns:
        ExecutorResult with:
            - output: JSON string of config object (for compatibility)
            - metadata: {'config': dict} - actual config object
    """
    import json
    
    node_data = node.get('data', {})
    
    config = {
        'url': node_data.get('url') or 'http://localhost:11434',
        'model': node_data.get('model') or 'llama3.2',
        'temperature': node_data.get('temperature', 0.7),
    }
    
    # Convert to JSON string for output (for compatibility)
    config_json = json.dumps(config)
    
    return ExecutorResult(
        output=config_json,
        error=None,
        metadata={'config': config}
    )

