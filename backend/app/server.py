"""
Flask server for workflow execution API.

Supports running via:
    - python -m app (recommended)
    - python app/server.py (adds parent directory to path)
    - python app/__main__.py (via __main__.py)
"""

import sys
import os
import json
from pathlib import Path
from datetime import datetime
from werkzeug.utils import secure_filename

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
app.config['MAX_CONTENT_LENGTH'] = int(os.getenv('MAX_UPLOAD_MB', '50')) * 1024 * 1024

CORS(app)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@app.before_request
def log_request_info():
    # Skip verbose logging for status polling endpoints to reduce log spam
    if request.path.startswith('/api/workflow/') and request.path.endswith('/status'):
        # Only log status requests at DEBUG level
        logger.debug('Request: %s %s', request.method, request.path)
    else:
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

@app.route('/api/files/upload', methods=['POST'])
def upload_file():
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file part in the request'}), 400

        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No selected file'}), 400

        base_dir = os.path.join('/tmp', 'pipeline_files')
        os.makedirs(base_dir, exist_ok=True)
        file_id = str(uuid.uuid4())
        safe_name = file.filename.replace('/', '_').replace('..', '_')
        file_path = os.path.join(base_dir, f"{file_id}__{safe_name}")

        file.save(file_path)

        size = os.path.getsize(file_path)
        mimetype = file.mimetype or 'application/octet-stream'
        return jsonify({ 'fileId': file_id, 'filename': safe_name, 'size': size, 'mimetype': mimetype }), 200
    except Exception as e:
        logger.error(f'Failed to upload file: {str(e)}', exc_info=True)
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


# Workflow file management
# Resolve workflows dir robustly for both local and Docker runs.
# Priority:
# 1) WORKFLOWS_DIR env var
# 2) <project_root>/workflows if project root is detectable
# 3) <backend_dir>/workflows (works inside Docker at /app/workflows)
_env_workflows = os.getenv('WORKFLOWS_DIR')
if _env_workflows:
    WORKFLOWS_DIR = Path(_env_workflows).resolve()
else:
    # Try to detect project root (parent of backend dir) and prefer its 'workflows'
    candidate_project_root = _backend_dir.parent
    project_workflows = (candidate_project_root / 'workflows')
    backend_workflows = (_backend_dir / 'workflows')
    # Heuristic: if backend is at '<project>/backend', prefer '<project>/workflows'
    if (candidate_project_root / 'backend').exists():
        WORKFLOWS_DIR = project_workflows.resolve()
    else:
        WORKFLOWS_DIR = backend_workflows.resolve()

WORKFLOWS_DIR.mkdir(parents=True, exist_ok=True)
logger.info(f'Workflows directory: {WORKFLOWS_DIR}')


def _get_workflow_path(name: str) -> Path:
    """Get safe file path for workflow name."""
    safe_name = secure_filename(name)
    if not safe_name.endswith('.json'):
        safe_name += '.json'
    return WORKFLOWS_DIR / safe_name


def _list_workflows() -> List[Dict[str, Any]]:
    """List all available workflow files."""
    workflows = []
    for file_path in WORKFLOWS_DIR.glob('*.json'):
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            # Extract metadata
            name = file_path.stem  # filename without .json
            stat = file_path.stat()
            
            workflows.append({
                'name': name,
                'filename': file_path.name,
                'created': datetime.fromtimestamp(stat.st_ctime).isoformat(),
                'modified': datetime.fromtimestamp(stat.st_mtime).isoformat(),
                'size': stat.st_size,
                'description': data.get('description', ''),  # For future use
            })
        except Exception as e:
            logger.warning(f'Failed to read workflow file {file_path}: {e}')
            continue
    
    # Sort by modified date (newest first)
    workflows.sort(key=lambda x: x['modified'], reverse=True)
    return workflows


@app.route('/api/workflows', methods=['GET'])
def workflows_list():
    """
    List all available workflow files.
    
    Returns: {
        "workflows": [
            {
                "name": "my-workflow",
                "filename": "my-workflow.json",
                "created": "2025-11-05T...",
                "modified": "2025-11-05T...",
                "size": 1234,
                "description": ""
            },
            ...
        ]
    }
    """
    try:
        workflows = _list_workflows()
        return jsonify({
            'workflows': workflows
        }), 200
    except Exception as e:
        logger.error(f'Error listing workflows: {str(e)}', exc_info=True)
        return jsonify({
            'error': f'Internal server error: {str(e)}'
        }), 500


@app.route('/api/workflows/<name>', methods=['GET'])
def workflow_load(name: str):
    """
    Load a workflow by name.
    
    Path params:
        name: Workflow name (without .json extension)
    
    Returns: {
        "name": "my-workflow",
        "nodes": [...],
        "edges": [...],
        "description": "",
        "version": 1
    }
    """
    try:
        file_path = _get_workflow_path(name)
        
        if not file_path.exists():
            return jsonify({'error': f'Workflow "{name}" not found'}), 404
        
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # Ensure required fields
        if 'nodes' not in data:
            data['nodes'] = []
        if 'edges' not in data:
            data['edges'] = []
        
        return jsonify({
            'name': name,
            'nodes': data.get('nodes', []),
            'edges': data.get('edges', []),
            'description': data.get('description', ''),
            'version': data.get('version', 1)
        }), 200
        
    except json.JSONDecodeError as e:
        logger.error(f'Invalid JSON in workflow file: {str(e)}')
        return jsonify({
            'error': f'Invalid workflow file format: {str(e)}'
        }), 400
    except Exception as e:
        logger.error(f'Error loading workflow: {str(e)}', exc_info=True)
        return jsonify({
            'error': f'Internal server error: {str(e)}'
        }), 500


@app.route('/api/workflows/save', methods=['POST'])
def workflow_save():
    """
    Save a workflow to a file.
    
    Request body: {
        "name": "my-workflow",  # Required
        "nodes": [...],          # Required
        "edges": [...],          # Required
        "description": ""        # Optional
    }
    
    Returns: {
        "name": "my-workflow",
        "filename": "my-workflow.json",
        "message": "Workflow saved successfully"
    }
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Request body is required'}), 400
        
        name = data.get('name', '').strip()
        if not name:
            return jsonify({'error': 'Workflow name is required'}), 400
        
        nodes = data.get('nodes', [])
        edges = data.get('edges', [])
        description = data.get('description', '').strip()
        
        if not isinstance(nodes, list) or not isinstance(edges, list):
            return jsonify({'error': 'nodes and edges must be arrays'}), 400
        
        file_path = _get_workflow_path(name)
        
        # Prepare workflow data
        workflow_data = {
            'name': name,
            'nodes': nodes,
            'edges': edges,
            'description': description,
            'version': 1,
            'saved_at': datetime.now().isoformat()
        }
        
        # Save to file
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(workflow_data, f, indent=2, ensure_ascii=False)
        
        logger.info(f'Workflow saved: {name} ({len(nodes)} nodes, {len(edges)} edges)')
        
        return jsonify({
            'name': name,
            'filename': file_path.name,
            'message': 'Workflow saved successfully'
        }), 200
        
    except Exception as e:
        logger.error(f'Error saving workflow: {str(e)}', exc_info=True)
        return jsonify({
            'error': f'Internal server error: {str(e)}'
        }), 500


if __name__ == '__main__':
    # Use FLASK_PORT env var or default to 5000 (for Docker) or 5001 (for local macOS)
    default_port = 5000 if os.environ.get('DOCKER_CONTAINER') else 5001
    port = int(os.environ.get('FLASK_PORT', default_port))
    app.run(host='0.0.0.0', port=port, debug=True)


