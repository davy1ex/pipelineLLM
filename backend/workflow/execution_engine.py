"""
Execution engine for workflow execution.

Orchestrates node execution, handles input resolution, caching, and iterative passes.
"""

from typing import Dict, List, Optional, Any
import logging
import signal
import threading
from contextlib import contextmanager
from workflow.graph_builder import DependencyGraph, build_dependency_graph
from workflow.topological_sort import topological_sort, validate_graph
from workflow.exceptions import (
    GraphValidationError,
    NodeExecutionError,
    NodeTimeoutError,
    DependencyError
)
from executors.registry import get_executor
from executors.base import ExecutorResult

logger = logging.getLogger(__name__)


def _get_node_timeout(node_type: str, default_timeout: float = 300.0) -> float:
    """
    Get timeout for a specific node type.
    
    Some nodes (like docling) may need longer timeouts, especially in Docker
    where GPU acceleration is not available.
    
    Args:
        node_type: Node type string
        default_timeout: Default timeout in seconds
        
    Returns:
        Timeout in seconds for this node type
    """
    # Timeout overrides for specific node types
    timeout_map = {
        'docling': 600.0,  # 10 minutes - docling can be slow in Docker without GPU
        'python': 300.0,
        'ollama': 300.0,
    }
    return timeout_map.get(node_type, default_timeout)


