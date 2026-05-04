#!/bin/bash

BASE_URL="http://localhost:8080"

echo "=========================================="
echo "换电柜值班员系统 - API 示例"
echo "=========================================="
echo ""

echo "1. 健康检查"
echo "------------------------------------------"
curl -s "$BASE_URL/" | python3 -m json.tool
echo ""

echo "2. 导入柜门传感器日志"
echo "------------------------------------------"
curl -s -X POST "$BASE_URL/api/logs/door-sensor" \
  -H "Content-Type: application/json" \
  -d @data/door_sensor_logs.json | python3 -m json.tool
echo ""

echo "3. 导入温度曲线日志"
echo "------------------------------------------"
curl -s -X POST "$BASE_URL/api/logs/temperature" \
  -H "Content-Type: application/json" \
  -d @data/temperature_logs.json | python3 -m json.tool
echo ""

echo "4. 导入换电记录"
echo "------------------------------------------"
curl -s -X POST "$BASE_URL/api/logs/swap-records" \
  -H "Content-Type: application/json" \
  -d @data/swap_records.json | python3 -m json.tool
echo ""

echo "5. 导入维修工单"
echo "------------------------------------------"
curl -s -X POST "$BASE_URL/api/logs/maintenance" \
  -H "Content-Type: application/json" \
  -d @data/maintenance_orders.json | python3 -m json.tool
echo ""

echo "6. 触发争议检测"
echo "------------------------------------------"
curl -s -X POST "$BASE_URL/api/disputes/detect" \
  -H "Content-Type: application/json" \
  -d '{}' | python3 -m json.tool
echo ""

echo "7. 获取电池列表"
echo "------------------------------------------"
curl -s "$BASE_URL/api/batteries" | python3 -m json.tool
echo ""

echo "8. 获取柜门列表"
echo "------------------------------------------"
curl -s "$BASE_URL/api/doors" | python3 -m json.tool
echo ""

echo "9. 获取换电记录"
echo "------------------------------------------"
curl -s "$BASE_URL/api/swaps" | python3 -m json.tool
echo ""

echo "10. 获取争议列表"
echo "------------------------------------------"
curl -s "$BASE_URL/api/disputes" | python3 -m json.tool
echo ""

echo "11. 复核争议 (示例: 确认第一条争议)"
echo "------------------------------------------"
DISPUTE_ID=1
curl -s -X PUT "$BASE_URL/api/disputes/$DISPUTE_ID/review" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "confirmed",
    "reviewer_id": "operator-001",
    "review_comment": "经核查，该争议属实，电池确实错放，需要联系用户归还至正确位置。"
  }' | python3 -m json.tool
echo ""

echo "12. 复核争议 (示例: 驳回另一条争议)"
echo "------------------------------------------"
DISPUTE_ID=2
curl -s -X PUT "$BASE_URL/api/disputes/$DISPUTE_ID/review" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "rejected",
    "reviewer_id": "operator-001",
    "review_comment": "经核查，该争议不属实，温度传感器读数异常已修复，电池实际温度正常。"
  }' | python3 -m json.tool
echo ""

echo "13. 导出客服仲裁 Markdown (日期: 2026-05-04)"
echo "------------------------------------------"
curl -s -o "arbitration_2026-05-04.md" \
  "$BASE_URL/api/export/arbitration/2026-05-04"
echo "已保存至: arbitration_2026-05-04.md"
echo ""

echo "14. 导出审计 JSON (日期: 2026-05-04)"
echo "------------------------------------------"
curl -s -o "audit_2026-05-04.json" \
  "$BASE_URL/api/export/audit/2026-05-04"
echo "已保存至: audit_2026-05-04.json"
echo ""

echo "=========================================="
echo "所有示例执行完成！"
echo "=========================================="
