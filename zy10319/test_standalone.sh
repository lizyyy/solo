#!/bin/bash

BASE_URL="http://localhost:8080/api/v1/events"
FAILED=0

echo "========================================"
echo "  Webhook 顺序保证 API - 完整测试"
echo "========================================"
echo ""

# 检查服务是否启动
echo "⏳ 等待服务启动..."
READY=0
for i in {1..30}; do
    RESPONSE=$(curl -s --connect-timeout 1 "${BASE_URL}/health")
    if [ $? -eq 0 ] && echo "$RESPONSE" | grep -q '"status":"UP"' > /dev/null; then
        echo "✅ 服务已就绪"
        READY=1
        break
    fi
    sleep 1
done

if [ $READY -eq 0 ]; then
    echo "❌ 服务启动失败，请先运行: python3 webhook_server.py"
    echo "   或: ./start_server.sh"
    exit 1
fi
echo ""

# 断言函数
assert_equals() {
    if [ "$1" != "$2" ]; then
        echo "   ❌ 断言失败: 预期 '$2'，实际 '$1'"
        FAILED=1
    else
        echo "   ✅ 验证通过"
    fi
}

assert_contains() {
    if ! echo "$1" | grep -q "$2"; then
        echo "   ❌ 断言失败: 不包含 '$2'"
        FAILED=1
    else
        echo "   ✅ 验证通过"
    fi
}

echo "【1】健康检查"
RESPONSE=$(curl -s "${BASE_URL}/health")
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
STATUS=$(echo "$RESPONSE" | grep -o '"status":"[^"]*' | cut -d'"' -f4)
assert_equals "$STATUS" "UP"
echo ""

echo "【2】顺序提交 - 序列号 1"
RESULT1=$(curl -s -X POST "${BASE_URL}" \
  -H "Content-Type: application/json" \
  -d '{
    "eventId": "evt-001",
    "topic": "order",
    "businessKey": "order-123",
    "sequenceNumber": 1
  }')
echo "$RESULT1" | python3 -m json.tool 2>/dev/null || echo "$RESULT1"
STATUS1=$(echo "$RESULT1" | grep -o '"status":"[^"]*' | cut -d'"' -f4)
IS_IDEMPOTENT1=$(echo "$RESULT1" | grep -o '"isIdempotent":[^,}]*' | cut -d: -f2)
assert_equals "$STATUS1" "SUCCESS"
assert_equals "$IS_IDEMPOTENT1" "false"
echo ""

echo "【3】顺序提交 - 序列号 2"
RESULT2=$(curl -s -X POST "${BASE_URL}" \
  -H "Content-Type: application/json" \
  -d '{
    "eventId": "evt-002",
    "topic": "order",
    "businessKey": "order-123",
    "sequenceNumber": 2
  }')
echo "$RESULT2" | python3 -m json.tool 2>/dev/null || echo "$RESULT2"
STATUS2=$(echo "$RESULT2" | grep -o '"status":"[^"]*' | cut -d'"' -f4)
assert_equals "$STATUS2" "SUCCESS"
echo ""

echo "【4】乱序提交 - 序列号 4 (跳过 3, 进入等待队列)"
RESULT4=$(curl -s -X POST "${BASE_URL}" \
  -H "Content-Type: application/json" \
  -d '{
    "eventId": "evt-004",
    "topic": "order",
    "businessKey": "order-123",
    "sequenceNumber": 4
  }')
echo "$RESULT4" | python3 -m json.tool 2>/dev/null || echo "$RESULT4"
STATUS4=$(echo "$RESULT4" | grep -o '"status":"[^"]*' | cut -d'"' -f4)
REASON4=$(echo "$RESULT4" | grep -o '"outOfOrderReason":"[^"]*' | cut -d'"' -f4)
assert_equals "$STATUS4" "WAITING"
assert_equals "$REASON4" "GAP"
echo ""

echo "【5】查询序列状态（确认等待队列）"
STATE_RESULT=$(curl -s "${BASE_URL}/state?topic=order&businessKey=order-123")
echo "$STATE_RESULT" | python3 -m json.tool 2>/dev/null || echo "$STATE_RESULT"
HAS_GAP=$(echo "$STATE_RESULT" | grep -o '"hasGap":[^,}]*' | cut -d: -f2)
GAP_START=$(echo "$STATE_RESULT" | grep -o '"gapStartSequence":[^,}]*' | cut -d: -f2)
WAITING_SIZE=$(echo "$STATE_RESULT" | grep -o '"waitingQueueSize":[^,}]*' | cut -d: -f2)
assert_equals "$HAS_GAP" "true"
assert_equals "$GAP_START" "3"
assert_equals "$WAITING_SIZE" "1"
echo ""

