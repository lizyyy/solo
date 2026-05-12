#!/bin/bash

BASE_URL="http://localhost:3000/api/archive"

echo "========================================="
echo "归档任务保留策略 API - 测试脚本"
echo "========================================="
echo ""

echo "=== [场景 0] 健康检查 ==="
curl -s "$BASE_URL/health" | python3 -m json.tool
echo ""

echo "=== [场景 0] 查看保留策略 ==="
curl -s "$BASE_URL/policies" | python3 -m json.tool
echo ""

echo "=== [场景 0] 查看冻结名单 ==="
curl -s "$BASE_URL/freezes" | python3 -m json.tool
echo ""

echo "========================================="
echo "=== 场景 1: 可归档数据（订单压缩）==="
echo "========================================="
echo ""
echo "创建订单压缩任务（数据范围: 3年前）"
ORDERS_RANGE_START=$(date -v-3y +%s000)
ORDERS_RANGE_END=$(date -v-2y +%s000)
echo "日期范围: $ORDERS_RANGE_START 到 $ORDERS_RANGE_END"

CREATE_ORDER_TASK=$(curl -s -X POST "$BASE_URL/tasks" \
  -H "Content-Type: application/json" \
  -d '{
    "dataType": "order",
    "dateRangeStart": '"$ORDERS_RANGE_START"',
    "dateRangeEnd": '"$ORDERS_RANGE_END"',
    "operationType": "compress",
    "operator": "系统管理员-张三"
  }')

echo ""
echo "任务创建结果:"
echo "$CREATE_ORDER_TASK" | python3 -m json.tool

ORDER_TASK_ID=$(echo "$CREATE_ORDER_TASK" | python3 -c "import sys,json; print(json.load(sys.stdin)['taskId'])")
echo ""
echo "任务ID: $ORDER_TASK_ID"

echo ""
echo "执行订单压缩任务:"
curl -s -X POST "$BASE_URL/tasks/$ORDER_TASK_ID/execute" \
  -H "Content-Type: application/json" \
  -d '{}' | python3 -m json.tool

echo ""
echo "查看任务详情（含影响范围、处理数量、保留原因、归档证明）:"
curl -s "$BASE_URL/tasks/$ORDER_TASK_ID" | python3 -m json.tool

echo ""
echo "检查记录状态 - ORD-2022-001 (应已压缩归档):"
curl -s "$BASE_URL/record-status/order/ORD-2022-001" | python3 -m json.tool

echo ""
echo "检查记录状态 - ORD-2022-002 (被法律冻结，只能压缩不能删除):"
curl -s "$BASE_URL/record-status/order/ORD-2022-002" | python3 -m json.tool

echo ""
echo "========================================="
echo "=== 场景 2: 冻结数据保留（工单）==="
echo "========================================="
echo ""
echo "创建工单删除任务（数据范围: 3年前）"
TICKETS_RANGE_START=$(date -v-3y +%s000)
TICKETS_RANGE_END=$(date -v-1y +%s000)

CREATE_TICKET_TASK=$(curl -s -X POST "$BASE_URL/tasks" \
  -H "Content-Type: application/json" \
  -d '{
    "dataType": "ticket",
    "dateRangeStart": '"$TICKETS_RANGE_START"',
    "dateRangeEnd": '"$TICKETS_RANGE_END"',
    "operationType": "delete",
    "operator": "运维-李四"
  }')

TICKET_TASK_ID=$(echo "$CREATE_TICKET_TASK" | python3 -c "import sys,json; print(json.load(sys.stdin)['taskId'])")
echo "任务ID: $TICKET_TASK_ID"

echo ""
echo "执行工单删除任务:"
curl -s -X POST "$BASE_URL/tasks/$TICKET_TASK_ID/execute" \
  -H "Content-Type: application/json" \
  -d '{}' | python3 -m json.tool

echo ""
echo "查看任务详情:"
curl -s "$BASE_URL/tasks/$TICKET_TASK_ID" | python3 -m json.tool

echo ""
echo "检查 TKT-2022-001 状态 (应已删除):"
curl -s "$BASE_URL/record-status/ticket/TKT-2022-001" | python3 -m json.tool

echo ""
echo "检查 TKT-2022-002 状态 (被合规审查冻结，压缩保留未删除):"
curl -s "$BASE_URL/record-status/ticket/TKT-2022-002" | python3 -m json.tool

