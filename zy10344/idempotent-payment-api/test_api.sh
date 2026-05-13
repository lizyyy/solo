#!/bin/bash

BASE_URL="http://localhost:8080/api/v1"

echo "========================================"
echo "幂等支付指令 API 测试脚本"
echo "========================================"
echo ""

echo "[1/6] 测试健康检查接口..."
curl -s "http://localhost:8080/health" | jq .
echo ""

echo "[2/6] 测试创建支付指令..."
echo "请求1: 创建新支付"
RESP1=$(curl -s -X POST "$BASE_URL/payments" \
  -H "Content-Type: application/json" \
  -d '{
    "idempotent_key": "test_key_'"$(date +%s)"'",
    "merchant_id": "merchant_001",
    "amount": 10000,
    "currency": "CNY",
    "channel": "ALIPAY",
    "receiver": {
      "bank_name": "工商银行",
      "account_no": "6222021234567890",
      "account_name": "张三"
    },
    "remark": "订单支付",
    "operator": "admin",
    "ip_address": "192.168.1.1"
  }')
echo "$RESP1" | jq .

PAYMENT_NO=$(echo "$RESP1" | jq -r '.payment_no')
IDEMPOTENT_KEY=$(echo "$RESP1" | jq -r '.idempotent_key')
echo ""

echo "[3/6] 测试幂等性 - 重复提交相同请求..."
echo "请求2: 使用相同幂等键重复提交"
RESP2=$(curl -s -X POST "$BASE_URL/payments" \
  -H "Content-Type: application/json" \
  -d '{
    "idempotent_key": "'"$IDEMPOTENT_KEY"'",
    "merchant_id": "merchant_001",
    "amount": 10000,
    "currency": "CNY",
    "channel": "ALIPAY",
    "receiver": {
      "bank_name": "工商银行",
      "account_no": "6222021234567890",
      "account_name": "张三"
    }
  }')
echo "$RESP2" | jq .
IS_DUPLICATE=$(echo "$RESP2" | jq -r '.is_duplicate')
if [ "$IS_DUPLICATE" = "true" ]; then
  echo "✅ 幂等验证成功：重复请求被正确拦截"
else
  echo "❌ 幂等验证失败：重复请求未被拦截"
fi
echo ""

echo "[4/6] 测试查询支付指令..."
echo "按支付单号查询: $PAYMENT_NO"
curl -s "$BASE_URL/payments?payment_no=$PAYMENT_NO" | jq .
echo ""

echo "按幂等键查询: $IDEMPOTENT_KEY"
curl -s "$BASE_URL/payments?idempotent_key=$IDEMPOTENT_KEY" | jq .
echo ""

echo "[5/6] 测试查询历史记录..."
curl -s -X POST "$BASE_URL/payments/history" \
  -H "Content-Type: application/json" \
  -d "{\"payment_no\": \"$PAYMENT_NO\"}" | jq .
echo ""

echo "[6/6] 测试问题支付汇总..."
curl -s -X POST "$BASE_URL/payments/problem-summary" \
  -H "Content-Type: application/json" \
  -d "{}" | jq .
echo ""

echo "========================================"
echo "测试完成！"
echo "========================================"
echo "提示：可以等待30秒后再次查询，观察状态自动更新（模拟渠道轮询）"
echo ""
echo "其他可用接口："
echo "  - 撤销支付: POST $BASE_URL/payments/cancel"
echo "  - 渠道回调: POST $BASE_URL/payments/callback"
echo "  - 导出汇总: POST $BASE_URL/payments/export-summary"
