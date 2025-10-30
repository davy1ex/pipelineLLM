from flask import Flask, jsonify, request
from flask_cors import CORS
import os
import logging
import requests
from typing import Optional

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

@app.route('/api/health', methods=['GET'])
def health_check():
    logger.info('Health check called')
    return jsonify({
        'status': 'healthy',
        'message': 'Backend is running'
    }), 200

@app.route('/api/hello', methods=['GET'])
def hello():
    name = request.args.get('name', 'World')
    logger.info(f'Hello endpoint called with name: {name}')
    return jsonify({
        'message': f'Hello, {name}!',
        'timestamp': request.headers.get('Date')
    }), 200

@app.route('/api/data', methods=['POST'])
def create_data():
    data = request.get_json()
    logger.info(f'Data received: {data}')
    return jsonify({
        'received': data,
        'status': 'success'
    }), 201

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

        # Convert localhost/docker.host.internal to host.docker.internal for Docker access
        if 'localhost' in ollama_url or '127.0.0.1' in ollama_url:
            ollama_url = ollama_url.replace('localhost', 'host.docker.internal').replace('127.0.0.1', 'host.docker.internal')
        elif 'docker.host.internal' in ollama_url:
            ollama_url = ollama_url.replace('docker.host.internal', 'host.docker.internal')

        # Prepare Ollama API request
        ollama_endpoint = f"{ollama_url.rstrip('/')}/api/generate"
        payload = {
            'model': model,
            'prompt': prompt,
            'stream': False,
            'options': {
                'temperature': temperature
            }
        }
        
        # Add system prompt if provided
        if system:
            payload['system'] = system
            logger.info(f'System prompt: {system[:100]}...')

        logger.info(f'Calling Ollama: {ollama_endpoint} with model: {model}')
        logger.info(f'Prompt: {prompt[:100]}...')

        # Call Ollama API
        response = requests.post(
            ollama_endpoint,
            json=payload,
            timeout=300  # 5 minutes timeout
        )
        response.raise_for_status()

        # Parse Ollama response
        try:
            result = response.json()
            response_text = result.get('response', '')
            
            # Check if response is valid
            if not response_text:
                logger.warning(f'Ollama returned empty response. Full result: {result}')
                response_text = 'No response from Ollama'
        except ValueError as e:
            logger.error(f'Failed to parse Ollama JSON response: {e}. Response: {response.text[:500]}')
            raise Exception(f'Invalid JSON response from Ollama: {str(e)}')

        logger.info(f'Ollama response length: {len(response_text)} characters')

        return jsonify({
            'response': response_text,
            'model': model,
            'done': result.get('done', True)
        }), 200

    except requests.exceptions.Timeout as e:
        logger.error(f'Ollama API timeout: {str(e)}')
        return jsonify({
            'error': f'Ollama API request timeout: {str(e)}'
        }), 504
    except requests.exceptions.ConnectionError as e:
        logger.error(f'Ollama API connection error: {str(e)}')
        return jsonify({
            'error': f'Cannot connect to Ollama at {ollama_url}. Make sure Ollama is running.'
        }), 503
    except requests.exceptions.RequestException as e:
        logger.error(f'Ollama API error: {str(e)}')
        return jsonify({
            'error': f'Failed to call Ollama API: {str(e)}'
        }), 500
    except Exception as e:
        logger.error(f'Unexpected error: {str(e)}', exc_info=True)
        return jsonify({
            'error': f'Internal server error: {str(e)}'
        }), 500

if __name__ == '__main__':
    # Port 5000 inside container, mapped to 5001 on host
    app.run(host='0.0.0.0', port=5000, debug=True)


