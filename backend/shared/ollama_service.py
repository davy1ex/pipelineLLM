"""
Ollama API service.

Pure function for calling Ollama API - used by both executors and API endpoints.
"""

import requests
import logging
import os
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
    
    # Check prompt length and warn/truncate if too long
    # Ollama /api/generate can have issues with very long prompts (causing 502 errors)
    # Use a conservative limit: ~32k chars = ~8k tokens (safe for most models)
    MAX_PROMPT_LENGTH = 32000  # ~8k tokens (rough estimate: 1 token ~ 4 chars)
    prompt_length = len(prompt)
    original_prompt = prompt
    was_truncated = False
    
    if prompt_length > MAX_PROMPT_LENGTH:
        logger.warning(
            f'Prompt is very long ({prompt_length} chars, max: {MAX_PROMPT_LENGTH}). '
            f'Truncating to {MAX_PROMPT_LENGTH} characters to avoid API errors. '
            f'Consider using a model with larger context window or splitting the input.'
        )
        prompt = prompt[:MAX_PROMPT_LENGTH]
        prompt += f'\n\n[Note: Prompt was truncated from {prompt_length} to {MAX_PROMPT_LENGTH} characters. Original length: {prompt_length}]'
        was_truncated = True
    
    # Use /api/chat for very long prompts (more efficient than /api/generate)
    # Chat API is better for handling large contexts
    # But /api/generate is simpler, so use it by default for smaller prompts
    use_chat_api = prompt_length > 30000  # For prompts > 30k chars, prefer chat API
    
    # Prepare Ollama API request
    if use_chat_api:
        ollama_endpoint = f"{url.rstrip('/')}/api/chat"
        # Chat API format
        messages = []
        if system:
            messages.append({'role': 'system', 'content': system})
        messages.append({'role': 'user', 'content': prompt})
        payload = {
            'model': model,
            'messages': messages,
            'stream': False,
            'options': {
                'temperature': temperature
            }
        }
    else:
        ollama_endpoint = f"{url.rstrip('/')}/api/generate"
        # Generate API format
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
    
    if system:
        logger.info(f'System prompt: {system[:100]}...' + ('...' if len(system) > 100 else ''))
    
    # Optional: Quick connectivity check (can be disabled if too slow)
    # For VPN/remote servers, this helps diagnose network issues
    try:
        import socket
        parsed_url = urlparse(ollama_endpoint)
        host = parsed_url.hostname
        port = parsed_url.port or (443 if parsed_url.scheme == 'https' else 80)
        
        # Quick TCP connection test (non-blocking check)
        logger.debug(f'Testing connectivity to {host}:{port}')
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(2)  # 2 second timeout for connectivity test
        result = sock.connect_ex((host, port))
        sock.close()
        
        if result != 0:
            logger.warning(f'Connectivity test failed to {host}:{port} (error code: {result}). '
                         f'Request will still be attempted, but may fail.')
    except Exception as conn_check_error:
        # Don't fail the request if connectivity check fails
        logger.debug(f'Connectivity check failed (non-critical): {conn_check_error}')
    
    try:
        logger.info(f'Calling Ollama: {ollama_endpoint} with model: {model}')
        logger.info(f'Prompt length: {len(prompt)} characters' + 
                   (f' (truncated from {prompt_length})' if prompt_length > MAX_PROMPT_LENGTH else ''))
        
        # For debugging: log request details (without full payload)
        logger.debug(f'Ollama request: {ollama_endpoint}, payload size: {len(str(payload))} bytes')
        
        # Make request with better error handling
        # Support proxy via environment variables if needed (for VPN scenarios)
        proxies = None
        if os.environ.get('HTTP_PROXY') or os.environ.get('HTTPS_PROXY'):
            proxies = {
                'http': os.environ.get('HTTP_PROXY'),
                'https': os.environ.get('HTTPS_PROXY')
            }
            logger.debug(f'Using proxy: {proxies}')
        
        response = requests.post(
            ollama_endpoint,
            json=payload,
            timeout=timeout,
            # Allow redirects
            allow_redirects=True,
            # Add headers for better compatibility
            headers={
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            # Use proxy if configured
            proxies=proxies
        )
        
        # Log response status for debugging
        logger.debug(f'Ollama response status: {response.status_code}')
        
        response.raise_for_status()
        
        result = response.json()
        
        # Handle different response formats
        if use_chat_api:
            # Chat API returns message object
            message = result.get('message', {})
            response_text = message.get('content', '')
        else:
            # Generate API returns response directly
            response_text = result.get('response', '')
        
        if not response_text:
            response_text = 'No response from Ollama'
            logger.warning(f'Ollama returned empty response')
        
        if was_truncated:
            response_text = f'[Warning: Input was truncated from {prompt_length} to {MAX_PROMPT_LENGTH} characters]\n\n{response_text}'
        
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
        response_obj = getattr(e, 'response', None)
        body = response_obj.text if response_obj else ''
        headers = dict(response_obj.headers) if response_obj else {}
        
        # Detailed error logging for network issues
        logger.error(
            f'Ollama API error: {str(e)} (status={status}, url={ollama_endpoint})'
        )
        if body:
            logger.error(f'Response body: {body[:500]}')
        if headers:
            logger.debug(f'Response headers: {headers}')
        
        # Check if error might be due to prompt length
        error_msg = f'Failed to call Ollama API: {str(e)}'
        if status == 502:
            if prompt_length > 50000:
                error_msg += f' (This may be due to the very long prompt: {prompt_length} characters)'
            else:
                # 502 Bad Gateway often indicates network/proxy issues
                error_msg += (
                    f' (502 Bad Gateway - This may indicate: '
                    f'1) Ollama server is overloaded or crashed, '
                    f'2) Network/VPN connectivity issues, '
                    f'3) Proxy or gateway configuration problems. '
                    f'Check if Ollama is accessible at {url}'
                )
        
        return {
            'response': '',
            'error': error_msg,
            'model': model,
            'url': url,
            'status': status,
            'response': body[:1000] if body else '',
            'endpoint': ollama_endpoint
        }
    except Exception as e:
        logger.error(f'Unexpected error in Ollama API call: {str(e)}', exc_info=True)
        return {
            'response': '',
            'error': f'Unexpected error: {str(e)}',
            'model': model,
            'url': url
        }

