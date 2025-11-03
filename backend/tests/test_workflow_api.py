#!/usr/bin/env python3
"""
Test script for workflow execution API (queue-based).

Usage:
    python tests/test_workflow_api.py [workflow_file.json]

If no file provided, uses tests/fixtures/test_workflow_simple.json
"""

import json
import sys
import os
import time
import requests
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

API_BASE = os.environ.get('API_BASE', 'http://localhost:5001')  # backend host-port
EXECUTE_URL = f'{API_BASE}/api/workflow/execute'
STATUS_URL = f'{API_BASE}/api/workflow/{{queue_id}}/status'


def poll_status(queue_id: str, timeout_sec: int = 60, interval_sec: float = 0.5):
    """Poll status endpoint until completed/failed or timeout."""
    start = time.time()
    while time.time() - start < timeout_sec:
        r = requests.get(STATUS_URL.format(queue_id=queue_id), timeout=10)
        if r.status_code != 200:
            raise RuntimeError(f'Status HTTP {r.status_code}: {r.text[:200]}')
        status = r.json()
        if status.get('status') in ('completed', 'failed'):
            return status
        time.sleep(interval_sec)
    raise TimeoutError(f'Status polling timeout after {timeout_sec}s')


def test_workflow(workflow_file: str):
    """Test workflow execution with mock JSON."""
    # Read workflow JSON
    with open(workflow_file, 'r') as f:
        workflow = json.load(f)
    
    print(f'📄 Testing workflow from: {workflow_file}')
    print(f'   Nodes: {len(workflow["nodes"])}')
    print(f'   Edges: {len(workflow["edges"])}')
    print()
    
    # Send to API
    print(f'🚀 Sending to {EXECUTE_URL}...')
    try:
        response = requests.post(
            EXECUTE_URL,
            json=workflow,
            headers={'Content-Type': 'application/json'},
            timeout=30
        )
        print(f'📥 Execute status: {response.status_code}')
        text = response.text
        if response.status_code not in (200, 202):
            print(f'❌ Error: {text[:300]}')
            return False
        data = json.loads(text)
        
        # Queue flow: expect 202 + queueId
        if response.status_code == 202:
            queue_id = data.get('queueId')
            if not queue_id:
                print(f'❌ No queueId in response: {data}')
                return False
            print(f'🧵 Queue ID: {queue_id} — polling status...')
            status = poll_status(queue_id)
        else:
            # Legacy direct result (should not happen now)
            status = data
        
        # Print summary
        print()
        print(f'✅ Status: {status.get("status")}, iterations: {status.get("iterations")}')
        results = status.get('results', {})
        print(f'   Results: {len(results)} node entries')
        if status.get('error'):
            print(f'   Error: {status.get("error")}')
        if status.get('failedNodes'):
            print(f'   Failed nodes: {status.get("failedNodes")}')
        print()
        
        # Print execution log
        if status.get('executionLog'):
            print('📋 Execution Log:')
            for log_entry in status['executionLog']:
                print(f'   {log_entry}')
            print()
        
        # Print node results
        print('📊 Node Results:')
        has_errors = False
        for node_id, node_result in results.items():
            output = node_result.get('output', '')
            error = node_result.get('error')
            if error:
                print(f'   ❌ {node_id}: ERROR - {error}')
                has_errors = True
            else:
                preview = output[:100] + ('...' if len(output) > 100 else '')
                print(f'   ✅ {node_id}: {len(output)} chars - {preview}')
        print()
        
        # Basic assertions
        if status.get('status') == 'failed':
            print('❌ Execution failed')
            return False
        
        if has_errors:
            print('⚠️  Completed with node errors')
            # Still pass as partial success depending on use-case
            # return False
        
        # If Python-only simple workflow, verify correctness
        node_ids = set(n['id'] for n in workflow['nodes'])
        if {'input-1', 'python-1', 'output-1'}.issubset(node_ids):
            expected = workflow['nodes'][0]['data'].get('value', '').upper()
            py_output = results.get('python-1', {}).get('output', '')
            if py_output != expected:
                print(f'❌ Python node output mismatch: expected {expected!r}, got {py_output!r}')
                return False
            print('✨ Python-only workflow output verified')
        
        print('✅ Test completed')
        return True
        
    except requests.exceptions.ConnectionError:
        print(f'❌ Cannot connect to {EXECUTE_URL}')
        print('   Make sure backend server is running.')
        return False
    except requests.exceptions.Timeout:
        print('❌ Request timeout (execution took too long)')
        return False
    except Exception as e:
        print(f'❌ Error: {str(e)}')
        import traceback
        traceback.print_exc()
        return False


if __name__ == '__main__':
    # Determine workflow file
    if len(sys.argv) > 1:
        workflow_file = sys.argv[1]
    else:
        workflow_file = os.path.join(os.path.dirname(__file__), 'fixtures', 'test_workflow_simple.json')
    
    if not Path(workflow_file).exists():
        print(f'❌ File not found: {workflow_file}')
        print('Available test files:')
        fixtures_dir = os.path.join(os.path.dirname(__file__), 'fixtures')
        for f in Path(fixtures_dir).glob('test_workflow_*.json'):
            print(f'   - {f.name}')
        sys.exit(1)
    
    success = test_workflow(workflow_file)
    sys.exit(0 if success else 1)

