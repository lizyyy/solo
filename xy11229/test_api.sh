#!/bin/bash

BASE_URL="http://localhost:8000/api/v1"

echo "=== 换电运营值班系统 API 测试 ==="
echo ""

echo "1. 检查服务状态"
curl -s http://localhost:8000/health
echo ""
echo ""

echo "2. 清除所有数据"
curl -s -X DELETE "$BASE_URL/clear-all"
echo ""
echo ""

echo "3. 导入设备事件 JSON"
curl -s -X POST "$BASE_URL/import/device-events" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@sample_data/device_events.json"
echo ""
echo ""

echo "4. 导入客服单 CSV"
curl -s -X POST "$BASE_URL/import/service-orders" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@sample_data/service_orders.csv"
echo ""
echo ""

echo "5. 查看所有客服单（敏感字段已脱敏）"
curl -s "$BASE_URL/orders"
echo ""
echo ""

echo "6. 接单 - 新订单"
curl -s -X POST "$BASE_URL/workflow/receive" \
  -H "Content-Type: application/json" \
  -d '{
    "order_id": "order_005",
    "station_id": "st_459",
    "problem_description": "设备无法启动",
    "report_time": "2024-01-15T14:00:00",
    "customer_name": "钱七",
    "customer_phone": "13500135000",
    "idempotency_key": "idemp_001"
  }'
echo ""
echo ""

echo "7. 接单 - 幂等性测试（重复提交）"
curl -s -X POST "$BASE_URL/workflow/receive" \
  -H "Content-Type: application/json" \
  -d '{
    "order_id": "order_005",
    "station_id": "st_459",
    "problem_description": "设备无法启动",
    "report_time": "2024-01-15T14:00:00",
    "customer_name": "钱七",
    "customer_phone": "13500135000",
    "idempotency_key": "idemp_001"
  }'
echo ""
echo ""

echo "8. 归因"
curl -s -X POST "$BASE_URL/workflow/attribute" \
  -H "Content-Type: application/json" \
  -d '{
    "order_id": "order_001",
    "attributed_type": "door_error",
    "attributed_reason": "柜门电机故障，需要更换电机"
  }'
echo ""
echo ""

echo "9. 派修"
curl -s -X POST "$BASE_URL/workflow/dispatch" \
  -H "Content-Type: application/json" \
  -d '{
    "order_id": "order_001",
    "technician_id": "tech_001",
    "technician_name": "王师傅",
    "technician_phone": "15900159000",
    "notes": "请携带备用电机"
  }'
echo ""
echo ""

echo "10. 复核"
curl -s -X POST "$BASE_URL/workflow/review" \
  -H "Content-Type: application/json" \
  -d '{
    "order_id": "order_001",
    "reviewer_id": "rev_001",
    "reviewer_name": "张主管",
    "review_result": "pass",
    "review_notes": "问题已解决，用户满意",
    "is_verified": true
  }'
echo ""
echo ""

echo "11. 查看订单详情"
curl -s "$BASE_URL/orders/order_001"
echo ""
echo ""

echo "12. 导出数据（JSON格式）"
curl -s -X POST "$BASE_URL/workflow/export" \
  -H "Content-Type: application/json" \
  -d '{"format": "json"}'
echo ""
echo ""

echo "13. 查看统计数据"
curl -s "$BASE_URL/stats"
echo ""
echo ""

echo "14. 查看坏记录"
curl -s "$BASE_URL/bad-records"
echo ""
echo ""

echo "=== 测试完成 ==="
