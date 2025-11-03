#!/bin/bash
# Simple curl test for workflow API

echo "Testing workflow execution API with curl..."
echo ""

# Test with simple workflow
FIXTURES_DIR="$(dirname "$0")/fixtures"
response=$(curl -s -X POST http://localhost:5000/api/workflow/execute \
  -H "Content-Type: application/json" \
  -d @"$FIXTURES_DIR/test_workflow_simple.json")

# Check if jq is available
if command -v jq &> /dev/null; then
  echo "$response" | jq '.'
else
  echo "$response" | python3 -m json.tool 2>/dev/null || echo "$response"
fi

echo ""
echo "Done!"

