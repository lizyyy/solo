#!/bin/bash

echo "=== 测试对账复核修复 ==="
echo ""

echo "1. 批量导入示例数据"
BATCH_RESULT=$(curl -s -X POST http://localhost:3000/api/import/batch \
  -F "maintenance=@samples/maintenance.csv" \
  -F "sensor=@samples/sensor.json" \
  -F "approval=@samples/approval.csv")

echo "$BATCH_RESULT" | jq .
BATCH_ID=$(echo "$BATCH_RESULT" | jq -r '.data.batchId')
echo "Batch ID: $BATCH_ID"
echo ""

echo "2. 执行对账"
REC_RESULT=$(curl -s -X POST "http://localhost:3000/api/reconciliation/$BATCH_ID")
echo "$REC_RESULT" | jq '.data | {totalCableCars, passedCount, failedCount, summary}'
RESULT_ID=$(echo "$REC_RESULT" | jq -r '.data.id')
echo "Result ID: $RESULT_ID"
echo ""

echo "3. 查看所有差异ID"
DIFF_IDS=$(echo "$REC_RESULT" | jq -r '.data.diffs[].id')
echo "差异总数: $(echo "$DIFF_IDS" | wc -l | tr -d ' ')"
echo "高严重程度差异: $(echo "$REC_RESULT" | jq '.data.diffs | map(select(.severity=="high")) | length')"
echo ""

echo "4. 将所有高严重程度差异标记为 resolved"
HIGH_DIFF_IDS=$(echo "$REC_RESULT" | jq -r '.data.diffs[] | select(.severity=="high") | .id')
COUNT=1
for DIFF_ID in $HIGH_DIFF_IDS; do
  echo "  复核差异 $COUNT: $DIFF_ID"
  curl -s -X POST "http://localhost:3000/api/review/$RESULT_ID/diff/$DIFF_ID" \
    -H "Content-Type: application/json" \
    -d '{"reviewer":"测试员","action":"resolve","notes":"已修复问题"}' > /dev/null
  COUNT=$((COUNT + 1))
done
echo ""

echo "5. 重新计算汇总"
RECALC_RESULT=$(curl -s -X POST "http://localhost:3000/api/reconciliation/$RESULT_ID/recalculate")
echo "$RECALC_RESULT" | jq '.data | {totalCableCars, passedCount, failedCount, summary}'
echo ""

echo "6. 验证汇总数据是否同步更新"
echo "   预期结果: totalDiffs 应减少，high 应变为 0，passRate 应变为 100%"
echo ""

echo "7. 生成报告验证"
REPORT_RESULT=$(curl -s -X POST http://localhost:3000/api/report \
  -H "Content-Type: application/json" \
  -d "{\"batchId\":\"$BATCH_ID\",\"resultId\":\"$RESULT_ID\",\"generatedBy\":\"测试员\"}")
echo "$REPORT_RESULT" | jq '.data | {summary}'
echo ""

echo "=== 测试完成 ==="
