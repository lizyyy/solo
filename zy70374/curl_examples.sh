#!/bin/bash
BASE="http://localhost:8080"

echo "=== 健康检查 ==="
curl -s "$BASE/health" | jq .
echo ""

echo "=== 1) 优惠通过示例 ==="
curl -s -X POST "$BASE/decide" \
  -H "Content-Type: application/json" \
  -d '{
    "strategy_id": "discount-strategy",
    "request_id": "req-discount-pass-001",
    "context": {
      "user_level": "VIP"
    }
  }' | jq .
echo ""

echo "=== 2) 风控拦截示例 ==="
curl -s -X POST "$BASE/decide" \
  -H "Content-Type: application/json" \
  -d '{
    "strategy_id": "risk-strategy",
    "request_id": "req-risk-block-001",
    "context": {
      "ip_address": "192.168.1.1"
    }
  }' | jq .
echo ""

echo "=== 3) 字段缺失示例 ==="
curl -s -X POST "$BASE/decide" \
  -H "Content-Type: application/json" \
  -d '{
    "strategy_id": "risk-strategy",
    "request_id": "req-missing-field-001",
    "context": {
      "account_age_hours": 10
    }
  }' | jq .
echo ""

echo "=== 4) 重复请求（幂等）示例 ==="
curl -s -X POST "$BASE/decide" \
  -H "Content-Type: application/json" \
  -d '{
    "strategy_id": "discount-strategy",
    "request_id": "req-discount-pass-001",
    "context": {
      "user_level": "VIP"
    }
  }' | jq .
echo ""

echo "=== 5) 历史决策回放（版本回放）==="
echo "先查询之前的决策，看 simple/detailed explanation"
curl -s "$BASE/decisions?request_id=req-risk-block-001" | jq .
echo ""
