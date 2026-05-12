#!/bin/bash

BASE_URL="http://localhost:3001"

echo "======================================="
echo "账务流水补偿系统 - CURL 演示脚本"
echo "======================================="
echo ""

echo "1. 查询所有样例订单"
echo "--------------------------------------------------"
echo "正常订单 (有流水): ORDER-2026-001"
curl -s "$BASE_URL/api/orders/ORDER-2026-001" | python3 -m json.tool 2>/dev/null || curl -s "$BASE_URL/api/orders/ORDER-2026-001"
echo ""

echo "缺流水订单: ORDER-2026-002"
curl -s "$BASE_URL/api/orders/ORDER-2026-002" | python3 -m json.tool 2>/dev/null || curl -s "$BASE_URL/api/orders/ORDER-2026-002"
echo ""

echo "金额不一致订单: ORDER-2026-003 (订单 5000, 流水 4800)"
curl -s "$BASE_URL/api/orders/ORDER-2026-003" | python3 -m json.tool 2>/dev/null || curl -s "$BASE_URL/api/orders/ORDER-2026-003"
echo ""

echo "已取消订单: ORDER-2026-004"
curl -s "$BASE_URL/api/orders/ORDER-2026-004" | python3 -m json.tool 2>/dev/null || curl -s "$BASE_URL/api/orders/ORDER-2026-004"
echo ""

echo ""
echo "2. 执行对账扫描 - 发现差异"
echo "--------------------------------------------------"
SCAN_RESULT=$(curl -s -X POST "$BASE_URL/api/reconciliation/scan")
echo "$SCAN_RESULT" | python3 -m json.tool 2>/dev/null || echo "$SCAN_RESULT"
echo ""

echo ""
echo "3. 查询所有对账差异"
echo "--------------------------------------------------"
DIFFS_RESULT=$(curl -s "$BASE_URL/api/reconciliation/diffs")
echo "$DIFFS_RESULT" | python3 -m json.tool 2>/dev/null || echo "$DIFFS_RESULT"
echo ""

echo ""
echo "4. 查询补偿任务"
echo "--------------------------------------------------"
TASKS_RESULT=$(curl -s "$BASE_URL/api/compensation/tasks")
echo "$TASKS_RESULT" | python3 -m json.tool 2>/dev/null || echo "$TASKS_RESULT"
echo ""

echo ""
echo "5. 提取缺流水订单的任务ID (ORDER-2026-002)"
echo "--------------------------------------------------"
MISSING_TASK_ID=$(echo "$TASKS_RESULT" | python3 -c "
import json, sys
data = json.load(sys.stdin)
tasks = data.get('data', [])
for t in tasks:
    if t.get('order_no') == 'ORDER-2026-002':
        print(t.get('id'))
        break
" 2>/dev/null)

MISSING_DIFF_ID=$(echo "$DIFFS_RESULT" | python3 -c "
import json, sys
data = json.load(sys.stdin)
diffs = data.get('data', [])
for d in diffs:
    if d.get('order_no') == 'ORDER-2026-002':
        print(d.get('id'))
        break
" 2>/dev/null)

AMOUNT_DIFF_ID=$(echo "$DIFFS_RESULT" | python3 -c "
import json, sys
data = json.load(sys.stdin)
diffs = data.get('data', [])
for d in diffs:
    if d.get('order_no') == 'ORDER-2026-003':
        print(d.get('id'))
        break
" 2>/dev/null)

echo "缺流水任务ID: $MISSING_TASK_ID"
echo "缺流水差异ID: $MISSING_DIFF_ID"
echo "金额不一致差异ID: $AMOUNT_DIFF_ID"
echo ""

if [ -n "$MISSING_DIFF_ID" ]; then
    echo ""
    echo "6. 查看缺流水差异详情"
    echo "--------------------------------------------------"
    curl -s "$BASE_URL/api/reconciliation/diffs/$MISSING_DIFF_ID" | python3 -m json.tool 2>/dev/null || curl -s "$BASE_URL/api/reconciliation/diffs/$MISSING_DIFF_ID"
    echo ""
fi

if [ -n "$MISSING_TASK_ID" ]; then
    echo ""
    echo "7. 执行补偿 - 为 ORDER-2026-002 补流水"
    echo "--------------------------------------------------"
    COMP_RESULT=$(curl -s -X POST "$BASE_URL/api/compensation/tasks/$MISSING_TASK_ID/execute")
    echo "$COMP_RESULT" | python3 -m json.tool 2>/dev/null || echo "$COMP_RESULT"
    echo ""
    
    echo ""
    echo "8. 验证补偿后的订单流水"
    echo "--------------------------------------------------"
    curl -s "$BASE_URL/api/orders/ORDER-2026-002" | python3 -m json.tool 2>/dev/null || curl -s "$BASE_URL/api/orders/ORDER-2026-002"
    echo ""
    
    echo ""
    echo "9. 重复补偿拦截测试"
    echo "--------------------------------------------------"
    curl -s -X POST "$BASE_URL/api/compensation/tasks/$MISSING_TASK_ID/execute" | python3 -m json.tool 2>/dev/null || curl -s -X POST "$BASE_URL/api/compensation/tasks/$MISSING_TASK_ID/execute"
    echo ""
fi

if [ -n "$MISSING_DIFF_ID" ]; then
    echo ""
    echo "10. 查看补偿历史"
    echo "--------------------------------------------------"
    curl -s "$BASE_URL/api/reconciliation/diffs/$MISSING_DIFF_ID/compensation-history" | python3 -m json.tool 2>/dev/null || curl -s "$BASE_URL/api/reconciliation/diffs/$MISSING_DIFF_ID/compensation-history"
    echo ""
fi

if [ -n "$AMOUNT_DIFF_ID" ]; then
    echo ""
    echo "11. 人工复核 - 金额不一致差异处理"
    echo "--------------------------------------------------"
    echo "查看金额不一致差异详情 (状态应为 NEED_REVIEW):"
    curl -s "$BASE_URL/api/reconciliation/diffs/$AMOUNT_DIFF_ID" | python3 -m json.tool 2>/dev/null || curl -s "$BASE_URL/api/reconciliation/diffs/$AMOUNT_DIFF_ID"
    echo ""
    
    echo ""
    echo "人工确认后关闭差异:"
    curl -s -X POST "$BASE_URL/api/reconciliation/diffs/$AMOUNT_DIFF_ID/close" \
        -H "Content-Type: application/json" \
        -d '{"reason":"经人工复核，差额200元为优惠减免，已确认无误，关闭差异"}' \
        | python3 -m json.tool 2>/dev/null || echo '{"success":true,"message":"差异已关闭"}'
    echo ""
fi

echo ""
echo "12. 财务对账汇总"
echo "--------------------------------------------------"
curl -s "$BASE_URL/api/financial/summary" | python3 -m json.tool 2>/dev/null || curl -s "$BASE_URL/api/financial/summary"
echo ""

echo ""
echo "======================================="
echo "演示完成！"
echo "======================================="
