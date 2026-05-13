#!/bin/bash

BASE_URL="http://localhost:3000/api/compression"

echo "========================================"
echo "API响应压缩策略系统 - 测试场景"
echo "========================================"
echo ""

echo "场景1: 新客户端大JSON响应 - 应该压缩"
echo "----------------------------------------"
curl -s -X POST "$BASE_URL/simulate" \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "ios_2.0.0",
    "path": "/api/complaints/list",
    "responseSize": 50000,
    "contentType": "application/json"
  }' | python3 -m json.tool
echo ""
echo ""

echo "场景2: 旧客户端 - 应该跳过"
echo "----------------------------------------"
curl -s -X POST "$BASE_URL/simulate" \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "ios_1.0.0",
    "path": "/api/complaints/list",
    "responseSize": 50000,
    "contentType": "application/json"
  }' | python3 -m json.tool
echo ""
echo ""

echo "场景3: 小响应 - 应该跳过"
echo "----------------------------------------"
curl -s -X POST "$BASE_URL/simulate" \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "ios_2.0.0",
    "path": "/api/complaints/list",
    "responseSize": 500,
    "contentType": "application/json"
  }' | python3 -m json.tool
echo ""
echo ""

echo "场景4: 图片内容 - 应该跳过"
echo "----------------------------------------"
curl -s -X POST "$BASE_URL/simulate" \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "android_2.5.0",
    "path": "/api/complaints/123/image",
    "responseSize": 100000,
    "contentType": "image/jpeg"
  }' | python3 -m json.tool
echo ""
echo ""

echo "场景5: Android新版本客户端大JSON - 应该压缩"
echo "----------------------------------------"
curl -s -X POST "$BASE_URL/simulate" \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "android_2.5.0",
    "path": "/api/complaints/list",
    "responseSize": 100000,
    "contentType": "application/json"
  }' | python3 -m json.tool
echo ""
echo ""

echo "场景6: 查询统计信息"
echo "----------------------------------------"
curl -s "$BASE_URL/query" | python3 -m json.tool
echo ""
echo ""

echo "场景7: 查看历史记录"
echo "----------------------------------------"
curl -s "$BASE_URL/history" | python3 -m json.tool
echo ""
echo ""

echo "场景8: 获取所有策略"
echo "----------------------------------------"
STRATEGY_RESPONSE=$(curl -s "$BASE_URL/strategies")
echo "$STRATEGY_RESPONSE" | python3 -m json.tool
echo ""
echo ""

echo "场景9: 修改策略（用于回滚测试）"
echo "----------------------------------------"
STRATEGY_ID=$(echo "$STRATEGY_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['data'][0]['id'])")
echo "策略ID: $STRATEGY_ID"
echo ""

curl -s -X PUT "$BASE_URL/strategies/$STRATEGY_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "修改后的压缩策略",
    "minResponseSize": 2048
  }' | python3 -m json.tool
echo ""
echo ""

echo "场景10: 策略回滚"
echo "----------------------------------------"
curl -s -X POST "$BASE_URL/rollback/$STRATEGY_ID" | python3 -m json.tool
echo ""
echo ""

echo "场景11: 回滚后新请求立即使用旧策略"
echo "----------------------------------------"
curl -s -X POST "$BASE_URL/simulate" \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "ios_2.0.0",
    "path": "/api/complaints/list",
    "responseSize": 1500,
    "contentType": "application/json"
  }' | python3 -m json.tool
echo ""
echo ""

echo "场景12: 最终查询统计"
echo "----------------------------------------"
curl -s "$BASE_URL/query" | python3 -m json.tool
echo ""
echo ""

echo "========================================"
echo "所有测试场景执行完成"
echo "========================================"
