#!/bin/bash

BASE_URL="http://localhost:3000"

echo "======================================"
echo "回调地址健康巡检API - curl示例"
echo "======================================"
echo ""

echo "======================================"
echo "1. 注册客户"
echo "======================================"
curl -X POST "$BASE_URL/customers" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "示例科技有限公司",
    "email": "tech@example.com",
    "phone": "13800138000"
  }' | json_pp
echo ""
echo ""

echo "======================================"
echo "2. 注册回调地址 - 健康地址"
echo "======================================"
HEALTHY_URL_RESPONSE=$(curl -s -X POST "$BASE_URL/callback-urls" \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "请替换为实际的客户ID",
    "url": "https://httpbin.org/get",
    "description": "订单支付回调接口",
    "frequencyMinutes": 5,
    "createdBy": "customer"
  }')
echo "$HEALTHY_URL_RESPONSE" | json_pp
echo ""
echo ""

echo "======================================"
echo "3. 注册回调地址 - 证书已过期地址"
echo "======================================"
EXPIRED_CERT_URL_RESPONSE=$(curl -s -X POST "$BASE_URL/callback-urls" \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "请替换为实际的客户ID",
    "url": "https://expired.badssl.com",
    "description": "测试过期证书地址",
    "frequencyMinutes": 15,
    "createdBy": "customer"
  }')
echo "$EXPIRED_CERT_URL_RESPONSE" | json_pp
echo ""
echo ""

echo "======================================"
echo "4. 注册回调地址 - 慢响应地址"
echo "======================================"
SLOW_URL_RESPONSE=$(curl -s -X POST "$BASE_URL/callback-urls" \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "请替换为实际的客户ID",
    "url": "https://httpbin.org/delay/3",
    "description": "用户事件回调接口（响应较慢）",
    "frequencyMinutes": 10,
    "createdBy": "customer"
  }')
echo "$SLOW_URL_RESPONSE" | json_pp
echo ""
echo ""

echo "======================================"
echo "5. 注册回调地址 - 不存在的地址（将连续失败）"
echo "======================================"
FAILING_URL_RESPONSE=$(curl -s -X POST "$BASE_URL/callback-urls" \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "请替换为实际的客户ID",
    "url": "https://this-domain-definitely-does-not-exist-12345.com/callback",
    "description": "测试连续失败地址",
    "frequencyMinutes": 1,
    "createdBy": "customer"
  }')
echo "$FAILING_URL_RESPONSE" | json_pp
echo ""
echo ""

echo "======================================"
echo "6. 尝试重复注册同一地址（应该返回409）"
echo "======================================"
curl -X POST "$BASE_URL/callback-urls" \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "请替换为实际的客户ID",
    "url": "https://httpbin.org/get",
    "description": "订单支付回调接口（重复）",
    "frequencyMinutes": 5,
    "createdBy": "customer"
  }' | json_pp
echo ""
echo ""

echo "======================================"
echo "7. 立即执行健康检查"
echo "======================================"
echo "请替换为实际的callbackUrlId"
curl -X POST "$BASE_URL/health-checks/[callbackUrlId]/run" \
  -H "Content-Type: application/json" | json_pp
echo ""
echo ""

echo "======================================"
echo "8. 暂停巡检"
echo "======================================"
echo "请替换为实际的callbackUrlId"
curl -X POST "$BASE_URL/callback-urls/[callbackUrlId]/pause" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "系统维护，预计2小时后恢复"
  }' | json_pp
echo ""
echo ""

echo "======================================"
echo "9. 恢复巡检"
echo "======================================"
echo "请替换为实际的callbackUrlId"
curl -X POST "$BASE_URL/callback-urls/[callbackUrlId]/resume" \
  -H "Content-Type: application/json" | json_pp
echo ""
echo ""

echo "======================================"
echo "10. 查询客户健康状态"
echo "======================================"
echo "请替换为实际的客户ID"
curl -X GET "$BASE_URL/customers/[customerId]/health-status" \
  -H "Content-Type: application/json" | json_pp
echo ""
echo ""

echo "======================================"
echo "11. 查询巡检历史"
echo "======================================"
echo "请替换为实际的callbackUrlId"
curl -X GET "$BASE_URL/health-checks?callbackUrlId=[callbackUrlId]&limit=10" \
  -H "Content-Type: application/json" | json_pp
echo ""
echo ""

echo "======================================"
echo "12. 查询未确认的告警通知"
echo "======================================"
curl -X GET "$BASE_URL/notifications?acknowledged=false" \
  -H "Content-Type: application/json" | json_pp
echo ""
echo ""

echo "======================================"
echo "13. 查看巡检汇总（运营视角）"
echo "======================================"
curl -X GET "$BASE_URL/summary" \
  -H "Content-Type: application/json" | json_pp
echo ""
echo ""

echo "======================================"
echo "14. 更新回调地址配置"
echo "======================================"
echo "请替换为实际的callbackUrlId"
curl -X PUT "$BASE_URL/callback-urls/[callbackUrlId]" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "更新后的描述",
    "frequencyMinutes": 10
  }' | json_pp
echo ""
echo ""

echo "======================================"
echo "15. 确认告警通知"
echo "======================================"
echo "请替换为实际的notificationId"
curl -X POST "$BASE_URL/notifications/[notificationId]/acknowledge" \
  -H "Content-Type: application/json" | json_pp
echo ""
echo ""

echo "======================================"
echo "示例脚本执行完成"
echo "======================================"
echo ""
echo "提示："
echo "1. 请先启动服务：npm start"
echo "2. 执行脚本前需要替换示例中的[customerId]和[callbackUrlId]"
echo "3. 实际使用时建议安装jq替代json_pp：brew install jq"