#!/bin/bash

BASE_URL="http://localhost:8080/api/v1/events"

echo "=== Webhook 顺序保证 API 测试脚本 ==="
echo ""

echo "1. 健康检查"
curl -s "${BASE_URL}/health" | jq .
echo ""

echo "2. 顺序提交 - 序列号 1"
curl -s -X POST "${BASE_URL}" \
  -H "Content-Type: application/json" \
  -d '{
    "eventId": "evt-001",
    "topic": "order",
    "businessKey": "order-123",
    "sequenceNumber": 1,
    "payload": {
      "action": "create",
      "amount": 100
    }
  }' | jq .
echo ""

echo "3. 顺序提交 - 序列号 2"
curl -s -X POST "${BASE_URL}" \
  -H "Content-Type: application/json" \
  -d '{
    "eventId": "evt-002",
    "topic": "order",
    "businessKey": "order-123",
    "sequenceNumber": 2,
    "payload": {
      "action": "update",
      "amount": 200
    }
  }' | jq .
echo ""

echo "4. 乱序提交 - 序列号 4 (跳过 3)"
curl -s -X POST "${BASE_URL}" \
  -H "Content-Type: application/json" \
  -d '{
    "eventId": "evt-004",
    "topic": "order",
    "businessKey": "order-123",
    "sequenceNumber": 4,
    "payload": {
      "action": "pay",
      "amount": 200
    }
  }' | jq .
echo ""

echo "5. 补充缺口 - 序列号 3"
curl -s -X POST "${BASE_URL}" \
  -H "Content-Type: application/json" \
  -d '{
    "eventId": "evt-003",
    "topic": "order",
    "businessKey": "order-123",
    "sequenceNumber": 3,
    "payload": {
      "action": "confirm",
      "amount": 200
    }
  }' | jq .
echo ""

echo "6. 幂等测试 - 重复提交 evt-001"
curl -s -X POST "${BASE_URL}" \
  -H "Content-Type: application/json" \
  -d '{
    "eventId": "evt-001",
    "topic": "order",
    "businessKey": "order-123",
    "sequenceNumber": 1,
    "payload": {
      "action": "create",
      "amount": 100
    }
  }' | jq .
echo ""

echo "7. 回溯序列号测试 - 序列号 2"
curl -s -X POST "${BASE_URL}" \
  -H "Content-Type: application/json" \
  -d '{
    "eventId": "evt-002-dup",
    "topic": "order",
    "businessKey": "order-123",
    "sequenceNumber": 2,
    "payload": {
      "action": "update-again"
    }
  }' | jq .
echo ""

echo "8. 查询单个事件 evt-003"
curl -s "${BASE_URL}/evt-003" | jq .
echo ""

echo "9. 查询所有事件"
curl -s "${BASE_URL}" | jq .
echo ""

echo "10. 查询序列状态"
curl -s "${BASE_URL}/state?topic=order&businessKey=order-123" | jq .
echo ""

echo "11. 导出所有事件"
curl -s "${BASE_URL}/export" | jq .
echo ""

echo "=== 测试完成 ==="
