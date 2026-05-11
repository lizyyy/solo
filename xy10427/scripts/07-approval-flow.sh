#!/bin/bash

BASE_URL="http://localhost:3000"
BATCH_ID=$(cat /tmp/meal_subsidy_batch_id.txt 2>/dev/null || echo "")

if [ -z "$BATCH_ID" ]; then
  echo "请先执行 05-calculate.sh"
  exit 1
fi

echo "=== 获取待复核的计算记录 ==="
echo "Batch ID: $BATCH_ID"
echo ""

ABNORMALS=$(curl -s "$BASE_URL/api/abnormals/$BATCH_ID")
echo "$ABNORMALS" | python3 -m json.tool

echo ""
echo ""

echo "=== 查询计算记录获取 calculationId ==="
SUMMARY=$(curl -s "$BASE_URL/api/summary/$BATCH_ID")
echo "$SUMMARY"

echo ""
echo ""

echo "=== 流程说明 ==="
echo "1. E003 王五有重复刷卡异常 - 可以 approve（确认异常）或 adjust（人工调整）"
echo "2. E004 赵六有非工作日消费异常 - 需要人工确认"
echo ""

echo "=== 请使用以下接口进行复核 ==="
echo ""
echo "示例：审批通过"
echo 'curl -X POST "$BASE_URL/api/approval" \'
echo '  -H "Content-Type: application/json" \'
echo '  -d '{
    "calculationId": "<从summary中获取>",
    "operator": "admin",
    "action": "approve",
    "reason": "经核实，重复刷卡为误操作，实际只消费一次"
  }'

echo ""
echo "示例：人工调整金额"
echo 'curl -X POST "$BASE_URL/api/approval" \'
echo '  -H "Content-Type: application/json" \'
echo '  -d '{
    "calculationId": "<从summary中获取>",
    "operator": "admin",
    "action": "adjust",
    "newAmount": 15,
    "reason": "非工作日确认为加班，按一半标准补贴"
  }'

echo ""
echo "示例：拒绝"
echo 'curl -X POST "$BASE_URL/api/approval" \'
echo '  -H "Content-Type: application/json" \'
echo '  -d '{
    "calculationId": "<从summary中获取>",
    "operator": "admin",
    "action": "reject",
    "reason": "非工作日，不予补贴"
  }'

echo ""