class ExecutionEngine:
    """Orchestrates workflow execution."""
    
    def __init__(self, nodes: List[Dict], edges: List[Dict]):
        """
        Initialize execution engine.
        
        Args:
            nodes: List of node dicts (ReactFlow format)
            edges: List of edge dicts (ReactFlow format)
        """
        self.nodes = nodes
        self.edges = edges
        self.nodes_by_id = {n['id']: n for n in nodes}
        
        # Build dependency graph
        self.graph = build_dependency_graph(nodes, edges)
        
        # Validate graph (strict validation)
        validation_errors = validate_graph(self.graph, nodes)
        if validation_errors:
            critical_errors = [
                e for e in validation_errors 
                if 'not found' in e or 'non-existent' in e or 'self-referential' in e
            ]
            if critical_errors:
                raise GraphValidationError(critical_errors)
            else:
                logger.warning(f'Graph validation warnings: {validation_errors}')
        
        # Execution state
        self.results: Dict[str, ExecutorResult] = {}  # node_id -> result
        self.execution_log: List[str] = []
        self.failed_nodes: List[str] = []  # Track failed nodes for partial results
        self.execution_stats: Dict[str, Any] = {
            'total_nodes': 0,
            'successful_nodes': 0,
            'failed_nodes': 0,
            'skipped_nodes': 0,
        }
    
    def resolve_inputs(self, node_id: str) -> Dict[str, Any]:
        """
        Resolve all inputs for a node.
        
        For each input handle:
        1. Check if connected via edge
        2. Get value from source node (priority: cached result > node.data)
        3. Fallback to node.data if no connection
        
        Args:
            node_id: Target node ID
            
        Returns:
            Dict mapping handle_name -> resolved value
        """
        node = self.nodes_by_id.get(node_id)
        if not node:
            return {}
        
        node_type = node.get('type', '')
        node_data = node.get('data', {})
        inputs = {}
        
        # Get all input connections for this node
        input_sources = self.graph.get_all_input_sources(node_id)
        
        # Resolve each input handle based on node type
        if node_type == 'ollama':
            # Resolve 'prompt' handle (or default)
            prompt_source = input_sources.get('prompt')
            if not prompt_source:
                # Try default edge
                default_source = self.graph.get_input_source(node_id, None)
                if default_source:
                    prompt_source = default_source
            
            if prompt_source:
                source_id, _ = prompt_source
                prompt_value = self._get_node_output(source_id)
                inputs['prompt'] = prompt_value
            else:
                # Fallback to node.data
                inputs['prompt'] = node_data.get('prompt', '')
            
            # Resolve 'systemPrompt' handle
            sys_source = input_sources.get('systemPrompt')
            if sys_source:
                source_id, _ = sys_source
                sys_value = self._get_node_output(source_id)
                inputs['systemPrompt'] = sys_value
            else:
                inputs['systemPrompt'] = node_data.get('systemPrompt', '')
            
            # Resolve 'config' handle (from Settings node)
            config_source = input_sources.get('config')
            if config_source:
                source_id, _ = config_source
                source_node = self.nodes_by_id.get(source_id)
                if source_node and source_node.get('type') == 'settings':
                    # Get config from settings node result
                    settings_result = self.results.get(source_id)
                    if settings_result and settings_result.metadata.get('config'):
                        inputs['config'] = settings_result.metadata['config']
                    else:
                        # Fallback to settings node data
                        settings_data = source_node.get('data', {})
                        inputs['config'] = {
                            'url': settings_data.get('url', 'http://localhost:11434'),
                            'model': settings_data.get('model', 'llama3.2'),
                            'temperature': settings_data.get('temperature', 0.7),
                        }
                else:
                    # Try to get config from source node data
                    source_data = source_node.get('data', {}) if source_node else {}
                    inputs['config'] = source_data
            # else: No config connection, will use node.data defaults in executor
        
        elif node_type == 'python':
            # Resolve 'input' handle (or default)
            input_source = input_sources.get('input')
            if not input_source:
                # Try default edge
                default_source = self.graph.get_input_source(node_id, None)
                if default_source:
                    input_source = default_source
            
            if input_source:
                source_id, _ = input_source
                input_value = self._get_node_output(source_id)
                inputs['input'] = input_value
            else:
                inputs['input'] = ''
            
        elif node_type == 'fileWriter':
            # Resolve 'text' handle (or default)
            text_source = input_sources.get('text')
            if not text_source:
                # Try default edge
                default_source = self.graph.get_input_source(node_id, None)
                if default_source:
                    text_source = default_source
            
            if text_source:
                source_id, _ = text_source
                text_value = self._get_node_output(source_id)
                inputs['text'] = text_value
            else:
                inputs['text'] = ''
        
        return inputs
    
    def _get_node_output(self, node_id: str) -> str:
        """
        Get output from a node (priority: cached result > node.data).
        
        Args:
            node_id: Source node ID
            
        Returns:
            Output string
        """
        # Priority 1: Cached execution result
        if node_id in self.results:
            result = self.results[node_id]
            if result.is_success():
                return result.output
        
        # Priority 2: Node data
        node = self.nodes_by_id.get(node_id)
        if node:
            node_data = node.get('data', {})
            # Try common output fields
            return (
                node_data.get('value') or
                node_data.get('text') or
                node_data.get('output') or
                node_data.get('lastResponse') or
                ''
            )
        
        return ''
    
    def _check_dependencies(self, node_id: str) -> List[str]:
        """
        Check if all dependencies for a node are satisfied.
        
        Args:
            node_id: Node ID to check
            
        Returns:
            List of missing/unresolved dependency node IDs
        """
        dependencies = self.graph.get_dependencies(node_id)
        missing = []
        
        for dep_id in dependencies:
            # Check if dependency has been executed successfully
            if dep_id not in self.results:
                missing.append(dep_id)
            elif not self.results[dep_id].is_success():
                missing.append(dep_id)
        
        return missing
    
    @contextmanager
    def _timeout_context(self, timeout_seconds: float):
        """Context manager for execution timeout."""
        if timeout_seconds <= 0:
            yield
            return
        
        def timeout_handler(signum, frame):
            raise TimeoutError(f"Execution timeout after {timeout_seconds}s")
        
        # Set timeout (only works in main thread on Unix)
        if threading.current_thread() is threading.main_thread():
            old_handler = signal.signal(signal.SIGALRM, timeout_handler)
            signal.alarm(int(timeout_seconds))
            try:
                yield
            finally:
                signal.alarm(0)
                signal.signal(signal.SIGALRM, old_handler)
        else:
            # In thread, timeout must be handled by executor
            yield
    
    def execute_node(self, node_id: str, timeout_seconds: float = 300.0) -> ExecutorResult:
        """
        Execute a single node with error handling and timeout.
        
        Args:
            node_id: Node ID to execute
            timeout_seconds: Maximum execution time in seconds (default: 300s = 5min)
            
        Returns:
            ExecutorResult
        """
        node = self.nodes_by_id.get(node_id)
        if not node:
            error_msg = f'Node {node_id} not found'
            logger.error(error_msg)
            result = ExecutorResult(output='', error=error_msg)
            self.results[node_id] = result
            self.failed_nodes.append(node_id)
            return result
        
        node_type = node.get('type', '')
        executor = get_executor(node_type)
        
        if not executor:
            error_msg = f'No executor for node type: {node_type}'
            logger.error(error_msg)
            result = ExecutorResult(output='', error=error_msg)
            self.results[node_id] = result
            self.failed_nodes.append(node_id)
            return result
        
        # Get appropriate timeout for this node type
        actual_timeout = _get_node_timeout(node_type, timeout_seconds)
        if actual_timeout != timeout_seconds:
            logger.debug(f'Node {node_id} ({node_type}): using extended timeout {actual_timeout}s (default: {timeout_seconds}s)')
        
        # Check dependencies
        missing_deps = self._check_dependencies(node_id)
        if missing_deps:
            error_msg = f'Unresolved dependencies: {missing_deps}'
            logger.error(f'Node {node_id}: {error_msg}')
            result = ExecutorResult(output='', error=error_msg)
            self.results[node_id] = result
            self.failed_nodes.append(node_id)
            return result
        
        # Resolve inputs
        try:
            inputs = self.resolve_inputs(node_id)
        except Exception as e:
            error_msg = f'Failed to resolve inputs: {str(e)}'
            logger.error(f'Node {node_id}: {error_msg}', exc_info=True)
            result = ExecutorResult(output='', error=error_msg)
            self.results[node_id] = result
            self.failed_nodes.append(node_id)
            return result
        
        # Execute with timeout
        logger.info(f'Executing node {node_id} ({node_type}) [timeout: {actual_timeout}s]')
        self.execution_log.append(f'Executing node {node_id} ({node_type})')
        
        try:
            import time
            start_time = time.time()
            with self._timeout_context(actual_timeout):
                result = executor(node, inputs)
            elapsed_time = time.time() - start_time
            logger.debug(f'Node {node_id} execution took {elapsed_time:.2f}s')
            
            self.results[node_id] = result
            
            if result.is_success():
                logger.info(f'Node {node_id} completed: output length={len(result.output)}')
                self.execution_log.append(f'Node {node_id} completed successfully')
                self.execution_stats['successful_nodes'] += 1
            else:
                logger.error(f'Node {node_id} failed: {result.error}')
                self.execution_log.append(f'Node {node_id} failed: {result.error}')
                self.failed_nodes.append(node_id)
                self.execution_stats['failed_nodes'] += 1
            
            return result
            
        except TimeoutError as e:
            error_msg = f'Execution timeout after {actual_timeout}s'
            logger.error(f'Node {node_id}: {error_msg}')
            self.execution_log.append(f'Node {node_id} timeout: {error_msg}')
            result = ExecutorResult(output='', error=error_msg)
            self.results[node_id] = result
            self.failed_nodes.append(node_id)
            self.execution_stats['failed_nodes'] += 1
            return result
            
        except Exception as e:
            error_msg = f'Exception: {str(e)}'
            logger.error(f'Exception executing node {node_id}: {error_msg}', exc_info=True)
            self.execution_log.append(f'Node {node_id} exception: {error_msg}')
            result = ExecutorResult(output='', error=error_msg)
            self.results[node_id] = result
            self.failed_nodes.append(node_id)
            self.execution_stats['failed_nodes'] += 1
            return result
    
    def execute(self, max_iterations: int = 10, node_timeout: float = 300.0, 
                fail_fast: bool = False) -> Dict[str, Any]:
        """
        Execute workflow with iterative passes and error handling.
        
        Algorithm:
        1. Get topological execution order
        2. Execute nodes in order
        3. Repeat until no new results (up to max_iterations)
        
        This allows cycles: Python → Ollama → Python
        
        Args:
            max_iterations: Maximum number of passes (default: 10)
            node_timeout: Timeout per node in seconds (default: 300s = 5min)
            fail_fast: If True, stop execution on first critical error (default: False)
            
        Returns:
            Dict with:
                - results: Dict[node_id, ExecutorResult dict] (includes partial results)
                - executionLog: List of log messages
                - iterations: Number of iterations performed
                - stats: Execution statistics
                - hasErrors: Boolean indicating if errors occurred
                - failedNodes: List of failed node IDs
        """
        from executors.registry import get_executable_types
        
        executable_types = get_executable_types()
        executable_nodes = [n for n in self.nodes if n.get('type') in executable_types]
        
        if not executable_nodes:
            return {
                'results': {},
                'executionLog': ['No executable nodes found'],
                'iterations': 0,
                'stats': self.execution_stats,
                'hasErrors': False,
                'failedNodes': []
            }
        
        self.execution_stats['total_nodes'] = len(executable_nodes)
        logger.info(f'Starting workflow execution: {len(executable_nodes)} executable nodes')
        self.execution_log.append(f'Starting workflow execution: {len(executable_nodes)} executable nodes')
        
        iterations = 0
        last_result_count = -1
        last_successful_count = -1
        
        while iterations < max_iterations:
            iterations += 1
            logger.info(f'Iteration {iterations}')
            self.execution_log.append(f'Iteration {iterations}')
            
            # Get execution order (may change if dependencies resolve)
            try:
                execution_order = topological_sort(self.graph, self.nodes)
            except Exception as e:
                error_msg = f'Failed to determine execution order: {str(e)}'
                logger.error(error_msg, exc_info=True)
                self.execution_log.append(f'ERROR: {error_msg}')
                break
            
            # Execute nodes in order
            iteration_errors = []
            for node_id in execution_order:
                # Skip if already successfully executed (unless we're in retry mode)
                if node_id in self.results and self.results[node_id].is_success():
                    if iterations == 1:  # First iteration: skip already successful
                        continue
                
                # Execute or re-execute
                result = self.execute_node(node_id, timeout_seconds=node_timeout)
                
                if not result.is_success():
                    iteration_errors.append(node_id)
                    
                    if fail_fast:
                        critical_error = (
                            'NodeExecutionError' in str(type(result.error)) or
                            'DependencyError' in str(type(result.error))
                        )
                        if critical_error:
                            logger.error(f'Fail-fast: stopping due to critical error in {node_id}')
                            self.execution_log.append(f'Fail-fast: stopping execution due to error in {node_id}')
                            break
            
            # Check if we made progress (new successful results)
            successful_results = sum(1 for r in self.results.values() if r.is_success())
            current_result_count = len(self.results)
            
            if current_result_count == last_result_count and successful_results == last_successful_count:
                logger.info('No new results, stopping')
                self.execution_log.append('No new results, stopping')
                break
            
            last_result_count = current_result_count
            last_successful_count = successful_results
        
        if iterations >= max_iterations:
            logger.warning(f'Reached max iterations ({max_iterations})')
            self.execution_log.append(f'Reached max iterations ({max_iterations})')
        
        # Calculate final statistics
        self.execution_stats['skipped_nodes'] = (
            self.execution_stats['total_nodes'] - 
            self.execution_stats['successful_nodes'] - 
            self.execution_stats['failed_nodes']
        )
        
        has_errors = len(self.failed_nodes) > 0
        
        # Convert results to dicts (includes partial results)
        results_dict = {
            node_id: result.to_dict()
            for node_id, result in self.results.items()
        }
        
        return {
            'results': results_dict,
            'executionLog': self.execution_log,
            'iterations': iterations,
            'stats': self.execution_stats.copy(),
            'hasErrors': has_errors,
            'failedNodes': self.failed_nodes.copy()
        }

