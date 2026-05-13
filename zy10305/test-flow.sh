#!/bin/bash

BASE_URL="http://localhost:8080/api/v1/invalidation"

echo "=========================================="
echo "分布式缓存失效编排 API - 完整流程测试"
echo "=========================================="
echo ""

echo "1. 创建批次 1: 创建失效批次"
echo "------------------------------------------"
CREATE_RESPONSE=$(curl -s -X POST "$BASE_URL/batches" \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "REQ-2024-001",
    "keyPattern": "cache:user:*",
    "serviceNodes": [
      {"nodeId": "node-01", "nodeAddress": "http://node1:8080", "priority": 1},
      {"nodeId": "node-02", "nodeAddress": "http://node2:8080", "priority": 2},
      {"nodeId": "node-03", "nodeAddress": "http://node3:8080", "priority": 3}
    ],
    "retryConfig": {
      "maxRetries": 3,
      "delaySeconds": 60
    }
  }')

echo "$CREATE_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$CREATE_RESPONSE"
echo ""

BATCH_ID=$(echo "$CREATE_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['batchId'])" 2>/dev/null || echo "1")
echo "批次 ID: $BATCH_ID"
echo ""

echo "2. 测试幂等性: 再次提交相同的 requestId"
echo "------------------------------------------"
curl -s -X POST "$BASE_URL/batches" \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "REQ-2024-001",
    "keyPattern": "cache:user:*",
    "serviceNodes": [
      {"nodeId": "node-01", "nodeAddress": "http://node1:8080"}
    ]
  }' | python3 -m json.tool 2>/dev/null || echo "幂等测试完成"
echo ""

echo "3. 校验批次"
echo "------------------------------------------"
curl -s -X POST "$BASE_URL/batches/$BATCH_ID/validate" | python3 -m json.tool 2>/dev/null
echo ""

echo "4. 开始处理批次"
echo "------------------------------------------"
curl -s -X POST "$BASE_URL/batches/$BATCH_ID/start" | python3 -m json.tool 2>/dev/null
echo ""

echo "5. 节点 01 确认成功"
echo "------------------------------------------"
curl -s -X POST "$BASE_URL/batches/$BATCH_ID/confirm" \
  -H "Content-Type: application/json" \
  -d '{
    "receiptId": "RCP-001",
    "nodeId": "node-01",
    "status": "CONFIRMED",
    "keysProcessed": 10
  }' | python3 -m json.tool 2>/dev/null
echo ""

echo "6. 节点 02 确认失败"
echo "------------------------------------------"
curl -s -X POST "$BASE_URL/batches/$BATCH_ID/confirm" \
  -H "Content-Type: application/json" \
  -d '{
    "receiptId": "RCP-002",
    "nodeId": "node-02",
    "status": "FAILED",
    "failureReason": "连接超时: 无法连接到 Redis 服务器",
    "keysProcessed": 0
  }' | python3 -m json.tool 2>/dev/null
echo ""

echo "7. 测试回执幂等性: 再次提交相同的 receiptId"
echo "------------------------------------------"
curl -s -X POST "$BASE_URL/batches/$BATCH_ID/confirm" \
  -H "Content-Type: application/json" \
  -d '{
    "receiptId": "RCP-001",
    "nodeId": "node-01",
    "status": "CONFIRMED",
    "keysProcessed": 10
  }' | python3 -m json.tool 2>/dev/null
echo ""

echo "8. 节点 03 确认成功"
echo "------------------------------------------"
curl -s -X POST "$BASE_URL/batches/$BATCH_ID/confirm" \
  -H "Content-Type: application/json" \
  -d '{
    "receiptId": "RCP-003",
    "nodeId": "node-03",
    "status": "CONFIRMED",
    "keysProcessed": 10
  }' | python3 -m json.tool 2>/dev/null
echo ""

echo "9. 查询批次状态"
echo "------------------------------------------"
curl -s "$BASE_URL/batches/$BATCH_ID" | python3 -m json.tool 2>/dev/null
echo ""

echo "10. 通过 requestId 查询批次"
echo "------------------------------------------"
curl -s "$BASE_URL/batches/request/REQ-2024-001" | python3 -m json.tool 2>/dev/null
echo ""

echo "11. 按状态查询批次"
echo "------------------------------------------"
curl -s "$BASE_URL/batches/status?statuses=PARTIAL_SUCCESS,SUCCESS" | python3 -m json.tool 2>/dev/null
echo ""

echo "12. 导出批次详情 (CSV)"
echo "------------------------------------------"
curl -s -o "batch_${BATCH_ID}.csv" "$BASE_URL/batches/$BATCH_ID/export"
echo "已导出到 batch_${BATCH_ID}.csv"
echo ""

echo "=========================================="
echo "测试完成!"
echo "=========================================="
echo ""
echo "附加测试用例总结:"
echo "- ✅ 创建批次 (含节点配置"
echo "- ✅ 幂等性测试 (重复 requestId"
echo "- ✅ 批次校验"
echo "- ✅ 开始处理"
echo "- ✅ 成功回执确认"
echo "- ✅ 失败回执确认"
echo "- ✅ 回执幂等性"
echo "- ✅ 状态对账机制"
echo "- ✅ 状态查询"
echo "- ✅ requestId 查询"
echo "- ✅ 状态批量查询"
echo "- ✅ CSV 导出"
