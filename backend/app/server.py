"""
Flask server for workflow execution API.

Supports running via:
    - python -m app (recommended)
    - python app/server.py (adds parent directory to path)
    - python app/__main__.py (via __main__.py)
"""

import sys
import os
from pathlib import Path

# Add backend directory to Python path for direct script execution
# This allows running: python app/server.py
_backend_dir = Path(__file__).parent.parent.resolve()
if str(_backend_dir) not in sys.path:
    sys.path.insert(0, str(_backend_dir))

from flask import Flask, jsonify, request
from flask import send_file
from flask_cors import CORS
import logging
from typing import Optional, Dict, Any, List
import uuid
from workflow.queue import enqueue_workflow, get_execution_status
from shared.python_service import execute_python_code
from shared.ollama_service import call_ollama_api

app = Flask(__name__)

# Configuration from environment variables
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-secret-key-change-this')
app.config['DEBUG'] = os.getenv('FLASK_DEBUG', '0') == '1'

CORS(app)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@app.before_request
def log_request_info():
    logger.info('Request: %s %s', request.method, request.path)
    logger.info('Headers: %s', dict(request.headers))
    if request.data:
        logger.info('Body: %s', request.get_data())


@app.route('/api/ollama/chat', methods=['POST'])
def ollama_chat():
    """
    Proxy endpoint to call Ollama API
    Request body: {
        "url": "http://localhost:11434",
        "model": "llama3.2",
        "prompt": "Hello, how are you?",
        "temperature": 0.7
    }
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Request body is required'}), 400

        ollama_url = data.get('url', 'http://localhost:11434')
        model = data.get('model', 'llama3.2')
        prompt = data.get('prompt', '')
        system = data.get('system')  # Optional system prompt
        temperature = data.get('temperature', 0.7)

        if not prompt:
            return jsonify({'error': 'Prompt is required'}), 400

        # Use shared service for Ollama API call (handles URL normalization internally)
        result = call_ollama_api(
            url=ollama_url,
            model=model,
            prompt=prompt,
            system=system,
            temperature=temperature,
            timeout=300
        )
        
        if result.get('error'):
            # Map errors to appropriate HTTP status codes
            error = result['error']
            if 'timeout' in error.lower():
                return jsonify({'error': error}), 504
            elif 'cannot connect' in error.lower():
                return jsonify({'error': error}), 503
            elif 'status' in result:
                return jsonify({
                    'error': error,
                    'status': result.get('status'),
                    'response': result.get('response', '')
                }), 500
            else:
                return jsonify({'error': error}), 500
        
        return jsonify({
            'response': result.get('response', ''),
            'model': result.get('model', model),
            'done': result.get('done', True)
        }), 200

    except Exception as e:
        logger.error(f'Unexpected error: {str(e)}', exc_info=True)
        return jsonify({
            'error': f'Internal server error: {str(e)}'
        }), 500

@app.route('/api/files/create', methods=['POST'])
def create_file():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Request body is required'}), 400

        content = data.get('content', '')
        filename = data.get('filename', 'result.txt')

        base_dir = os.path.join('/tmp', 'pipeline_files')
        os.makedirs(base_dir, exist_ok=True)
        file_id = str(uuid.uuid4())
        safe_name = filename.replace('/', '_').replace('..', '_')
        file_path = os.path.join(base_dir, f"{file_id}__{safe_name}")

        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)

        size = os.path.getsize(file_path)
        return jsonify({ 'fileId': file_id, 'filename': safe_name, 'size': size }), 200
    except Exception as e:
        logger.error(f'Failed to create file: {str(e)}', exc_info=True)
        return jsonify({ 'error': f'Internal server error: {str(e)}' }), 500

@app.route('/api/files/download/<file_id>', methods=['GET'])
def download_file(file_id: str):
    try:
        base_dir = os.path.join('/tmp', 'pipeline_files')
        # find file by id prefix
        for name in os.listdir(base_dir):
            if name.startswith(file_id + "__"):
                file_path = os.path.join(base_dir, name)
                return send_file(file_path, as_attachment=True, download_name=name.split('__',1)[1])
        return jsonify({ 'error': 'File not found' }), 404
    except Exception as e:
        logger.error(f'Failed to download file: {str(e)}', exc_info=True)
        return jsonify({ 'error': f'Internal server error: {str(e)}' }), 500

@app.route('/api/python/execute', methods=['POST'])
def python_execute():
    """
    Execute Python code and return the result
    Request body: {
        "code": "output = 'Hello'\nprint('World')"
    }
    Returns: {
        "output": "Hello",  # Value of 'output' variable, if present
        "stdout": "World\n",  # Captured stdout
        "stderr": "",  # Captured stderr
        "error": null  # Execution error if any
    }
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Request body is required'}), 400

        code = data.get('code', '')
        if not code:
            return jsonify({'error': 'Code is required'}), 400

        logger.info(f'Executing Python code (length: {len(code)})')

        # Use shared service for Python execution
        result = execute_python_code(code)

        return jsonify(result), 200

    except Exception as e:
        logger.error(f'Unexpected error in python_execute: {str(e)}', exc_info=True)
        return jsonify({
            'error': f'Internal server error: {str(e)}',
            'output': '',
            'stdout': '',
            'stderr': '',
        }), 500


