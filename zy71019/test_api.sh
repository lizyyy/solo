#!/bin/bash

BASE_URL="http://localhost:8080/api/v1"

echo "=== 测试健康检查 ==="
curl -s http://localhost:8080/health | jq .

echo ""
echo "=== 1. 创建仲裁记录 ==="
curl -s -X POST "$BASE_URL/arbitration" \
  -H "Content-Type: application/json" \
  -d '{
    "order_id": "ORDER20240101001",
    "vehicle_id": "VEH001",
    "user_id": "USER001",
    "pickup_time": "2024-01-01T10:00:00Z",
    "return_time": "2024-01-02T18:00:00Z",
    "pickup_photos": [
      {"photo_url": "http://example.com/p1.jpg", "photo_time": "2024-01-01T10:00:00Z", "remark": "左前门取车照"}
    ],
    "return_photos": [
      {"photo_url": "http://example.com/r1.jpg", "photo_time": "2024-01-02T18:00:00Z", "remark": "左前门还车照"}
    ],
    "damages": [
      {"damage_type": "scratch", "location": "左前门", "severity": "minor", "description": "长约10cm刮痕", "deduct_amount": 200, "photo_urls": ["http://example.com/d1.jpg"]}
    ],
    "operator_id": "OP001",
    "operator_name": "张三"
  }' | jq .

echo ""
echo "=== 2. 查询仲裁列表 ==="
curl -s "$BASE_URL/arbitration?page=1&page_size=10" | jq .

echo ""
echo "=== 3. 查询详情 ==="
curl -s "$BASE_URL/arbitration/1" | jq '.data.arbitration'

echo ""
echo "=== 4. 拦截仲裁 ==="
curl -s -X POST "$BASE_URL/arbitration/block" \
  -H "Content-Type: application/json" \
  -d '{
    "arbitration_id": 1,
    "operator_id": "OP002",
    "operator_name": "李四",
    "reason": "需要核实照片真实性"
  }' | jq .

echo ""
echo "=== 5. 放行仲裁 ==="
curl -s -X POST "$BASE_URL/arbitration/release" \
  -H "Content-Type: application/json" \
  -d '{
    "arbitration_id": 1,
    "operator_id": "OP002",
    "operator_name": "李四",
    "reason": "照片核实无误"
  }' | jq .

echo ""
echo "=== 6. 补录信息 ==="
curl -s -X POST "$BASE_URL/arbitration/supplement" \
  -H "Content-Type: application/json" \
  -d '{
    "arbitration_id": 1,
    "operator_id": "OP001",
    "operator_name": "张三",
    "damages": [
      {"damage_type": "dent", "location": "右后视镜", "severity": "minor", "deduct_amount": 100}
    ],
    "remark": "补录右后视镜凹陷"
  }' | jq .

echo ""
echo "=== 7. 用户提交申诉 ==="
curl -s -X POST "$BASE_URL/appeal/submit" \
  -H "Content-Type: application/json" \
  -d '{
    "arbitration_id": 1,
    "user_id": "USER001",
    "content": "该刮伤取车时已有，不是我造成的",
    "evidence_urls": ["http://example.com/evidence1.jpg"]
  }' | jq .

echo ""
echo "=== 8. 处理申诉 ==="
curl -s -X POST "$BASE_URL/appeal/handle" \
  -H "Content-Type: application/json" \
  -d '{
    "arbitration_id": 1,
    "handler_id": "OP003",
    "handler_name": "王五",
    "handler_remark": "申诉属实，取车照片显示已有划痕",
    "approve": true,
    "refund_amount": 200
  }' | jq .

echo ""
echo "=== 9. 结案 ==="
curl -s -X POST "$BASE_URL/arbitration/close" \
  -H "Content-Type: application/json" \
  -d '{
    "arbitration_id": 1,
    "handler_id": "OP003",
    "handler_name": "王五",
    "final_result": "申诉通过，全额退款",
    "final_remark": "取车照片已显示损伤，非用户责任",
    "refund_amount": 200
  }' | jq .

echo ""
echo "=== 10. 查看最终详情 ==="
curl -s "$BASE_URL/arbitration/1" | jq '{
  status: .data.arbitration.status,
  damages_count: (.data.damages | length),
  has_appeal: (.data.appeal != null),
  logs_count: (.data.logs | length),
  conclusion: .data.conclusion
}'

echo ""
echo "=== 11. 导出CSV ==="
curl -s "$BASE_URL/export/csv?status=closed" -o /tmp/arbitrations.csv && cat /tmp/arbitrations.csv

echo ""
echo "=== 测试完成 ==="
