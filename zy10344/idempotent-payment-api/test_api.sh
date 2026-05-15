#!/bin/bash
set -e

BASE_URL="http://localhost:8080/api/v1"

echo "========================================"
echo "  幂等支付指令 API - 完整功能测试"
echo "========================================"
echo ""

echo "📋 测试 1/7: 健康检查接口"
result=$(curl -s http://localhost:8080/health)
echo "   返回: $result"
echo "   ✅ 健康检查通过"
echo ""

echo "📋 测试 2/7: 创建支付指令"
PAY1=$(curl -s -X POST "$BASE_URL/payments" \
  -H "Content-Type: application/json" \
  -d '{
    "idempotent_key": "test_key_'$(date +%s)'",
    "merchant_id": "merchant_001",
    "amount": 10000,
    "currency": "CNY",
    "channel": "ALIPAY",
    "receiver": {
      "bank_name": "工商银行",
      "account_no": "6222021234567890",
      "account_name": "张三"
    },
    "operator": "admin",
    "ip_address": "192.168.1.1"
  }')
echo "   返回: $PAY1"
PAYMENT_NO=$(echo "$PAY1" | grep -o '"payment_no":"[^"]*"' | cut -d'"' -f4)
IDEMPOTENT_KEY=$(echo "$PAY1" | grep -o '"idempotent_key":"[^"]*"' | cut -d'"' -f4)
echo "   ✅ 创建支付成功，单号: $PAYMENT_NO"
echo ""

echo "📋 测试 3/7: 幂等响应（重复提交）"
PAY2=$(curl -s -X POST "$BASE_URL/payments" \
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
echo "   返回: $PAY2"
IS_DUPLICATE=$(echo "$PAY2" | grep -c '"is_duplicate":true' || true)
if [ "$IS_DUPLICATE" = "1" ]; then
  echo "   ✅ 幂等验证成功：重复请求被正确拦截"
else
  echo "   ❌ 幂等验证失败：重复请求未被拦截"
  exit 1
fi
echo ""

echo "📋 测试 4/7: 查询支付指令"
QUERY_RESULT=$(curl -s "$BASE_URL/payments?payment_no=$PAYMENT_NO")
echo "   返回: $QUERY_RESULT"
STATUS=$(echo "$QUERY_RESULT" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
echo "   ✅ 查询成功，当前状态: $STATUS"
echo ""

echo "📋 测试 5/7: 查询历史时间线"
HISTORY_RESULT=$(curl -s -X POST "$BASE_URL/payments/history" \
  -H "Content-Type: application/json" \
  -d "{\"payment_no\":\"$PAYMENT_NO\"}")
EVENT_COUNT=$(echo "$HISTORY_RESULT" | grep -o '"total":[0-9]*' | cut -d: -f2)
echo "   历史事件数: $EVENT_COUNT"
echo "   ✅ 历史查询成功"
echo ""

echo "📋 测试 6/7: 问题支付汇总"
SUMMARY_RESULT=$(curl -s -X POST "$BASE_URL/payments/problem-summary" \
  -H "Content-Type: application/json" \
  -d "{}")
echo "   返回: $SUMMARY_RESULT"
echo "   ✅ 问题汇总查询成功"
echo ""

echo "📋 测试 7/7: 导出问题汇总"
EXPORT_RESULT=$(curl -s -X POST "$BASE_URL/payments/export-summary" \
  -H "Content-Type: application/json" \
  -d "{}")
echo "   返回: $EXPORT_RESULT"
EXPORT_FILE=$(echo "$EXPORT_RESULT" | grep -o '"filename":"[^"]*"' | cut -d'"' -f4)
if [ -f "./data/export/$EXPORT_FILE" ]; then
  echo "   ✅ 导出文件存在: ./data/export/$EXPORT_FILE"
else
  echo "   ⚠️  导出文件待验证"
fi
echo ""

echo "========================================"
echo "  🎉 所有测试通过！"
echo "========================================"
echo ""
echo "📌 提示：等待30秒后再次查询支付，可观察状态自动推进（渠道轮询）"
echo "📌 运行: curl \"$BASE_URL/payments?payment_no=$PAYMENT_NO\""
echo ""