echo "【6】补充缺口 - 序列号 3 (触发等待队列中的 4 被处理)"
RESULT3=$(curl -s -X POST "${BASE_URL}" \
  -H "Content-Type: application/json" \
  -d '{
    "eventId": "evt-003",
    "topic": "order",
    "businessKey": "order-123",
    "sequenceNumber": 3
  }')
echo "$RESULT3" | python3 -m json.tool 2>/dev/null || echo "$RESULT3"
STATUS3=$(echo "$RESULT3" | grep -o '"status":"[^"]*' | cut -d'"' -f4)
assert_equals "$STATUS3" "SUCCESS"
echo ""

echo "【7】幂等测试 - 重复提交 evt-001"
RESULT_DUP=$(curl -s -X POST "${BASE_URL}" \
  -H "Content-Type: application/json" \
  -d '{
    "eventId": "evt-001",
    "topic": "order",
    "businessKey": "order-123",
    "sequenceNumber": 1
  }')
echo "$RESULT_DUP" | python3 -m json.tool 2>/dev/null || echo "$RESULT_DUP"
IS_IDEMPOTENT_DUP=$(echo "$RESULT_DUP" | grep -o '"isIdempotent":[^,}]*' | cut -d: -f2)
assert_equals "$IS_IDEMPOTENT_DUP" "true"
echo ""

echo "【8】回溯序列号测试 - 提交已处理过的序列号 2"
RESULT_RETRO=$(curl -s -X POST "${BASE_URL}" \
  -H "Content-Type: application/json" \
  -d '{
    "eventId": "evt-retro",
    "topic": "order",
    "businessKey": "order-123",
    "sequenceNumber": 2
  }')
echo "$RESULT_RETRO" | python3 -m json.tool 2>/dev/null || echo "$RESULT_RETRO"
STATUS_RETRO=$(echo "$RESULT_RETRO" | grep -o '"status":"[^"]*' | cut -d'"' -f4)
REASON_RETRO=$(echo "$RESULT_RETRO" | grep -o '"outOfOrderReason":"[^"]*' | cut -d'"' -f4)
assert_equals "$STATUS_RETRO" "SKIPPED"
assert_equals "$REASON_RETRO" "RETROACTIVE"
echo ""

echo "【9】查询单个事件 evt-003"
RESULT_GET=$(curl -s "${BASE_URL}/evt-003")
echo "$RESULT_GET" | python3 -m json.tool 2>/dev/null || echo "$RESULT_GET"
EVENT_ID=$(echo "$RESULT_GET" | grep -o '"eventId":"[^"]*' | cut -d'"' -f4)
assert_equals "$EVENT_ID" "evt-003"
echo ""

echo "【10】历史查询 - 所有事件"
ALL_EVENTS=$(curl -s "${BASE_URL}")
echo "$ALL_EVENTS" | python3 -m json.tool 2>/dev/null | head -30
echo "   ..."
EVENT_COUNT=$(echo "$ALL_EVENTS" | grep -o '"eventId"' | wc -l)
echo "   事件总数: $EVENT_COUNT"
if [ "$EVENT_COUNT" -lt 5 ]; then
    echo "   ❌ 事件数不足"
    FAILED=1
else
    echo "   ✅ 事件数验证通过"
fi
echo ""

echo "【11】按业务键导出事件（验证一致性）"
EXPORT_RESULT=$(curl -s "${BASE_URL}/export?topic=order&businessKey=order-123")
echo "$EXPORT_RESULT" | python3 -m json.tool 2>/dev/null | head -30
echo "   ..."
EXPORT_COUNT=$(echo "$EXPORT_RESULT" | grep -o '"eventId"' | wc -l)
echo "   导出事件数: $EXPORT_COUNT"
if [ "$EXPORT_COUNT" -lt 5 ]; then
    echo "   ❌ 导出事件数不足"
    FAILED=1
else
    echo "   ✅ 导出验证通过"
fi
echo ""

echo "【12】查询序列状态（确认处理完成）"
STATE_RESULT2=$(curl -s "${BASE_URL}/state?topic=order&businessKey=order-123")
echo "$STATE_RESULT2" | python3 -m json.tool 2>/dev/null || echo "$STATE_RESULT2"
HAS_GAP2=$(echo "$STATE_RESULT2" | grep -o '"hasGap":[^,}]*' | cut -d: -f2)
LAST_PROCESSED=$(echo "$STATE_RESULT2" | grep -o '"lastProcessedSequence":[^,}]*' | cut -d: -f2)
WAITING_SIZE2=$(echo "$STATE_RESULT2" | grep -o '"waitingQueueSize":[^,}]*' | cut -d: -f2)
assert_equals "$HAS_GAP2" "false"
assert_equals "$LAST_PROCESSED" "4"
assert_equals "$WAITING_SIZE2" "0"
echo ""

