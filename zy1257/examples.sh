#!/bin/bash

BASE_URL="http://localhost:8000/api/v1"

echo "=== Redis Cluster Drill Platform API Examples ==="
echo ""

echo "1. Health Check"
curl -s "${BASE_URL%/api/v1}/health" | python3 -m json.tool
echo ""

echo "2. Import Nodes YAML"
curl -s -X POST -F "file=@data/nodes.yaml" "$BASE_URL/import/nodes-yaml" | python3 -m json.tool
echo ""

echo "3. Import Slot Events JSONL"
curl -s -X POST -F "file=@data/slot-events.jsonl" "$BASE_URL/import/slot-events-jsonl" | python3 -m json.tool
echo ""

echo "4. Import Requests JSONL"
curl -s -X POST -F "file=@data/requests.jsonl" "$BASE_URL/import/requests-jsonl" | python3 -m json.tool
echo ""

echo "5. Get Cluster Stats"
curl -s "$BASE_URL/cluster/stats" | python3 -m json.tool
echo ""

echo "6. List Nodes"
curl -s "$BASE_URL/cluster/nodes" | python3 -m json.tool
echo ""

echo "7. List Slots (migrating only)"
curl -s "$BASE_URL/cluster/slots?migrating_only=true" | python3 -m json.tool
echo ""

echo "8. Get Slot for Key 'user:1000'"
curl -s "$BASE_URL/cluster/slots/key/user%3A1000" | python3 -m json.tool
echo ""

echo "9. List Requests (limit 10)"
curl -s "$BASE_URL/cluster/requests?limit=10" | python3 -m json.tool
echo ""

echo "10. Create Drill Task (Basic Scenario)"
curl -s -X POST -H "Content-Type: application/json" -d '{
    "task_name": "Basic Slot Migration Scenario",
    "description": "Test basic MOVED/ASK redirect handling",
    "enable_moved_redirect": true,
    "enable_ask_redirect": true,
    "enable_read_write_routing": true,
    "enable_replication_lag": false,
    "enable_sentinel_failover": false,
    "enable_client_retry": true,
    "enable_lua_transaction_failure": false,
    "replication_lag_ms": 0,
    "max_retries": 3,
    "seed": 42
}' "$BASE_URL/drills/" | python3 -m json.tool
echo ""

echo "11. Create Drill Task (Advanced Scenario)"
curl -s -X POST -H "Content-Type: application/json" -d '{
    "task_name": "Advanced Failover & Lag Scenario",
    "description": "Test with replication lag and sentinel failover",
    "enable_moved_redirect": true,
    "enable_ask_redirect": true,
    "enable_read_write_routing": true,
    "enable_replication_lag": true,
    "enable_sentinel_failover": true,
    "enable_client_retry": true,
    "enable_lua_transaction_failure": true,
    "replication_lag_ms": 500,
    "max_retries": 5,
    "seed": 12345
}' "$BASE_URL/drills/" | python3 -m json.tool
echo ""

echo "12. List All Drill Tasks"
curl -s "$BASE_URL/drills/" | python3 -m json.tool
echo ""

echo "13. Run Drill Task (task_id=1)"
echo "Note: This runs asynchronously"
curl -s -X POST "$BASE_URL/drills/1/run" | python3 -m json.tool
echo ""

echo "14. Wait and check task status"
sleep 2
curl -s "$BASE_URL/drills/1" | python3 -m json.tool
echo ""

echo "15. Get Task Results (task_id=1)"
curl -s "$BASE_URL/drills/1/results?limit=20" | python3 -m json.tool
echo ""

echo "16. Analyze Risks (task_id=1)"
curl -s "$BASE_URL/analysis/risks/1" | python3 -m json.tool
echo ""

echo "17. Compare Tasks (task_ids=1,2)"
curl -s -X POST "$BASE_URL/analysis/compare?task_ids=1&task_ids=2" | python3 -m json.tool
echo ""

echo "18. Export JSON Report (task_id=1)"
curl -s -o "report_task_1.json" "$BASE_URL/analysis/report/1/json"
echo "Saved to report_task_1.json"
echo ""

echo "19. Export Markdown Report (task_id=1)"
curl -s -o "report_task_1.md" "$BASE_URL/analysis/report/1/markdown"
echo "Saved to report_task_1.md"
echo ""

echo "20. Clear All Data"
echo "Warning: This will delete all imported data"
# curl -s -X POST "$BASE_URL/import/clear" | python3 -m json.tool
echo "Skipped (uncomment to run)"
echo ""

echo "=== Done ==="
echo ""
echo "API Documentation: http://localhost:8000/docs"
echo "OpenAPI Schema: http://localhost:8000/openapi.json"
