#!/bin/bash
BASE_URL="http://localhost:8000"

echo "=== 新能源订单数据处理 API 测试脚本 ==="
echo ""

echo "1. 健康检查..."
curl -s "${BASE_URL}/api/health" | python3 -m json.tool
echo ""

echo "2. 上传并处理数据（订单CSV + 桩端日志 + 支付回执）..."
curl -s -X POST "${BASE_URL}/api/process" \
  -F "order_csv=@sample_orders.csv" \
  -F "charging_log=@sample_charging_logs.json" \
  -F "payment_receipt=@sample_payments.json" | python3 -m json.tool
echo ""

echo "3. 查看已处理批次..."
curl -s "${BASE_URL}/api/batches" | python3 -m json.tool
echo ""

echo "4. 测试重复提交（应该返回409）..."
curl -s -w "\nHTTP状态码: %{http_code}\n" -X POST "${BASE_URL}/api/process" \
  -F "order_csv=@sample_orders.csv" \
  -F "charging_log=@sample_charging_logs.json" \
  -F "payment_receipt=@sample_payments.json"
echo ""

echo "=== 测试完成 ==="