@app.route('/api/workflow/execute', methods=['POST'])
def workflow_execute():
    """
    Execute a complete workflow (asynchronously via queue).
    
    Request body: {
        "version": 1,
        "nodes": [...],  # ReactFlow nodes
        "edges": [...]   # ReactFlow edges
    }
    
    Returns: {
        "queueId": "uuid",  # Queue ID for polling status
        "status": "pending" # Initial status
    }
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Request body is required'}), 400
        
        nodes = data.get('nodes', [])
        edges = data.get('edges', [])
        
        if not isinstance(nodes, list) or not isinstance(edges, list):
            return jsonify({'error': 'nodes and edges must be arrays'}), 400
        
        if not nodes:
            return jsonify({'error': 'Workflow must contain at least one node'}), 400
        
        logger.info(f'Enqueueing workflow: {len(nodes)} nodes, {len(edges)} edges')
        
        # Enqueue workflow for asynchronous execution
        queue_id = enqueue_workflow(nodes, edges)
        
        logger.info(f'Workflow enqueued: {queue_id}')
        
        return jsonify({
            'queueId': queue_id,
            'status': 'pending'
        }), 202  # 202 Accepted (async operation)
        
    except Exception as e:
        logger.error(f'Error enqueueing workflow: {str(e)}', exc_info=True)
        return jsonify({
            'error': f'Internal server error: {str(e)}'
        }), 500


@app.route('/api/workflow/<queue_id>/status', methods=['GET'])
def workflow_status(queue_id: str):
    """
    Get workflow execution status.
    
    Path params:
        queue_id: Queue identifier from /api/workflow/execute
    
    Returns: {
        "queueId": "uuid",
        "status": "pending" | "running" | "completed" | "failed",
        "runningNodeIds": ["node-1", ...],
        "completedNodeIds": ["node-2", ...],
        "results": {
            "node-id": {
                "output": "...",
                "error": null
            }
        },
        "executionLog": ["Executing node...", ...],
        "iterations": 2,
        "error": null
    }
    """
    try:
        execution = get_execution_status(queue_id)
        
        if not execution:
            return jsonify({'error': f'Workflow execution {queue_id} not found'}), 404
        
        return jsonify(execution.to_dict()), 200
        
    except Exception as e:
        logger.error(f'Error getting workflow status: {str(e)}', exc_info=True)
        return jsonify({
            'error': f'Internal server error: {str(e)}'
        }), 500


if __name__ == '__main__':
    # Use FLASK_PORT env var or default to 5000 (for Docker) or 5001 (for local macOS)
    default_port = 5000 if os.environ.get('DOCKER_CONTAINER') else 5001
    port = int(os.environ.get('FLASK_PORT', default_port))
    app.run(host='0.0.0.0', port=port, debug=True)


