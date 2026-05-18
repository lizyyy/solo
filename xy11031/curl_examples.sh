#!/bin/bash

BASE_URL="http://localhost:3001/api"

echo "========================================"
echo "家电安装队安装师傅抢单API - curl示例"
echo "========================================"
echo ""

echo "1. 健康检查"
echo "----------------------------------------"
curl -s "${BASE_URL}/health" | python3 -m json.tool
echo ""
echo ""

echo "2. 查看API根目录"
echo "----------------------------------------"
curl -s "${BASE_URL}" | python3 -m json.tool
echo ""
echo ""

echo "3. 导入正常订单数据(JSON)"
echo "----------------------------------------"
curl -s -X POST "${BASE_URL}/import/json" \
  -H "Content-Type: application/json" \
  -d @data/sample_orders.json | python3 -m json.tool
echo ""
echo ""

read -p "按回车键继续边界测试..."

echo ""
echo "4. 导入边界测试数据(含重复、时段重叠、缺字段等)"
echo "----------------------------------------"
curl -s -X POST "${BASE_URL}/import/json" \
  -H "Content-Type: application/json" \
  -d @data/boundary_test_orders.json | python3 -m json.tool
echo ""
echo ""

read -p "按回车键继续CSV导入测试..."

echo ""
echo "5. 导入CSV格式订单"
echo "----------------------------------------"
curl -s -X POST "${BASE_URL}/import/csv" \
  -F "file=@data/sample_orders.csv" | python3 -m json.tool
echo ""
echo ""

echo "6. 查看所有导入批次"
echo "----------------------------------------"
curl -s "${BASE_URL}/import/batches" | python3 -m json.tool
echo ""
echo ""

echo "7. 查看待人工审核的订单"
echo "----------------------------------------"
curl -s "${BASE_URL}/import/review/pending" | python3 -m json.tool
echo ""
echo ""

read -p "按回车键继续人工审核测试..."

echo ""
echo "8. 获取第一个待审核订单ID并进行人工审核通过"
echo "----------------------------------------"
FIRST_PENDING_ID=$(curl -s "${BASE_URL}/import/review/pending" | python3 -c "import sys,json; data=json.load(sys.stdin); print(data['data'][0]['id'] if data['data'] else 'NO_DATA')")

if [ "$FIRST_PENDING_ID" != "NO_DATA" ]; then
  echo "待审核订单ID: ${FIRST_PENDING_ID}"
  echo ""
  curl -s -X POST "${BASE_URL}/import/review/${FIRST_PENDING_ID}" \
    -H "Content-Type: application/json" \
    -d '{
      "action": "approve",
      "remark": "经核实，时段重叠但客户紧急，安排优先处理",
      "operator": "管理员-张经理"
    }' | python3 -m json.tool
else
  echo "没有待审核订单"
fi
echo ""
echo ""

echo "9. 查看所有订单列表"
echo "----------------------------------------"
curl -s "${BASE_URL}/import/orders" | python3 -m json.tool
echo ""
echo ""

echo "10. 测试状态越级变更(从pending直接到completed - 应该失败)"
echo "----------------------------------------"
FIRST_ORDER_ID=$(curl -s "${BASE_URL}/import/orders" | python3 -c "import sys,json; data=json.load(sys.stdin); print(data['data'][0]['id'] if data['data'] else 'NO_DATA')")

if [ "$FIRST_ORDER_ID" != "NO_DATA" ]; then
  echo "测试订单ID: ${FIRST_ORDER_ID}"
  echo ""
  curl -s -X PUT "${BASE_URL}/import/orders/${FIRST_ORDER_ID}/status" \
    -H "Content-Type: application/json" \
    -d '{"status": "completed"}' | python3 -m json.tool
else
  echo "没有订单"
fi
echo ""
echo ""

echo "11. 正常状态流转测试(pending -> locked)"
echo "----------------------------------------"
if [ "$FIRST_ORDER_ID" != "NO_DATA" ]; then
  curl -s -X PUT "${BASE_URL}/import/orders/${FIRST_ORDER_ID}/status" \
    -H "Content-Type: application/json" \
    -d '{"status": "locked"}' | python3 -m json.tool
else
  echo "没有订单"
fi
echo ""
echo ""

echo "========================================"
echo "测试完成！"
echo "========================================"
