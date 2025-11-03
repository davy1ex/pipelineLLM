"""
Ollama API service.

Pure function for calling Ollama API - used by both executors and API endpoints.
"""

import requests
import logging
from typing import Dict, Any, Optional
from urllib.parse import urlparse, urlunparse

logger = logging.getLogger(__name__)


def call_ollama_api(
    url: str,
    model: str,
    prompt: str,
    system: Optional[str] = None,
    temperature: float = 0.7,
    timeout: int = 300
) -> Dict[str, Any]:
    """
    Call Ollama API and return result.
    
    Args:
        url: Ollama server URL (default: 'http://localhost:11434')
        model: Model name
        prompt: Prompt text
        system: Optional system prompt
        temperature: Temperature (default: 0.7)
        timeout: Request timeout in seconds (default: 300)
        
    Returns:
        Dict with:
            - response: LLM response text
            - error: error message if failed
            - model: model used
            - url: url used
    """
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
    
    if system:
        payload['system'] = system
        logger.info(f'System prompt: {system[:100]}...')
    
    try:
        logger.info(f'Calling Ollama: {ollama_endpoint} with model: {model}')
        logger.info(f'Prompt length: {len(prompt)} characters')
        
        response = requests.post(
            ollama_endpoint,
            json=payload,
            timeout=timeout
        )
        response.raise_for_status()
        
        result = response.json()
        response_text = result.get('response', '')
        
        if not response_text:
            response_text = 'No response from Ollama'
            logger.warning(f'Ollama returned empty response')
        
        logger.info(f'Ollama response length: {len(response_text)} characters')
        
        return {
            'response': response_text,
            'error': None,
            'model': model,
            'url': url,
            'done': result.get('done', True)
        }
        
    except requests.exceptions.Timeout as e:
        logger.error(f'Ollama API timeout: {str(e)}')
        return {
            'response': '',
            'error': f'Ollama API timeout: {str(e)}',
            'model': model,
            'url': url
        }
    except requests.exceptions.ConnectionError as e:
        logger.error(f'Ollama API connection error: {str(e)}')
        return {
            'response': '',
            'error': f'Cannot connect to Ollama at {url}. Make sure Ollama is running.',
            'model': model,
            'url': url
        }
    except requests.exceptions.RequestException as e:
        status = getattr(getattr(e, 'response', None), 'status_code', None)
        body = getattr(getattr(e, 'response', None), 'text', '')
        logger.error(f'Ollama API error: {str(e)} (status={status}) body={body[:300]}')
        return {
            'response': '',
            'error': f'Failed to call Ollama API: {str(e)}',
            'model': model,
            'url': url,
            'status': status,
            'response': body[:1000]
        }
    except Exception as e:
        logger.error(f'Unexpected error in Ollama API call: {str(e)}', exc_info=True)
        return {
            'response': '',
            'error': f'Unexpected error: {str(e)}',
            'model': model,
            'url': url
        }

