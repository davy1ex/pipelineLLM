"""
Simple test for node_executors module
"""

from node_executors import execute_ollama_node, execute_python_node, execute_filewriter_node


def test_python_node():
    """Test Python node execution"""
    node = {
        'type': 'python',
        'widgets_values': [
            'output = data_input.upper()',
            ''
        ]
    }
    
    inputs = {'input': 'hello world'}
    
    result = execute_python_node(node, inputs)
    print("Python node result:", result)
    
    assert result['output'] == 'HELLO WORLD', f"Expected 'HELLO WORLD', got {result['output']}"
    assert result['error'] is None, f"Should not have error: {result.get('error')}"
    
    print("✅ Python node test passed!")


def test_python_node_with_empty_input():
    """Test Python node with empty input"""
    node = {
        'type': 'python',
        'widgets_values': [
            'output = "No input" if not data_input else data_input',
            ''
        ]
    }
    
    inputs = {'input': ''}
    
    result = execute_python_node(node, inputs)
    print("Python node (empty input) result:", result)
    
    assert result['output'] == 'No input', f"Expected 'No input', got {result['output']}"
    
    print("✅ Python node (empty input) test passed!")


def test_filewriter_node():
    """Test FileWriter node"""
    import os
    import tempfile
    
    node = {
        'type': 'fileWriter',
        'widgets_values': [
            'test_output.txt',
            None
        ]
    }
    
    inputs = {'input': 'Test content\nSecond line'}
    
    result = execute_filewriter_node(node, inputs)
    print("FileWriter node result:", result)
    
    assert result['fileId'] is not None, "Should have fileId"
    assert result['filename'] == 'test_output.txt', f"Expected 'test_output.txt', got {result['filename']}"
    assert result['size'] > 0, "File should have size > 0"
    assert result['error'] is None, f"Should not have error: {result.get('error')}"
    
    # Verify file exists
    base_dir = '/tmp/pipeline_files'
    file_path = os.path.join(base_dir, f"{result['fileId']}__{result['filename']}")
    assert os.path.exists(file_path), f"File should exist at {file_path}"
    
    # Verify content
    with open(file_path, 'r') as f:
        content = f.read()
        assert content == 'Test content\nSecond line', f"Content mismatch: {content}"
    
    print("✅ FileWriter node test passed!")


if __name__ == '__main__':
    test_python_node()
    test_python_node_with_empty_input()
    test_filewriter_node()
    print("\n✅ All tests passed!")

