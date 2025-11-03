"""
Pure functions for executing different types of workflow nodes.

Each function takes a node and input data, executes the node's logic,
and returns the result.
"""

import requests
import io
import sys
import os
import uuid
from typing import Dict, Any, Optional
from contextlib import redirect_stdout, redirect_stderr
from urllib.parse import urlparse, urlunparse


def execute_ollama_node(node: Dict, inputs: Dict[str, Any]) -> Dict[str, Any]:
    """
    Execute an Ollama node.
    
    Args:
        node: Node dict with 'type', 'widgets_values', 'properties'
        inputs: Dict mapping input names to their values (from previous nodes)
                Example: {'prompt': 'Hello', 'systemPrompt': 'You are helpful'}
        
    Returns:
        Dict with:
            - 'output': string result from Ollama
            - 'error': optional error message
            - 'model': model used
    """
    widgets_values = node.get('widgets_values', [])
    
    # Extract parameters from widgets_values
    # Format: [model, temperature, prompt, systemPrompt, url]
    model = widgets_values[0] if len(widgets_values) > 0 else 'llama3.2'
    temperature = float(widgets_values[1]) if len(widgets_values) > 1 else 0.7
    default_prompt = widgets_values[2] if len(widgets_values) > 2 else ''
    default_system = widgets_values[3] if len(widgets_values) > 3 else ''
    url = widgets_values[4] if len(widgets_values) > 4 else 'http://localhost:11434'
    
    # Override with inputs if provided (inputs take priority)
    prompt = inputs.get('prompt', default_prompt)
    system_prompt = inputs.get('systemPrompt', default_system)
    
    # Check for config input that can override url/model/temperature
    config = inputs.get('config', {})
    if isinstance(config, dict):
        url = config.get('url', url)
        model = config.get('model', model)
        temperature = config.get('temperature', temperature)
    
    if not prompt:
        return {
            'output': '',
            'error': 'Prompt is required for Ollama node',
            'model': model
        }
    
    # Normalize URL
    try:
        parsed = urlparse(url if '://' in url else f'http://{url}')
        clean_path = parsed.path.rstrip('/')
        if clean_path.startswith('/api/') or clean_path in ('/api', '/api/generate', '/api/chat'):
            parsed = parsed._replace(path='', params='', query='', fragment='')
        url = urlunparse(parsed)
    except Exception:
        pass
    
    # Convert localhost for Docker
    if 'localhost' in url or '127.0.0.1' in url:
        url = url.replace('localhost', 'host.docker.internal').replace('127.0.0.1', 'host.docker.internal')
    elif 'docker.host.internal' in url:
        url = url.replace('docker.host.internal', 'host.docker.internal')
    
    # Prepare Ollama API request
    ollama_endpoint = f"{url.rstrip('/')}/api/generate"
    payload = {
        'model': model,
        'prompt': prompt,
        'stream': False,
        'options': {
            'temperature': temperature
        }
    }
    
    if system_prompt:
        payload['system'] = system_prompt
    
    try:
        # Call Ollama API
        response = requests.post(
            ollama_endpoint,
            json=payload,
            timeout=300
        )
        response.raise_for_status()
        
        result = response.json()
        response_text = result.get('response', '')
        
        if not response_text:
            response_text = 'No response from Ollama'
        
        return {
            'output': response_text,
            'model': model,
            'error': None
        }
        
    except requests.exceptions.Timeout as e:
        return {
            'output': '',
            'error': f'Ollama API timeout: {str(e)}',
            'model': model
        }
    except requests.exceptions.ConnectionError as e:
        return {
            'output': '',
            'error': f'Cannot connect to Ollama at {url}. Make sure Ollama is running.',
            'model': model
        }
    except requests.exceptions.RequestException as e:
        return {
            'output': '',
            'error': f'Failed to call Ollama API: {str(e)}',
            'model': model
        }
    except Exception as e:
        return {
            'output': '',
            'error': f'Unexpected error: {str(e)}',
            'model': model
        }


