"""
Workflow execution queue and status tracking.

Provides asynchronous execution with progress tracking via queue IDs.
"""

import uuid
import threading
import time
from typing import Dict, List, Optional, Any
from enum import Enum
import logging

from workflow.execution_engine import ExecutionEngine
from workflow.exceptions import GraphValidationError

logger = logging.getLogger(__name__)


class ExecutionStatus(Enum):
    """Execution status."""
    PENDING = 'pending'
    RUNNING = 'running'
    COMPLETED = 'completed'
    FAILED = 'failed'


class WorkflowExecution:
    """Represents a workflow execution with status tracking."""
    
    def __init__(self, queue_id: str, nodes: List[Dict], edges: List[Dict]):
        self.queue_id = queue_id
        self.nodes = nodes
        self.edges = edges
        self.status = ExecutionStatus.PENDING
        self.running_node_ids: List[str] = []
        self.completed_node_ids: List[str] = []
        self.results: Dict[str, Any] = {}
        self.execution_log: List[str] = []
        self.iterations: int = 0
        self.error: Optional[str] = None
        self.stats: Dict[str, Any] = {}
        self.failed_nodes: List[str] = []
        self.engine: Optional[ExecutionEngine] = None
        self.thread: Optional[threading.Thread] = None
        
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON response."""
        result = {
            'queueId': self.queue_id,
            'status': self.status.value,
            'runningNodeIds': self.running_node_ids,
            'completedNodeIds': self.completed_node_ids,
            'results': self.results,
            'executionLog': self.execution_log,
            'iterations': self.iterations,
            'error': self.error
        }
        
        # Add stats and failed nodes if available
        if self.stats:
            result['stats'] = self.stats
        if self.failed_nodes:
            result['failedNodes'] = self.failed_nodes
            result['hasErrors'] = True
        else:
            result['hasErrors'] = False
        
        return result


class ExecutionQueue:
    """Manages workflow execution queue."""
    
    def __init__(self):
        self.executions: Dict[str, WorkflowExecution] = {}
        self.lock = threading.Lock()
    
    def enqueue(self, nodes: List[Dict], edges: List[Dict]) -> str:
        """
        Add workflow to execution queue.
        
        Args:
            nodes: Workflow nodes
            edges: Workflow edges
            
        Returns:
            queue_id: Unique queue identifier
        """
        queue_id = str(uuid.uuid4())
        
        execution = WorkflowExecution(queue_id, nodes, edges)
        
        with self.lock:
            self.executions[queue_id] = execution
        
        # Start execution in background thread
        execution.thread = threading.Thread(
            target=self._execute_workflow,
            args=(execution,),
            daemon=True
        )
        execution.thread.start()
        
        logger.info(f'Enqueued workflow execution: {queue_id}')
        return queue_id
    
    def _execute_workflow(self, execution: WorkflowExecution):
        """Execute workflow in background thread with progress tracking."""
        try:
            execution.status = ExecutionStatus.RUNNING
            
            # Create execution engine (may raise GraphValidationError)
            try:
                execution.engine = ExecutionEngine(execution.nodes, execution.edges)
            except GraphValidationError as e:
                execution.status = ExecutionStatus.FAILED
                execution.error = f'Graph validation failed: {str(e)}'
                execution.execution_log = [f'ERROR: {str(e)}']
                logger.error(f'Workflow execution failed (validation): {execution.queue_id}, error: {str(e)}')
                return
            
            # Wrap execute_node to track progress
            original_execute_node = execution.engine.execute_node
            
            def execute_node_with_tracking(self, node_id: str, timeout_seconds: float = 300.0):
                """Wrapper to track node execution progress."""
                execution.running_node_ids.append(node_id)
                try:
                    # Call original method with timeout
                    result = original_execute_node(node_id, timeout_seconds=timeout_seconds)
                    # Update state immediately
                    execution.running_node_ids.remove(node_id)
                    if node_id not in execution.completed_node_ids:
                        execution.completed_node_ids.append(node_id)
                    execution.results[node_id] = result.to_dict()
                    return result
                except Exception as e:
                    execution.running_node_ids.remove(node_id)
                    raise
            
            # Replace execute_node method with tracking wrapper
            import types
            execution.engine.execute_node = types.MethodType(
                execute_node_with_tracking,
                execution.engine
            )
            
            # Execute workflow (will use our wrapped execute_node)
            result = execution.engine.execute(max_iterations=10, node_timeout=300.0, fail_fast=False)
            
            # Sync final state
            execution.execution_log = result.get('executionLog', [])
            execution.iterations = result.get('iterations', 0)
            
            # Sync stats and errors info
            execution.stats = result.get('stats', {})
            execution.failed_nodes = result.get('failedNodes', [])
            
            # Determine final status based on errors
            has_errors = result.get('hasErrors', False)
            failed_nodes = result.get('failedNodes', [])
            
            if has_errors:
                # Check if execution should be considered failed or completed with errors
                # If all nodes failed, mark as failed
                stats = result.get('stats', {})
                total_nodes = stats.get('total_nodes', 0)
                successful_nodes = stats.get('successful_nodes', 0)
                
                if successful_nodes == 0 and total_nodes > 0:
                    execution.status = ExecutionStatus.FAILED
                    execution.error = f'All {total_nodes} nodes failed execution'
                    logger.error(f'Workflow execution failed: all nodes failed')
                else:
                    # Partial success: some nodes succeeded, some failed
                    execution.status = ExecutionStatus.COMPLETED
                    execution.error = f'Completed with {len(failed_nodes)} failed nodes: {failed_nodes}'
                    logger.warning(f'Workflow completed with errors: {len(failed_nodes)} failed nodes')
            else:
                execution.status = ExecutionStatus.COMPLETED
            
            # Ensure all results are synced (includes partial results from failed nodes)
            for node_id, result_dict in result.get('results', {}).items():
                execution.results[node_id] = result_dict
                if node_id not in execution.completed_node_ids:
                    execution.completed_node_ids.append(node_id)
            
            logger.info(f'Workflow execution completed: {execution.queue_id}')
            
        except Exception as e:
            execution.status = ExecutionStatus.FAILED
            execution.error = str(e)
            logger.error(f'Workflow execution failed: {execution.queue_id}, error: {str(e)}', exc_info=True)
    
    def get_status(self, queue_id: str) -> Optional[WorkflowExecution]:
        """
        Get execution status by queue ID.
        
        Args:
            queue_id: Queue identifier
            
        Returns:
            WorkflowExecution or None if not found
        """
        with self.lock:
            return self.executions.get(queue_id)
    
    def cleanup_old_executions(self, max_age_seconds: int = 3600):
        """
        Clean up old completed executions.
        
        Args:
            max_age_seconds: Maximum age in seconds (default: 1 hour)
        """
        # Note: This is a placeholder - in production, use timestamp tracking
        pass


# Global execution queue instance
_execution_queue = ExecutionQueue()


def enqueue_workflow(nodes: List[Dict], edges: List[Dict]) -> str:
    """Add workflow to execution queue. Returns queue_id."""
    return _execution_queue.enqueue(nodes, edges)


def get_execution_status(queue_id: str) -> Optional[WorkflowExecution]:
    """Get execution status by queue_id."""
    return _execution_queue.get_status(queue_id)

