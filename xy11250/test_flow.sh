#!/bin/bash

echo "=== 团长运营对账系统 - 完整测试流程 ==="
echo ""

BASE_URL="http://localhost:8000"

echo "1. 生成测试数据..."
python3 generate_test_data.py
echo ""

echo "2. 导入订单CSV..."
ORDER_RESULT=$(curl -s -X POST "$BASE_URL/api/import/orders" -F "file=@test_orders.csv")
echo "$ORDER_RESULT"
ORDER_BATCH=$(echo "$ORDER_RESULT" | python3 -c "import sys, json; print(json.load(sys.stdin)['batch_id'])")
echo "订单批次ID: $ORDER_BATCH"
echo ""

echo "3. 导入缺货清单Excel..."
STOCK_RESULT=$(curl -s -X POST "$BASE_URL/api/import/out-of-stock" -F "file=@test_stock.xlsx")
echo "$STOCK_RESULT"
STOCK_BATCH=$(echo "$STOCK_RESULT" | python3 -c "import sys, json; print(json.load(sys.stdin)['batch_id'])")
echo "缺货批次ID: $STOCK_BATCH"
echo ""

echo "4. 导入补偿规则JSON..."
RULES_RESULT=$(curl -s -X POST "$BASE_URL/api/import/rules" -F "file=@test_rules.json")
echo "$RULES_RESULT"
RULES_BATCH=$(echo "$RULES_RESULT" | python3 -c "import sys, json; print(json.load(sys.stdin)['batch_id'])")
echo "规则批次ID: $RULES_BATCH"
echo ""

echo "5. 执行对账处理..."
RECON_RESULT=$(curl -s -X POST "$BASE_URL/api/reconciliation/process/$ORDER_BATCH")
echo "$RECON_RESULT"
echo ""

echo "6. 查询对账结果..."
curl -s "$BASE_URL/api/results/$ORDER_BATCH" | python3 -m json.tool
echo ""

echo "7. 查询导入错误..."
echo "订单导入错误:"
curl -s "$BASE_URL/api/errors/$ORDER_BATCH" | python3 -m json.tool
echo ""
echo "缺货导入错误:"
curl -s "$BASE_URL/api/errors/$STOCK_BATCH" | python3 -m json.tool
echo ""

echo "8. 查询所有历史批次..."
curl -s "$BASE_URL/api/batches" | python3 -m json.tool
echo ""

echo "9. 导出对账结果..."
curl -s "$BASE_URL/api/export/$ORDER_BATCH" | python3 -m json.tool
echo ""

echo "=== 测试流程完成 ==="
echo "注意: 敏感字段(手机号、用户ID)已在存储、返回、导出时脱敏处理"
echo "重启服务后仍可通过 /api/batches 查询历史记录"
