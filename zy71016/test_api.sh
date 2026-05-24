#!/bin/bash

BASE_URL="http://localhost:8080/api/v1"

echo "=== 城市除雪盐库 API 测试脚本 ==="
echo ""

echo "1. 健康检查"
curl -s http://localhost:8080/health | head -c 200
echo ""
echo ""

echo "2. 获取天气等级"
curl -s "$BASE_URL/weather-levels"
echo ""
echo ""

echo "3. 获取盐库列表"
curl -s "$BASE_URL/salt-depots"
echo ""
echo ""

echo "4. 获取路段列表"
curl -s "$BASE_URL/road-sections"
echo ""
echo ""

echo "5. 获取车辆列表"
curl -s "$BASE_URL/vehicles"
echo ""
echo ""

echo "6. 创建封路（模拟路段1封路）"
curl -s -X POST "$BASE_URL/road-closures" \
  -H "Content-Type: application/json" \
  -H "X-Operator: 调度员小王" \
  -d '{"road_section_id": 1, "reason": "路面塌陷维修"}'
echo ""
echo ""

echo "7. 创建调拨批次"
curl -s -X POST "$BASE_URL/dispatch/batches" \
  -H "Content-Type: application/json" \
  -H "X-Operator: 调度员小李" \
  -d '{
    "batch_no": "BATCH-20240115-001",
    "weather_level_id": 2,
    "created_by": "调度员小李",
    "items": [
      {"salt_depot_id": 1, "vehicle_id": 1, "road_section_id": 1, "salt_amount": 5},
      {"salt_depot_id": 1, "vehicle_id": 2, "road_section_id": 2, "salt_amount": 8},
      {"salt_depot_id": 2, "vehicle_id": 3, "road_section_id": 3, "salt_amount": 10}
    ]
  }'
echo ""
echo ""

echo "8. 重复提交同一批次（测试幂等性）"
curl -s -X POST "$BASE_URL/dispatch/batches" \
  -H "Content-Type: application/json" \
  -H "X-Operator: 调度员小李" \
  -d '{
    "batch_no": "BATCH-20240115-001",
    "weather_level_id": 2,
    "created_by": "调度员小李",
    "items": [
      {"salt_depot_id": 1, "vehicle_id": 1, "road_section_id": 1, "salt_amount": 5}
    ]
  }'
echo ""
echo ""

echo "9. 获取异常列表"
curl -s "$BASE_URL/anomalies"
echo ""
echo ""

echo "10. 获取批次列表"
curl -s "$BASE_URL/dispatch/batches"
echo ""
echo ""

echo "=== 测试完成 ==="
