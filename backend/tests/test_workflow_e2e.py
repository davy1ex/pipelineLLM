#!/usr/bin/env python3
"""
End-to-end test for workflow execution.

Tests:
1. Create workflow (Python-only, no external deps)
2. Send to backend API
3. Verify execution order matches expected topology
4. Verify results are correct
5. Test error handling scenarios
"""

import json
import sys
import os
import time
import requests
from pathlib import Path
from typing import Dict, List, Any

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

API_BASE = os.environ.get('API_BASE', 'http://localhost:5001')
EXECUTE_URL = f'{API_BASE}/api/workflow/execute'
STATUS_URL = f'{API_BASE}/api/workflow/{{queue_id}}/status'


def poll_status(queue_id: str, timeout_sec: int = 60, interval_sec: float = 0.5):
    """Poll status endpoint until completed/failed or timeout."""
    start = time.time()
    while time.time() - start < timeout_sec:
        try:
            r = requests.get(STATUS_URL.format(queue_id=queue_id), timeout=10)
            if r.status_code != 200:
                raise RuntimeError(f'Status HTTP {r.status_code}: {r.text[:200]}')
            status = r.json()
            if status.get('status') in ('completed', 'failed'):
                return status
            time.sleep(interval_sec)
        except requests.exceptions.RequestException as e:
            raise RuntimeError(f'Status polling error: {e}')
    raise TimeoutError(f'Status polling timeout after {timeout_sec}s')


def extract_execution_order(log: List[str]) -> List[str]:
    """Extract node execution order from execution log."""
    order = []
    for line in log:
        if 'Executing node' in line:
            # Extract node ID from "Executing node <node_id> (<type>)"
            parts = line.split('Executing node')
            if len(parts) > 1:
                node_part = parts[1].strip().split()[0]
                order.append(node_part)
    return order


def verify_topological_order(
    nodes: List[Dict], 
    edges: List[Dict], 
    execution_order: List[str]
) -> tuple[bool, str]:
    """
    Verify that execution order respects dependencies.
    
    Returns: (is_valid, error_message)
    """
    # Build dependency map: node_id -> set of dependencies
    dependencies: Dict[str, set] = {n['id']: set() for n in nodes}
    
    for edge in edges:
        source_id = edge.get('source')
        target_id = edge.get('target')
        if source_id and target_id:
            dependencies[target_id].add(source_id)
    
    # Check that each node is executed after its dependencies
    executed = set()
    for node_id in execution_order:
        node_deps = dependencies.get(node_id, set())
        missing_deps = node_deps - executed
        if missing_deps:
            return False, f'Node {node_id} executed before dependencies: {missing_deps}'
        executed.add(node_id)
    
    return True, ''


