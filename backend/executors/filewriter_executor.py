"""
Executor for FileWriter nodes.
"""

import os
import uuid
import logging
from typing import Dict, Any

from executors.base import ExecutorResult

logger = logging.getLogger(__name__)


def execute_filewriter(node: Dict[str, Any], inputs: Dict[str, Any]) -> ExecutorResult:
    """
    Execute a FileWriter node.
    
    Node data fields:
        - filename: str (default: 'result.txt')
    
    Inputs:
        - text: str - content to write (from connected node)
    
    Returns:
        ExecutorResult with:
            - output: fileId (UUID)
            - metadata: {'fileId': str, 'filename': str, 'size': int}
    """
    node_data = node.get('data', {})
    filename = node_data.get('filename', 'result.txt')
    
    # Get input content
    content = inputs.get('text', inputs.get('input', ''))  # Support both 'text' and 'input'
    if not isinstance(content, str):
        content = str(content)
    
    if not content:
        return ExecutorResult(
            output='',
            error='No content to write',
            metadata={'fileId': None, 'filename': filename, 'size': 0}
        )
    
    try:
        # Create file
        base_dir = os.path.join('/tmp', 'pipeline_files')
        os.makedirs(base_dir, exist_ok=True)
        
        file_id = str(uuid.uuid4())
        safe_name = filename.replace('/', '_').replace('..', '_')
        file_path = os.path.join(base_dir, f"{file_id}__{safe_name}")
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        
        size = os.path.getsize(file_path)
        
        logger.info(f'File created: {file_id} ({safe_name}, {size} bytes)')
        
        return ExecutorResult(
            output=file_id,
            error=None,
            metadata={
                'fileId': file_id,
                'filename': safe_name,
                'size': size
            }
        )
        
    except Exception as e:
        logger.error(f'Failed to create file: {str(e)}', exc_info=True)
        return ExecutorResult(
            output='',
            error=f'Failed to create file: {str(e)}',
            metadata={'fileId': None, 'filename': filename, 'size': 0}
        )

