"""
Executor for Ollama (LLM) nodes.
"""

import logging
from typing import Dict, Any

from executors.base import ExecutorResult
from shared.ollama_service import call_ollama_api

logger = logging.getLogger(__name__)


def execute_ollama(node: Dict[str, Any], inputs: Dict[str, Any]) -> ExecutorResult:
    """
    Execute an Ollama node.
    
    Node data fields:
        - model: str (default: 'llama3.2')
        - url: str (default: 'http://localhost:11434')
        - temperature: float (default: 0.7)
        - systemPrompt: str (optional)
    
    Inputs:
        - prompt: str (required) - from edge or node.data.prompt
        - systemPrompt: str (optional) - from edge or node.data.systemPrompt
        - config: dict (optional) - from Settings node via 'config' handle
            Contains: url, model, temperature
    
    Returns:
        ExecutorResult with:
            - output: LLM response text
            - error: error message if failed
            - metadata: {'model': str, 'url': str}
    """
    node_data = node.get('data', {})
    
    # Get config from inputs (Settings node) or fallback to node.data
    config = inputs.get('config', {})
    if isinstance(config, dict):
        url = config.get('url') or node_data.get('url') or 'http://localhost:11434'
        model = config.get('model') or node_data.get('model') or 'llama3.2'
        temperature = config.get('temperature') or node_data.get('temperature', 0.7)
    else:
        url = node_data.get('url') or 'http://localhost:11434'
        model = node_data.get('model') or 'llama3.2'
        temperature = node_data.get('temperature', 0.7)
    
    # Get prompt (priority: inputs.prompt > node.data.prompt > '')
    prompt = inputs.get('prompt') or node_data.get('prompt') or ''
    if not prompt:
        return ExecutorResult(
            output='',
            error='Prompt is required for Ollama node',
            metadata={'model': model, 'url': url}
        )
    
    # Get system prompt (priority: inputs.systemPrompt > node.data.systemPrompt > None)
    system_prompt = inputs.get('systemPrompt')
    if not system_prompt:
        system_prompt = node_data.get('systemPrompt')
    
    # Use shared service for Ollama API call
    result = call_ollama_api(
        url=url,
        model=model,
        prompt=prompt,
        system=system_prompt,
        temperature=float(temperature),
        timeout=300
    )
    
    return ExecutorResult(
        output=result.get('response', ''),
        error=result.get('error'),
        metadata={
            'model': result.get('model', model),
            'url': result.get('url', url)
        }
    )