def test_python_chain_workflow():
    """Test simple chain: input -> python1 -> python2 -> output"""
    print('\n🧪 Test 1: Python chain workflow')
    print('=' * 60)
    
    workflow = {
        'nodes': [
            {
                'id': 'input-1',
                'type': 'textInput',
                'position': {'x': 0, 'y': 0},
                'data': {'label': 'Text Input', 'value': 'hello world'}
            },
            {
                'id': 'python-1',
                'type': 'python',
                'position': {'x': 200, 'y': 0},
                'data': {'label': 'Python 1', 'code': 'output = data_input.upper()'}
            },
            {
                'id': 'python-2',
                'type': 'python',
                'position': {'x': 400, 'y': 0},
                'data': {'label': 'Python 2', 'code': 'output = data_input.replace(" ", "-")'}
            },
            {
                'id': 'output-1',
                'type': 'output',
                'position': {'x': 600, 'y': 0},
                'data': {'label': 'Output', 'text': ''}
            }
        ],
        'edges': [
            {
                'id': 'e1',
                'source': 'input-1',
                'target': 'python-1',
                'sourceHandle': 'output',
                'targetHandle': 'input'
            },
            {
                'id': 'e2',
                'source': 'python-1',
                'target': 'python-2',
                'sourceHandle': 'output',
                'targetHandle': 'input'
            },
            {
                'id': 'e3',
                'source': 'python-2',
                'target': 'output-1',
                'sourceHandle': 'output',
                'targetHandle': 'text'
            }
        ]
    }
    
    # Expected execution order: input-1, python-1, python-2
    # Expected results:
    #   input-1: "hello world"
    #   python-1: "HELLO WORLD"
    #   python-2: "HELLO-WORLD"
    
    print(f'📋 Workflow: {len(workflow["nodes"])} nodes, {len(workflow["edges"])} edges')
    
    # Send to API
    print(f'🚀 Sending to {EXECUTE_URL}...')
    response = requests.post(EXECUTE_URL, json=workflow, timeout=30)
    
    if response.status_code != 202:
        print(f'❌ Expected 202, got {response.status_code}: {response.text[:300]}')
        return False
    
    data = response.json()
    queue_id = data.get('queueId')
    if not queue_id:
        print(f'❌ No queueId in response: {data}')
        return False
    
    print(f'✅ Enqueued: {queue_id}')
    
    # Poll for completion
    print('⏳ Polling status...')
    status = poll_status(queue_id, timeout_sec=30)
    
    print(f'📊 Final status: {status.get("status")}')
    
    # Verify execution order
    execution_log = status.get('executionLog', [])
    execution_order = extract_execution_order(execution_log)
    print(f'📋 Execution order: {" -> ".join(execution_order)}')
    
    is_valid, error_msg = verify_topological_order(
        workflow['nodes'], 
        workflow['edges'], 
        execution_order
    )
    
    if not is_valid:
        print(f'❌ Topology violation: {error_msg}')
        return False
    
    print('✅ Execution order is valid (respects dependencies)')
    
    # Verify results
    results = status.get('results', {})
    print('\n📊 Results:')
    
    input_result = results.get('input-1', {})
    python1_result = results.get('python-1', {})
    python2_result = results.get('python-2', {})
    
    # Check input-1
    if input_result.get('error'):
        print(f'❌ input-1 failed: {input_result["error"]}')
        return False
    input_output = input_result.get('output', '')
    if input_output != 'hello world':
        print(f'❌ input-1 output mismatch: expected "hello world", got {input_output!r}')
        return False
    print(f'   ✅ input-1: {input_output!r}')
    
    # Check python-1
    if python1_result.get('error'):
        print(f'❌ python-1 failed: {python1_result["error"]}')
        return False
    python1_output = python1_result.get('output', '')
    expected1 = 'HELLO WORLD'
    if python1_output != expected1:
        print(f'❌ python-1 output mismatch: expected {expected1!r}, got {python1_output!r}')
        return False
    print(f'   ✅ python-1: {python1_output!r}')
    
    # Check python-2
    if python2_result.get('error'):
        print(f'❌ python-2 failed: {python2_result["error"]}')
        return False
    python2_output = python2_result.get('output', '')
    expected2 = 'HELLO-WORLD'
    if python2_output != expected2:
        print(f'❌ python-2 output mismatch: expected {expected2!r}, got {python2_output!r}')
        return False
    print(f'   ✅ python-2: {python2_output!r}')
    
    # Verify no errors
    if status.get('hasErrors'):
        failed_nodes = status.get('failedNodes', [])
        print(f'⚠️  Workflow completed with errors: {failed_nodes}')
        return False
    
    print('\n✨ Test 1 PASSED: Python chain workflow executed correctly')
    return True


