"""
Simple test for workflow_order module
"""

from workflow_order import compute_execution_order, update_workflow_order, get_execution_sequence


def test_simple_chain():
    """Test simple chain: textInput -> python -> ollama -> output"""
    workflow = {
        "version": 1,
        "state": {"lastNodeId": 4, "lastLinkId": 3},
        "nodes": [
            {
                "id": 1,
                "type": "textInput",
                "order": 0,
                "mode": 0,
                "inputs": [],
                "outputs": [{"name": "output", "type": "string", "links": [1]}],
                "widgets_values": ["Hello"]
            },
            {
                "id": 2,
                "type": "python",
                "order": 0,
                "mode": 0,
                "inputs": [{"name": "input", "type": "string", "link": 1}],
                "outputs": [{"name": "output", "type": "string", "links": [2]}],
                "widgets_values": ["output = data_input", ""]
            },
            {
                "id": 3,
                "type": "ollama",
                "order": 0,
                "mode": 0,
                "inputs": [{"name": "prompt", "type": "string", "link": 2}],
                "outputs": [{"name": "output", "type": "string", "links": [3]}],
                "widgets_values": ["llama3.2", 0.7, "", ""]
            },
            {
                "id": 4,
                "type": "output",
                "order": 0,
                "mode": 0,
                "inputs": [{"name": "text", "type": "string", "link": 3}],
                "outputs": []
            }
        ],
        "links": [
            [1, 1, 0, 2, 0, "string"],  # textInput -> python
            [2, 2, 0, 3, 0, "string"],  # python -> ollama
            [3, 3, 0, 4, 0, "string"]   # ollama -> output
        ]
    }
    
    order_map = compute_execution_order(workflow)
    print("Order map:", order_map)
    
    assert order_map[2] == 0, "Python should execute first (order 0)"
    assert order_map[3] == 1, "Ollama should execute second (order 1)"
    assert 1 not in order_map, "textInput should not be in order map (not executable)"
    assert 4 not in order_map, "output should not be in order map (not executable)"
    
    updated = update_workflow_order(workflow)
    sequence = get_execution_sequence(updated)
    
    print("Execution sequence:")
    for node in sequence:
        print(f"  Order {node['order']}: Node {node['id']} ({node['type']})")
    
    assert len(sequence) == 2, "Should have 2 executable nodes"
    assert sequence[0]['id'] == 2, "Python should be first"
    assert sequence[1]['id'] == 3, "Ollama should be second"
    
    print("✅ Test passed!")


if __name__ == '__main__':
    test_simple_chain()

