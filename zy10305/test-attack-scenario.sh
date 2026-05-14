#!/bin/bash

echo "========================================"
echo "  漏洞场景测试 - 修复验证"
echo "========================================"
echo ""
echo "测试目标: 验证修复后的逻辑能否防止以下攻击:"
echo "  1. 同一节点通过不同 receiptId 重复提交"
echo "  2. 利用重复回执让批次提前进入 SUCCESS 状态"
echo ""

BASE_URL="http://localhost:8080/api/v1/invalidation"

echo "[1/7] 创建批次 (3个节点)"
echo "----------------------------------------"
CREATE_RESPONSE=$(curl -s -X POST "$BASE_URL/batches" \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "TEST-ATTACK-'$(date +%Y%m%d%H%M%S)'",
    "keyPattern": "cache:test:*",
    "serviceNodes": [
      {"nodeId": "node-A", "nodeAddress": "http://nodeA:8080"},
      {"nodeId": "node-B", "nodeAddress": "http://nodeB:8080"},
      {"nodeId": "node-C", "nodeAddress": "http://nodeC:8080"}
    ]
  }')

BATCH_ID=$(echo "$CREATE_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['batchId'])" 2>/dev/null || echo "1")
echo "批次 ID: $BATCH_ID"
echo ""

echo "[2/7] 校验并开始处理批次"
echo "----------------------------------------"
curl -s -X POST "$BASE_URL/batches/$BATCH_ID/validate" > /dev/null
curl -s -X POST "$BASE_URL/batches/$BATCH_ID/start" > /dev/null
echo "批次已进入 PROCESSING 状态"
echo ""

echo "[3/7] 节点 A 提交成功回执"
echo "----------------------------------------"
curl -s -X POST "$BASE_URL/batches/$BATCH_ID/confirm" \
  -H "Content-Type: application/json" \
  -d '{
    "receiptId": "RCP-A-01",
    "nodeId": "node-A",
    "status": "CONFIRMED",
    "keysProcessed": 5
  }' | python3 -c "import sys, json; r=json.load(sys.stdin); print('回执提交: ' + ('成功' if r['code']==200 else '失败'))"
echo ""

echo "[4/7] 【攻击场景】节点 A 用不同 receiptId 再次提交 (应该被拒绝)"
echo "----------------------------------------"
echo "预期: 返回 400 错误，提示'不允许重复提交'"
echo ""
RESULT=$(curl -s -X POST "$BASE_URL/batches/$BATCH_ID/confirm" \
  -H "Content-Type: application/json" \
  -d '{
    "receiptId": "RCP-A-02-ATTACK",
    "nodeId": "node-A",
    "status": "CONFIRMED",
    "keysProcessed": 5
  }')

CODE=$(echo "$RESULT" | python3 -c "import sys, json; print(json.load(sys.stdin)['code'])" 2>/dev/null)
MSG=$(echo "$RESULT" | python3 -c "import sys, json; print(json.load(sys.stdin)['message'])" 2>/dev/null)

if [ "$CODE" = "400" ]; then
    echo "✅ 修复验证成功: 攻击被阻止"
    echo "   返回码: $CODE"
    echo "   返回信息: $MSG"
else
    echo "❌ 修复验证失败: 攻击成功 (返回码: $CODE)"
fi
echo ""

echo "[5/7] 【攻击场景】节点 A 用不同 receiptId 提交失败状态 (应该被拒绝)"
echo "----------------------------------------"
RESULT=$(curl -s -X POST "$BASE_URL/batches/$BATCH_ID/confirm" \
  -H "Content-Type: application/json" \
  -d '{
    "receiptId": "RCP-A-03-ATTACK-FAILED",
    "nodeId": "node-A",
    "status": "FAILED",
    "failureReason": "test attack"
  }')

CODE=$(echo "$RESULT" | python3 -c "import sys, json; print(json.load(sys.stdin)['code'])" 2>/dev/null)

if [ "$CODE" = "400" ]; then
    echo "✅ 修复验证成功: 攻击被阻止"
    echo "   返回码: $CODE"
else
    echo "❌ 修复验证失败: 攻击成功 (返回码: $CODE)"
fi
echo ""

echo "[6/7] 查询当前回执数量 (应该只有 1 个)"
echo "----------------------------------------"
BATCH_STATUS=$(curl -s "$BASE_URL/batches/$BATCH_ID")
RECEIPT_COUNT=$(echo "$BATCH_STATUS" | python3 -c "import sys, json; print(len(json.load(sys.stdin)['data']['receipts']))" 2>/dev/null)
echo "当前回执数量: $RECEIPT_COUNT"

if [ "$RECEIPT_COUNT" = "1" ]; then
    echo "✅ 修复验证成功: 回执数量正确"
else
    echo "❌ 修复验证失败: 回执数量异常 ($RECEIPT_COUNT != 1)"
fi
echo ""

echo "[7/7] 查询批次状态 (应该仍为 PROCESSING)"
echo "----------------------------------------"
CURRENT_STATUS=$(echo "$BATCH_STATUS" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['status'])" 2>/dev/null)
echo "当前状态: $CURRENT_STATUS"

if [ "$CURRENT_STATUS" = "PROCESSING" ]; then
    echo "✅ 修复验证成功: 状态正确 (仍为 PROCESSING, 未提前完成)"
else
    echo "❌ 修复验证失败: 状态异常 ($CURRENT_STATUS != PROCESSING)"
fi
echo ""

echo "========================================"
echo "  漏洞场景测试完成!"
echo "========================================"
echo ""
echo "修复效果总结:"
echo "🔒 同一节点同一批次不允许重复提交不同回执"
echo "🔒 对账逻辑按 nodeId 去重统计"
echo "🔒 批次不会因为重复回执提前进入完成状态"
echo ""
echo "推荐继续运行完整测试:"
echo "  ./test-flow.sh"
echo ""
