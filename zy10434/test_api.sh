#!/bin/bash

BASE_URL="http://localhost:8080/api/v1"

echo "=== Testing Export Quota API ==="
echo ""

echo "1. Health Check"
curl -s "$BASE_URL/health" | jq .
echo ""

echo "2. Seed Sample Data"
curl -s -X POST "$BASE_URL/seed" | jq .
echo ""

TENANT_ID=$(curl -s "$BASE_URL/tenants" | jq -r '.[0].id')
echo "Tenant ID: $TENANT_ID"
echo ""

echo "3. Get Tenant Status"
curl -s "$BASE_URL/tenants/$TENANT_ID/status" | jq .
echo ""

echo "4. Create a New Task"
curl -s -X POST "$BASE_URL/tasks" \
  -H "Content-Type: application/json" \
  -d "{
    \"tenant_id\": \"$TENANT_ID\",
    \"file_name\": \"new_export.csv\",
    \"file_size\": 15728640,
    \"file_type\": \"csv\",
    \"priority\": 2
  }" | jq .
echo ""

echo "5. List All Tasks for Tenant"
curl -s "$BASE_URL/tenants/$TENANT_ID/tasks" | jq .
echo ""

echo "6. Process Next Tasks (Start Execution)"
curl -s -X POST "$BASE_URL/tenants/$TENANT_ID/process-tasks" | jq .
echo ""

FIRST_TASK_ID=$(curl -s "$BASE_URL/tenants/$TENANT_ID/tasks?status=running" | jq -r '.[0].id')
echo "Running Task ID: $FIRST_TASK_ID"
echo ""

echo "7. Complete a Task"
curl -s -X POST "$BASE_URL/tasks/$FIRST_TASK_ID/complete" \
  -H "Content-Type: application/json" \
  -d "{\"download_url\": \"https://example.com/downloads/$FIRST_TASK_ID.csv\"}" | jq .
echo ""

echo "8. Get Task Details with History"
curl -s "$BASE_URL/tasks/$FIRST_TASK_ID" | jq .
echo ""

echo "9. Process More Tasks"
curl -s -X POST "$BASE_URL/tenants/$TENANT_ID/process-tasks" | jq .
echo ""

SECOND_TASK_ID=$(curl -s "$BASE_URL/tenants/$TENANT_ID/tasks?status=running" | jq -r '.[0].id')
echo ""

echo "10. Fail a Task"
curl -s -X POST "$BASE_URL/tasks/$SECOND_TASK_ID/fail" \
  -H "Content-Type: application/json" \
  -d "{\"reason\": \"Database connection timeout\"}" | jq .
echo ""

echo "11. Retry a Failed Task"
curl -s -X POST "$BASE_URL/tasks/$SECOND_TASK_ID/retry" \
  -H "Content-Type: application/json" \
  -d "{\"operator\": \"admin@example.com\"}" | jq .
echo ""

echo "12. Manually Adjust Quota"
curl -s -X POST "$BASE_URL/tenants/$TENANT_ID/adjust-quota" \
  -H "Content-Type: application/json" \
  -d "{\"additional_size\": 1073741824, \"operator\": \"admin@example.com\"}" | jq .
echo ""

echo "13. Get Updated Tenant Status"
curl -s "$BASE_URL/tenants/$TENANT_ID/status" | jq .
echo ""

echo "14. Test Quota Exceeded Scenario"
curl -s -X POST "$BASE_URL/tasks" \
  -H "Content-Type: application/json" \
  -d "{
    \"tenant_id\": \"$TENANT_ID\",
    \"file_name\": \"huge_file.csv\",
    \"file_size\": 10737418240,
    \"file_type\": \"csv\",
    \"priority\": 1
  }" | jq .
echo ""

echo "15. Export Tasks to CSV (check browser or curl output)"
echo "curl -O \"$BASE_URL/tenants/$TENANT_ID/export-csv\""
echo ""

echo "=== Test Complete ==="