echo ""
echo "========================================="
echo "=== 场景 3: 恢复申请和审批 ==="
echo "========================================="
echo ""
echo "创建恢复申请（恢复被压缩冻结的 ORD-2022-002）:"
CREATE_RECOVERY=$(curl -s -X POST "$BASE_URL/recovery-requests" \
  -H "Content-Type: application/json" \
  -d '{
    "dataType": "order",
    "recordIds": ["ORD-2022-002"],
    "reason": "客户需要查询历史订单详情用于退税",
    "operator": "客服-王五"
  }')

RECOVERY_ID=$(echo "$CREATE_RECOVERY" | python3 -c "import sys,json; print(json.load(sys.stdin)['requestId'])")
echo "恢复申请ID: $RECOVERY_ID"
echo "$CREATE_RECOVERY" | python3 -m json.tool

echo ""
echo "审批前检查记录状态:"
curl -s "$BASE_URL/record-status/order/ORD-2022-002" | python3 -m json.tool

echo ""
echo "审批恢复申请:"
APPROVE_RESULT=$(curl -s -X POST "$BASE_URL/recovery-requests/$RECOVERY_ID/approve" \
  -H "Content-Type: application/json" \
  -d '{
    "approved": true,
    "approver": "合规经理-赵六",
    "comment": "同意恢复，客户需求合理"
  }')

echo "$APPROVE_RESULT" | python3 -m json.tool

echo ""
echo "审批后检查记录状态（应从归档位置恢复到业务可查）:"
curl -s "$BASE_URL/record-status/order/ORD-2022-002" | python3 -m json.tool

echo ""
echo "========================================="
echo "=== 场景 4: 删除失败重试（消息记录）==="
echo "========================================="
echo ""
echo "创建消息删除任务:"
MESSAGES_RANGE_START=$(date -v-3y +%s000)
MESSAGES_RANGE_END=$(date -v-1y +%s000)

CREATE_MSG_TASK=$(curl -s -X POST "$BASE_URL/tasks" \
  -H "Content-Type: application/json" \
  -d '{
    "dataType": "message",
    "dateRangeStart": '"$MESSAGES_RANGE_START"',
    "dateRangeEnd": '"$MESSAGES_RANGE_END"',
    "operationType": "delete",
    "operator": "运维-李四"
  }')

MSG_TASK_ID=$(echo "$CREATE_MSG_TASK" | python3 -c "import sys,json; print(json.load(sys.stdin)['taskId'])")
echo "消息任务ID: $MSG_TASK_ID"

echo ""
echo "执行任务（模拟失败 - 存储服务不可用）:"
curl -s -X POST "$BASE_URL/tasks/$MSG_TASK_ID/execute" \
  -H "Content-Type: application/json" \
  -d '{"simulateFailure": true}' | python3 -m json.tool

echo ""
echo "检查失败后任务状态:"
curl -s "$BASE_URL/tasks/$MSG_TASK_ID" | python3 -m json.tool

echo ""
echo "重试失败任务:"
curl -s -X POST "$BASE_URL/tasks/$MSG_TASK_ID/retry" \
  -H "Content-Type: application/json" \
  -d '{}' | python3 -m json.tool

echo ""
echo "检查重试后任务状态:"
curl -s "$BASE_URL/tasks/$MSG_TASK_ID" | python3 -m json.tool

echo ""
echo "检查消息 MSG-2022-001 状态（应已删除）:"
curl -s "$BASE_URL/record-status/message/MSG-2022-001" | python3 -m json.tool

echo ""
echo "========================================="
echo "=== 场景 5: 幂等性（重复创建订单压缩任务）==="
echo "========================================="
echo ""
echo "再次创建相同范围的订单压缩任务（应返回已存在任务）:"
curl -s -X POST "$BASE_URL/tasks" \
  -H "Content-Type: application/json" \
  -d '{
    "dataType": "order",
    "dateRangeStart": '"$ORDERS_RANGE_START"',
    "dateRangeEnd": '"$ORDERS_RANGE_END"',
    "operationType": "compress",
    "operator": "系统管理员-张三"
  }' | python3 -m json.tool

echo ""
echo "========================================="
echo "=== 归档报告查询 ==="
echo "========================================="
echo ""
curl -s "$BASE_URL/report" | python3 -m json.tool

echo ""
echo "========================================="
echo "=== 审计日志 ==="
echo "========================================="
echo ""
curl -s "$BASE_URL/audit-logs" | python3 -m json.tool

echo ""
echo "========================================="
echo "测试脚本执行完成"
echo "========================================="