def test_partial_failure():
    """Test workflow with one failing node (partial results)"""
    print('\n🧪 Test 2: Partial failure handling')
    print('=' * 60)
    
    workflow = {
        'nodes': [
            {
                'id': 'input-1',
                'type': 'textInput',
                'position': {'x': 0, 'y': 0},
                'data': {'label': 'Text Input', 'value': 'test'}
            },
            {
                'id': 'python-1',
                'type': 'python',
                'position': {'x': 200, 'y': 0},
                'data': {'label': 'Python 1', 'code': 'output = data_input.upper()'}
            },
            {
                'id': 'ollama-1',
                'type': 'ollama',
                'position': {'x': 400, 'y': 0},
                'data': {'label': 'Ollama', 'prompt': ''}  # Empty prompt will fail
            }
        ],
        'edges': [
            {
                'id': 'e1',
                'source': 'input-1',
                'target': 'python-1',
                'sourceHandle': 'output',
                'targetHandle': 'input'
            },
            {
                'id': 'e2',
                'source': 'python-1',
                'target': 'ollama-1',
                'sourceHandle': 'output',
                'targetHandle': 'prompt'
            }
        ]
    }
    
    print(f'📋 Workflow: {len(workflow["nodes"])} nodes, {len(workflow["edges"])} edges')
    
    # Send to API
    response = requests.post(EXECUTE_URL, json=workflow, timeout=30)
    
    if response.status_code != 202:
        print(f'❌ Expected 202, got {response.status_code}')
        return False
    
    queue_id = response.json().get('queueId')
    print(f'✅ Enqueued: {queue_id}')
    
    # Poll for completion
    status = poll_status(queue_id, timeout_sec=30)
    
    print(f'📊 Final status: {status.get("status")}')
    
    results = status.get('results', {})
    
    # Verify successful nodes still executed
    input_result = results.get('input-1', {})
    python1_result = results.get('python-1', {})
    ollama1_result = results.get('ollama-1', {})
    
    if input_result.get('error'):
        print(f'❌ input-1 should succeed, but failed: {input_result["error"]}')
        return False
    print(f'   ✅ input-1: succeeded')
    
    if python1_result.get('error'):
        print(f'❌ python-1 should succeed, but failed: {python1_result["error"]}')
        return False
    print(f'   ✅ python-1: succeeded')
    
    # Verify ollama-1 failed
    if not ollama1_result.get('error'):
        print(f'❌ ollama-1 should fail (empty prompt), but succeeded')
        return False
    print(f'   ✅ ollama-1: failed as expected - {ollama1_result["error"]}')
    
    # Verify partial results are returned
    if len(results) < 3:
        print(f'❌ Expected 3 node results, got {len(results)}')
        return False
    
    # Verify stats
    stats = status.get('stats', {})
    if stats.get('successful_nodes', 0) < 2:
        print(f'❌ Expected at least 2 successful nodes, got {stats.get("successful_nodes")}')
        return False
    
    if stats.get('failed_nodes', 0) < 1:
        print(f'❌ Expected at least 1 failed node, got {stats.get("failed_nodes")}')
        return False
    
    print(f'📊 Stats: {stats}')
    
    # Should be completed (not failed) because some nodes succeeded
    if status.get('status') == 'failed':
        print(f'⚠️  Status is "failed" but should be "completed with errors"')
    
    print('\n✨ Test 2 PASSED: Partial failure handled correctly')
    return True


def main():
    """Run all e2e tests."""
    print('🧪 End-to-End Workflow Execution Tests')
    print('=' * 60)
    
    # Check if backend is available
    try:
        response = requests.get(f'{API_BASE}/health', timeout=5)
        print(f'✅ Backend is reachable at {API_BASE}')
    except Exception as e:
        print(f'❌ Cannot connect to backend at {API_BASE}: {e}')
        print('   Make sure backend is running:')
        print('   docker compose up -d backend')
        print('   or')
        print('   cd backend && python -m app')
        return False
    
    print()
    
    tests = [
        ('Python Chain Workflow', test_python_chain_workflow),
        ('Partial Failure Handling', test_partial_failure),
    ]
    
    results = []
    for test_name, test_func in tests:
        try:
            success = test_func()
            results.append((test_name, success))
        except Exception as e:
            print(f'\n❌ Test "{test_name}" crashed: {e}')
            import traceback
            traceback.print_exc()
            results.append((test_name, False))
    
    # Summary
    print('\n' + '=' * 60)
    print('📊 Test Summary:')
    print('=' * 60)
    for test_name, success in results:
        status = '✅ PASSED' if success else '❌ FAILED'
        print(f'   {status}: {test_name}')
    
    all_passed = all(success for _, success in results)
    print()
    if all_passed:
        print('✨ All tests passed!')
        return True
    else:
        print('❌ Some tests failed')
        return False


if __name__ == '__main__':
    success = main()
    sys.exit(0 if success else 1)