def execute_python_node(node: Dict, inputs: Dict[str, Any]) -> Dict[str, Any]:
    """
    Execute a Python node.
    
    Args:
        node: Node dict with 'type', 'widgets_values'
        inputs: Dict mapping input names to their values
                Example: {'input': 'Hello world'}
        
    Returns:
        Dict with:
            - 'output': string result (value of 'output' variable)
            - 'stdout': captured stdout
            - 'stderr': captured stderr
            - 'error': optional execution error
    """
    widgets_values = node.get('widgets_values', [])
    
    # Extract code from widgets_values
    # Format: [code, output]
    code = widgets_values[0] if len(widgets_values) > 0 else ''
    
    if not code:
        return {
            'output': '',
            'stdout': '',
            'stderr': '',
            'error': 'Python node has no code'
        }
    
    # Get input data (default to empty string)
    input_data = inputs.get('input', '')
    if not isinstance(input_data, str):
        input_data = str(input_data)
    
    # Escape triple quotes in input
    escaped_input = input_data.replace('"""', '\\"""')
    
    # Inject input data into code
    code_to_execute = f'data_input = """{escaped_input}"""\ninput_data = data_input\n{code}'
    
    # Capture stdout, stderr
    stdout_capture = io.StringIO()
    stderr_capture = io.StringIO()
    output_var = None
    error = None
    
    try:
        namespace = {}
        with redirect_stdout(stdout_capture), redirect_stderr(stderr_capture):
            exec(code_to_execute, namespace)
        
        # Extract 'output' variable if it exists
        if 'output' in namespace:
            output_var = str(namespace['output'])
        
        stdout_value = stdout_capture.getvalue()
        stderr_value = stderr_capture.getvalue()
        
    except Exception as e:
        error = str(e)
        stderr_value = stderr_capture.getvalue() + (f'\nExecution error: {error}' if error else '')
    
    return {
        'output': output_var or '',
        'stdout': stdout_capture.getvalue(),
        'stderr': stderr_value,
        'error': error
    }


def execute_filewriter_node(node: Dict, inputs: Dict[str, Any]) -> Dict[str, Any]:
    """
    Execute a FileWriter node.
    
    Args:
        node: Node dict with 'type', 'widgets_values'
        inputs: Dict mapping input names to their values
                Example: {'input': 'Hello world\nSecond line'}
        
    Returns:
        Dict with:
            - 'fileId': UUID of created file
            - 'filename': filename used
            - 'size': file size in bytes
            - 'error': optional error message
    """
    widgets_values = node.get('widgets_values', [])
    
    # Extract filename from widgets_values
    # Format: [filename, fileId]
    filename = widgets_values[0] if len(widgets_values) > 0 else 'result.txt'
    
    # Get input data
    content = inputs.get('input', '')
    if not isinstance(content, str):
        content = str(content)
    
    if not content:
        return {
            'fileId': None,
            'filename': filename,
            'size': 0,
            'error': 'No content to write'
        }
    
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
        
        return {
            'fileId': file_id,
            'filename': safe_name,
            'size': size,
            'error': None
        }
        
    except Exception as e:
        return {
            'fileId': None,
            'filename': filename,
            'size': 0,
            'error': f'Failed to create file: {str(e)}'
        }


def execute_node(node: Dict, inputs: Dict[str, Any]) -> Dict[str, Any]:
    """
    Execute a node based on its type.
    
    Args:
        node: Node dict
        inputs: Dict mapping input names to their values
        
    Returns:
        Execution result dict (format depends on node type)
    """
    node_type = node.get('type', '')
    
    if node_type == 'ollama':
        return execute_ollama_node(node, inputs)
    elif node_type == 'python':
        return execute_python_node(node, inputs)
    elif node_type == 'fileWriter':
        return execute_filewriter_node(node, inputs)
    else:
        return {
            'error': f'Unknown node type: {node_type}'
        }

