#!/bin/bash

set -e

BASE_URL="http://localhost:8000/api/v1"

echo "======================================"
echo "     客服质检系统 - 功能演示"
echo "======================================"
echo ""

echo "检查服务状态..."
curl -s "$BASE_URL/health" | python3 -m json.tool
echo ""

echo "======================================"
echo "1. 导入敏感词表"
echo "======================================"
curl -s -X POST "$BASE_URL/import/sensitive-words" \
  -F "file=@tests/sensitive_words/sample_sensitive_words.txt" | python3 -m json.tool
echo ""

echo "查看已导入的敏感词..."
curl -s "$BASE_URL/sensitive-words" | python3 -m json.tool
echo ""

echo "======================================"
echo "2. 导入转写文本 - 通话1"
echo "======================================"
curl -s -X POST "$BASE_URL/import/transcription" \
  -F "file=@tests/transcriptions/call_001.txt" | python3 -m json.tool
echo ""

echo "======================================"
echo "3. 导入转写文本 - 通话2"
echo "======================================"
curl -s -X POST "$BASE_URL/import/transcription" \
  -F "file=@tests/transcriptions/call_002.txt" | python3 -m json.tool
echo ""

echo "======================================"
echo "4. 导入转写文本 - 通话3"
echo "======================================"
curl -s -X POST "$BASE_URL/import/transcription" \
  -F "file=@tests/transcriptions/call_003.txt" | python3 -m json.tool
echo ""

echo "======================================"
echo "5. 测试幂等性 - 重复导入通话1"
echo "======================================"
echo "（应该提示记录已存在，不会重复导入）"
curl -s -X POST "$BASE_URL/import/transcription" \
  -F "file=@tests/transcriptions/call_001.txt" | python3 -m json.tool
echo ""

echo "======================================"
echo "6. 查看所有质检记录"
echo "======================================"
curl -s "$BASE_URL/records" | python3 -m json.tool
echo ""

echo "======================================"
echo "7. 获取待复核问题列表"
echo "======================================"
PENDING_ISSUES=$(curl -s "$BASE_URL/issues/pending")
echo "$PENDING_ISSUES" | python3 -m json.tool
echo ""

echo "======================================"
echo "8. 标记问题状态（人工复核）"
echo "======================================"
FIRST_ISSUE_ID=$(echo "$PENDING_ISSUES" | python3 -c "import sys, json; data = json.load(sys.stdin); print(data[0]['issue_id'] if data else '')")
if [ -n "$FIRST_ISSUE_ID" ]; then
    echo "标记问题 $FIRST_ISSUE_ID 为已确认..."
    curl -s -X POST "$BASE_URL/issues/mark" \
      -H "Content-Type: application/json" \
      -d "{\"issue_id\": \"$FIRST_ISSUE_ID\", \"review_status\": \"confirmed\", \"reviewer\": \"质检组长\"}" | python3 -m json.tool
fi
echo ""

echo "======================================"
echo "9. 获取质检汇总统计"
echo "======================================"
curl -s "$BASE_URL/summary" | python3 -m json.tool
echo ""

echo "======================================"
echo "10. 导出质检结果为CSV"
echo "======================================"
curl -s -X POST "$BASE_URL/export" \
  -H "Content-Type: application/json" \
  -d '{"format": "csv", "include_masked": true}' > output.csv
echo "已导出到 output.csv"
head -10 output.csv
echo ""

echo "======================================"
echo "11. 查看坏记录列表"
echo "======================================"
curl -s "$BASE_URL/bad-records" | python3 -m json.tool
echo ""

echo "======================================"
echo "演示完成！"
echo "======================================"
echo ""
echo "注意：所有返回结果中的敏感字段（手机号、姓名等）已自动脱敏"
echo "API文档地址: http://localhost:8000/docs"
echo ""
