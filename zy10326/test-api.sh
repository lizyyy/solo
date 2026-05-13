#!/bin/bash

BASE_URL="http://localhost:8080/api/retry-budget"

echo "=================================="
echo "接口重试预算服务 - API 测试脚本"
echo "=================================="

echo -e "\n=== 1. 创建重试预算 ==="
curl -X POST "$BASE_URL/create" \
  -H "Content-Type: application/json" \
  -d '{
    "callerId": "service-order",
    "targetApi": "http://payment-service/api/pay",
    "totalBudget": 5,
    "backoffStrategy": "EXPONENTIAL",
    "initialBackoffMs": 1000,
    "maxBackoffMs": 10000,
    "backoffMultiplier": 2.0,
    "recoveryIntervalMs": 60000
  }' | python3 -m json.tool

echo -e "\n=== 2. 再次创建同一预算(幂等测试) ==="
curl -X POST "$BASE_URL/create" \
  -H "Content-Type: application/json" \
  -d '{
    "callerId": "service-order",
    "targetApi": "http://payment-service/api/pay",
    "totalBudget": 10,
    "backoffStrategy": "FIXED",
    "initialBackoffMs": 500,
    "maxBackoffMs": 5000,
    "backoffMultiplier": 1.5,
    "recoveryIntervalMs": 30000
  }' | python3 -m json.tool

echo -e "\n=== 3. 第1次重试检查(带幂等键) ==="
curl -X POST "$BASE_URL/check" \
  -H "Content-Type: application/json" \
  -d '{
    "callerId": "service-order",
    "targetApi": "http://payment-service/api/pay",
    "failureType": "TRANSIENT",
    "failureReason": "Connection timeout occurred",
    "idempotentKey": "request-001"
  }' | python3 -m json.tool

echo -e "\n=== 4. 使用相同幂等键再次请求(幂等测试) ==="
curl -X POST "$BASE_URL/check" \
  -H "Content-Type: application/json" \
  -d '{
    "callerId": "service-order",
    "targetApi": "http://payment-service/api/pay",
    "failureType": "TRANSIENT",
    "failureReason": "Connection timeout occurred",
    "idempotentKey": "request-001"
  }' | python3 -m json.tool

echo -e "\n=== 5. 第2次重试检查(新请求) ==="
curl -X POST "$BASE_URL/check" \
  -H "Content-Type: application/json" \
  -d '{
    "callerId": "service-order",
    "targetApi": "http://payment-service/api/pay",
    "failureType": "SERVER_ERROR",
    "failureReason": "503 Service Unavailable"
  }' | python3 -m json.tool

echo -e "\n=== 6. 第3次重试检查 ==="
curl -X POST "$BASE_URL/check" \
  -H "Content-Type: application/json" \
  -d '{
    "callerId": "service-order",
    "targetApi": "http://payment-service/api/pay",
    "failureType": "TIMEOUT",
    "failureReason": "Read timeout"
  }' | python3 -m json.tool

echo -e "\n=== 7. 第4次重试检查 ==="
curl -X POST "$BASE_URL/check" \
  -H "Content-Type: application/json" \
  -d '{
    "callerId": "service-order",
    "targetApi": "http://payment-service/api/pay",
    "failureType": "NETWORK_ERROR",
    "failureReason": "Network connection reset"
  }' | python3 -m json.tool

echo -e "\n=== 8. 第5次重试检查(预算耗尽) ==="
curl -X POST "$BASE_URL/check" \
  -H "Content-Type: application/json" \
  -d '{
    "callerId": "service-order",
    "targetApi": "http://payment-service/api/pay",
    "failureType": "RATE_LIMITED",
    "failureReason": "Rate limit exceeded"
  }' | python3 -m json.tool

echo -e "\n=== 9. 第6次重试检查(已耗尽拦截) ==="
curl -X POST "$BASE_URL/check" \
  -H "Content-Type: application/json" \
  -d '{
    "callerId": "service-order",
    "targetApi": "http://payment-service/api/pay",
    "failureType": "SERVER_ERROR",
    "failureReason": "500 Internal Server Error"
  }' | python3 -m json.tool

echo -e "\n=== 10. 查询当前预算状态 ==="
curl -X GET "$BASE_URL/budget?callerId=service-order&targetApi=http://payment-service/api/pay" | python3 -m json.tool

echo -e "\n=== 11. 记录成功(重置连续失败次数) ==="
curl -X POST "$BASE_URL/success?callerId=service-order&targetApi=http://payment-service/api/pay" | python3 -m json.tool

echo -e "\n=== 12. 再次查询预算状态(验证恢复) ==="
curl -X GET "$BASE_URL/budget?callerId=service-order&targetApi=http://payment-service/api/pay" | python3 -m json.tool

echo -e "\n=== 13. 查询失败历史记录 ==="
curl -X GET "$BASE_URL/history?callerId=service-order&targetApi=http://payment-service/api/pay&page=0&size=10" | python3 -m json.tool

echo -e "\n=== 14. 查询耗尽记录 ==="
curl -X GET "$BASE_URL/exhaustion-records?callerId=service-order&targetApi=http://payment-service/api/pay" | python3 -m json.tool

echo -e "\n=================================="
echo "测试完成！"
echo "=================================="
