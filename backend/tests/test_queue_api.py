"""
Test script for workflow queue API endpoints.

Tests:
- POST /api/workflow/execute (enqueue workflow)
- GET /api/workflow/{queue_id}/status (poll status)
"""

import sys
import os
import time
import json

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Test imports
try:
    from workflow.queue import enqueue_workflow, get_execution_status
    print("✅ Queue imports OK")
except ImportError as e:
    print(f"❌ Import error: {e}")
    sys.exit(1)

# Mock workflow
test_workflow = {
    "nodes": [
        {
            "id": "text-1",
            "type": "textInput",
            "data": {
                "text": "Hello, world!"
            },
            "position": {"x": 0, "y": 0}
        },
        {
            "id": "python-1",
            "type": "python",
            "data": {
                "code": "output = data_input.upper()"
            },
            "position": {"x": 200, "y": 0}
        }
    ],
    "edges": [
        {
            "id": "e1",
            "source": "text-1",
            "target": "python-1",
            "sourceHandle": "output",
            "targetHandle": "input"
        }
    ]
}

def test_queue_direct():
    """Test queue directly (without Flask server)."""
    print("\n📋 Testing queue directly...")
    
    # Enqueue workflow
    queue_id = enqueue_workflow(test_workflow["nodes"], test_workflow["edges"])
    print(f"✅ Enqueued workflow: {queue_id}")
    
    # Poll status
    max_wait = 10  # seconds
    start_time = time.time()
    
    while time.time() - start_time < max_wait:
        status = get_execution_status(queue_id)
        
        if status:
            print(f"📊 Status: {status.status.value}")
            print(f"   Running: {status.running_node_ids}")
            print(f"   Completed: {status.completed_node_ids}")
            print(f"   Results: {len(status.results)} nodes")
            
            if status.status.value in ['completed', 'failed']:
                print(f"\n✅ Execution finished: {status.status.value}")
                if status.error:
                    print(f"   Error: {status.error}")
                print(f"   Results: {json.dumps(status.results, indent=2)}")
                return True
        
        time.sleep(0.5)
    
    print("❌ Timeout waiting for execution")
    return False

if __name__ == '__main__':
    print("🧪 Testing Workflow Queue API")
    print("=" * 50)
    
    success = test_queue_direct()
    
    if success:
        print("\n✅ All tests passed!")
        sys.exit(0)
    else:
        print("\n❌ Tests failed")
        sys.exit(1)

