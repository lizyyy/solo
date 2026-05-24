#!/bin/bash
BASE_URL="http://localhost:8080/api"

echo "=== 1. 创建许可申请 ==="
curl -s -X POST "$BASE_URL/permissions" \
  -H "Content-Type: application/json" \
  -d '{
    "operationType": "防虫作业",
    "plannedStartTime": "2026-05-25T09:00:00",
    "plannedEndTime": "2026-05-25T11:00:00",
    "pilot": {"id": 1},
    "drone": {"id": 1},
    "weatherWindow": {"id": 1}
  }' | python3 -m json.tool

echo ""
echo "=== 2. 查询许可列表 ==="
curl -s "$BASE_URL/permissions" | python3 -m json.tool
