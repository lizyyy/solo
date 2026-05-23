#!/bin/bash

BASE_URL="http://localhost:3000/api/v1"
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo "========================================"
echo "  新能源对账服务 - 完整测试流程脚本"
echo "========================================"
echo ""

echo "[1/8] 检查服务是否启动..."
if curl -s "$BASE_URL/health" > /dev/null 2>&1; then
    echo "      ✓ 服务运行正常"
else
    echo "      ✗ 服务未启动，请先启动服务: npm start"
    exit 1
fi
echo ""

echo "[2/8] 导入订单CSV文件..."
ORDER_RESULT=$(curl -s -X POST "$BASE_URL/import/orders/csv" \
  -F "file=@$SCRIPT_DIR/sample-orders.csv")
ORDER_SUCCESS=$(echo $ORDER_RESULT | grep -o '"successCount":[0-9]*' | grep -o '[0-9]*')
echo "      ✓ 成功导入 $ORDER_SUCCESS 条订单记录"
echo ""

echo "[3/8] 导入桩端日志JSON文件..."
CHARGER_RESULT=$(curl -s -X POST "$BASE_URL/import/charger-logs/json" \
  -F "file=@$SCRIPT_DIR/sample-charger-logs.json")
CHARGER_SUCCESS=$(echo $CHARGER_RESULT | grep -o '"successCount":[0-9]*' | grep -o '[0-9]*')
echo "      ✓ 成功导入 $CHARGER_SUCCESS 条桩端日志"
echo ""

echo "[4/8] 导入支付记录CSV文件..."
PAYMENT_RESULT=$(curl -s -X POST "$BASE_URL/import/payment-records" \
  -F "file=@$SCRIPT_DIR/sample-payments.csv")
PAYMENT_SUCCESS=$(echo $PAYMENT_RESULT | grep -o '"successCount":[0-9]*' | grep -o '[0-9]*')
echo "      ✓ 成功导入 $PAYMENT_SUCCESS 条支付记录"
echo ""

echo "[5/8] 创建对账任务..."
TASK_RESULT=$(curl -s -X POST "$BASE_URL/reconciliation/tasks" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "2024年1月对账测试",
    "startDate": "2024-01-01",
    "endDate": "2024-01-31"
  }')
TASK_ID=$(echo $TASK_RESULT | grep -o '"taskId":"[^"]*"' | cut -d'"' -f4)
echo "      ✓ 创建对账任务成功: $TASK_ID"
echo ""

echo "[6/8] 执行对账任务..."
EXEC_RESULT=$(curl -s -X POST "$BASE_URL/reconciliation/tasks/$TASK_ID/execute")
DETECTED=$(echo $EXEC_RESULT | grep -o '"discrepanciesDetected":[0-9]*' | grep -o '[0-9]*')
echo "      ✓ 对账完成，检测到 $DETECTED 条差异记录"
echo ""

echo "[7/8] 获取差异列表..."
DISCREPANCIES=$(curl -s "$BASE_URL/discrepancies?taskId=$TASK_ID")
DISCR_COUNT=$(echo $DISCREPANCIES | grep -o '"discrepancy_id"' | wc -l)
echo "      ✓ 共 $DISCR_COUNT 条差异记录"
echo ""

echo "[8/8] 生成对账报告..."
REPORT_RESULT=$(curl -s -X POST "$BASE_URL/reports/$TASK_ID/generate" \
  -H "Content-Type: application/json" \
  -d '{"format": "excel"}')
REPORT_ID=$(echo $REPORT_RESULT | grep -o '"reportId":"[^"]*"' | cut -d'"' -f4)
echo "      ✓ 报告生成成功: $REPORT_ID"
echo ""

echo "========================================"
echo "  测试流程完成！"
echo "========================================"
echo ""
echo "任务ID: $TASK_ID"
echo "报告ID: $REPORT_ID"
echo "差异数量: $DISCR_COUNT"
echo ""
echo "下一步操作:"
echo "  查看差异详情: curl $BASE_URL/discrepancies?taskId=$TASK_ID"
echo "  下载报告: curl -O $BASE_URL/reports/$REPORT_ID/download"
echo ""
