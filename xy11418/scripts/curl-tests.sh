#!/bin/bash

BASE_URL="http://localhost:3000/api/v1"

echo "========================================"
echo "物业维修派单验收回放链路服务 - 测试脚本"
echo "========================================"
echo ""

echo "【1/8】健康检查"
curl -s "http://localhost:3000/health" | python3 -m json.tool
echo ""
echo "----------------------------------------"

echo "【2/8】创建报修单 - 正常数据"
curl -s -X POST "$BASE_URL/orders" \
  -H "Content-Type: application/json" \
  -d '{
    "resident_id": "R100",
    "resident_name": "测试用户",
    "room_no": "5栋203室",
    "repair_type": "水电维修",
    "description": "水管漏水需要维修",
    "screenshot_url": "/test/screenshot.jpg",
    "report_time": "2024-01-15T10:30:00.000Z",
    "operator": "test_user"
  }' | python3 -m json.tool
echo ""
echo "----------------------------------------"

echo "【3/8】创建报修单 - 脏数据(缺少字段)"
curl -s -X POST "$BASE_URL/orders" \
  -H "Content-Type: application/json" \
  -d '{
    "resident_id": "R101",
    "report_time": "2024-01-16T14:00:00.000Z",
    "operator": "test_user"
  }' | python3 -m json.tool
echo ""
echo "----------------------------------------"

echo "【4/8】查询报修单列表"
curl -s "$BASE_URL/orders?limit=5" | python3 -m json.tool
echo ""
echo "----------------------------------------"

echo "【5/8】查询脏记录列表"
curl -s "$BASE_URL/dirty-records?limit=10" | python3 -m json.tool
echo ""
echo "----------------------------------------"

echo "【6/8】导出全部汇总"
curl -s "$BASE_URL/export/summary" | python3 -m json.tool
echo ""
echo "----------------------------------------"

echo "【7/8】导出脏记录"
curl -s "$BASE_URL/export/dirty-records" | python3 -m json.tool
echo ""
echo "----------------------------------------"

echo "【8/8】查询审计日志"
curl -s "$BASE_URL/audit-logs?limit=5" | python3 -m json.tool
echo ""
echo "========================================"
echo "基础测试完成！"
echo "========================================"
