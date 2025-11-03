#!/usr/bin/env python3
"""
Standalone test script - runs execution engine directly without server.

Usage:
    python test_workflow_standalone.py [workflow_file.json]
"""

import json
import sys
from pathlib import Path
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from workflow.execution_engine import ExecutionEngine


def test_workflow(workflow_file: str):
    """Test workflow execution directly."""
    # Read workflow JSON
    with open(workflow_file, 'r') as f:
        workflow = json.load(f)
    
    print(f'📄 Testing workflow from: {workflow_file}')
    print(f'   Nodes: {len(workflow["nodes"])}')
    print(f'   Edges: {len(workflow["edges"])}')
    print()
    
    try:
        # Create execution engine
        print('🔧 Creating execution engine...')
        engine = ExecutionEngine(workflow['nodes'], workflow['edges'])
        
        # Execute
        print('🚀 Executing workflow...')
        result = engine.execute(max_iterations=10)
        
        print()
        print('✅ Execution completed!')
        print(f'   Iterations: {result.get("iterations", 0)}')
        print(f'   Results: {len(result.get("results", {}))} nodes executed')
        print()
        
        # Print execution log
        if result.get('executionLog'):
            print('📋 Execution Log:')
            for log_entry in result['executionLog']:
                print(f'   {log_entry}')
            print()
        
        # Print node results
        print('📊 Node Results:')
        has_errors = False
        for node_id, node_result in result.get('results', {}).items():
            output = node_result.get('output', '')
            error = node_result.get('error')
            
            if error:
                print(f'   ❌ {node_id}: ERROR - {error}')
                has_errors = True
            else:
                output_preview = output[:100] + '...' if len(output) > 100 else output
                print(f'   ✅ {node_id}: {len(output)} chars')
                if output_preview:
                    print(f'      "{output_preview}"')
        
        print()
        
        if has_errors:
            print('⚠️  Some nodes failed. Check results above.')
            return False
        else:
            print('✨ All nodes executed successfully!')
            return True
            
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

