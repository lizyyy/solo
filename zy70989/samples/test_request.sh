#!/bin/bash

BASE_URL="http://localhost:8000"

echo "=== 1. 健康检查 ==="
curl -s "$BASE_URL/" | python3 -m json.tool

echo -e "\n=== 2. 获取房源配置 ==="
curl -s "$BASE_URL/properties" | python3 -m json.tool

echo -e "\n=== 3. 上传对账材料（核心接口）==="
curl -s -X POST "$BASE_URL/api/reconcile/upload" \
  -F "batch_id=BATCH-TEST-001" \
  -F "meter_csv=@samples/meter_readings.csv" \
  -F "orders_json=@samples/orders.json" \
  -F "damage_json=@samples/damage_claims.json" \
  | python3 -m json.tool

echo -e "\n=== 4. 验证幂等性（重复提交同一批次）==="
curl -s -X POST "$BASE_URL/api/reconcile/upload" \
  -F "batch_id=BATCH-TEST-001" \
  -F "meter_csv=@samples/meter_readings.csv" \
  -F "orders_json=@samples/orders.json" \
  -F "damage_json=@samples/damage_claims.json" \
  | python3 -m json.tool

echo -e "\n=== 5. 查询所有批次 ==="
curl -s "$BASE_URL/api/batches" | python3 -m json.tool

echo -e "\n=== 6. 查询指定批次结果 ==="
curl -s "$BASE_URL/api/reconcile/BATCH-TEST-001" | python3 -m json.tool