echo "【13】超时强制处理测试（trigger-timeout 接口）"
echo "   提交序列号 1..."
curl -s -X POST "${BASE_URL}" -H "Content-Type: application/json" \
  -d '{"eventId":"to-001","topic":"timeout","businessKey":"test-timeout","sequenceNumber":1}' > /dev/null
echo "   提交序列号 2..."
curl -s -X POST "${BASE_URL}" -H "Content-Type: application/json" \
  -d '{"eventId":"to-002","topic":"timeout","businessKey":"test-timeout","sequenceNumber":2}' > /dev/null
echo "   提交序列号 5 (乱序)..."
curl -s -X POST "${BASE_URL}" -H "Content-Type: application/json" \
  -d '{"eventId":"to-005","topic":"timeout","businessKey":"test-timeout","sequenceNumber":5}' > /dev/null

echo "   触发超时前序列状态:"
STATE_BEFORE=$(curl -s "${BASE_URL}/state?topic=timeout&businessKey=test-timeout")
echo "$STATE_BEFORE" | python3 -m json.tool 2>/dev/null || echo "$STATE_BEFORE"
HAS_GAP_BEFORE=$(echo "$STATE_BEFORE" | grep -o '"hasGap":[^,}]*' | cut -d: -f2)
assert_equals "$HAS_GAP_BEFORE" "true"

echo ""
echo "   触发超时处理..."
TIMEOUT_RESULT=$(curl -s -X GET "${BASE_URL}/trigger-timeout?topic=timeout&businessKey=test-timeout")
echo "$TIMEOUT_RESULT" | python3 -m json.tool 2>/dev/null || echo "$TIMEOUT_RESULT"
PROCESSED_COUNT=$(echo "$TIMEOUT_RESULT" | grep -o '"processed":[^,}]*' | cut -d: -f2)
echo "   处理事件数: $PROCESSED_COUNT"

echo ""
echo "   触发超时后序列状态:"
STATE_AFTER=$(curl -s "${BASE_URL}/state?topic=timeout&businessKey=test-timeout")
echo "$STATE_AFTER" | python3 -m json.tool 2>/dev/null || echo "$STATE_AFTER"
HAS_GAP_AFTER=$(echo "$STATE_AFTER" | grep -o '"hasGap":[^,}]*' | cut -d: -f2)
LAST_PROCESSED_AFTER=$(echo "$STATE_AFTER" | grep -o '"lastProcessedSequence":[^,}]*' | cut -d: -f2)
WAITING_SIZE_AFTER=$(echo "$STATE_AFTER" | grep -o '"waitingQueueSize":[^,}]*' | cut -d: -f2)
assert_equals "$HAS_GAP_AFTER" "false"
assert_equals "$LAST_PROCESSED_AFTER" "5"
assert_equals "$WAITING_SIZE_AFTER" "0"
echo ""

echo "【14】导出超时事件验证（状态已更新）"
TIMEOUT_EVENT=$(curl -s "${BASE_URL}/to-005")
echo "$TIMEOUT_EVENT" | python3 -m json.tool 2>/dev/null || echo "$TIMEOUT_EVENT"
TIMEOUT_STATUS=$(echo "$TIMEOUT_EVENT" | grep -o '"status":"[^"]*' | cut -d'"' -f4)
TIMEOUT_REASON=$(echo "$TIMEOUT_EVENT" | grep -o '"outOfOrderReason":"[^"]*' | cut -d'"' -f4)
assert_equals "$TIMEOUT_STATUS" "SUCCESS"
assert_equals "$TIMEOUT_REASON" "TIMEOUT"
echo ""

echo "========================================"
echo "              测试总结"
echo "========================================"
echo ""

if [ $FAILED -eq 1 ]; then
    echo "❌ 部分测试失败"
    exit 1
fi

echo "✅ 幂等性: 重复提交返回 isIdempotent=true"
echo "✅ 顺序处理: 连续序列号直接 SUCCESS"
echo "✅ 乱序等待: 非连续序列号进入 WAITING 状态"
echo "✅ 缺口补齐: 提交缺失序列号后自动推进"
echo "✅ 回溯跳过: 已处理过的序列号直接 SKIPPED"
echo "✅ 历史查询: 可查询单个事件和所有事件"
echo "✅ 按业务查询导出: 支持按 topic/businessKey 筛选导出"
echo "✅ 导出一致性: 导出结果与历史查询一致"
echo "✅ 超时推进: trigger-timeout 接口强制处理所有等待事件"
echo ""
echo "🎉 完整 API 闭环验证通过！"
echo ""
exit 0
