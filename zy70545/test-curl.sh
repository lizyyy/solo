#!/bin/bash

BASE_URL="http://localhost:3000/api"

echo "=== 用户数据导入审计服务测试 ==="
echo ""

echo "1. 健康检查"
curl -s http://localhost:3000/health
echo ""
echo ""

echo "2. 创建导入批次"
BATCH_RESPONSE=$(curl -s -X POST "$BASE_URL/batches" \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "admin",
    "source": "运营批量导入",
    "fileName": "users_20240520.csv",
    "fileHash": "abc123def456",
    "totalRows": 3,
    "rows": [
      {"name": "张三", "email": "zhang@example.com", "phone": "13800138001"},
      {"name": "李四", "email": "li@example.com", "phone": "13800138002"},
      {"name": "王五", "email": "wang@example", "phone": "invalid-phone"}
    ]
  }')

echo $BATCH_RESPONSE
BATCH_ID=$(echo $BATCH_RESPONSE | grep -o '"batchId":"[^"]*' | cut -d'"' -f4)
echo "批次ID: $BATCH_ID"
echo ""
echo ""

echo "3. 重复提交同一文件（测试幂等性）"
curl -s -X POST "$BASE_URL/batches" \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "admin",
    "source": "运营批量导入",
    "fileName": "users_20240520.csv",
    "fileHash": "abc123def456",
    "totalRows": 3
  }'
echo ""
echo ""

echo "4. 查询批次列表"
curl -s "$BASE_URL/batches"
echo ""
echo ""

echo "5. 查询批次详情"
curl -s "$BASE_URL/batches/$BATCH_ID"
echo ""
echo ""

echo "6. 更新批次状态为处理中"
curl -s -X PATCH "$BASE_URL/batches/$BATCH_ID/status" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "PROCESSING",
    "operator": "system",
    "note": "开始处理数据"
  }'
echo ""
echo ""

echo "7. 查询批次原始行"
ROWS_RESPONSE=$(curl -s "$BASE_URL/batches/$BATCH_ID/rows")
echo $ROWS_RESPONSE
ROW1_ID=$(echo $ROWS_RESPONSE | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
ROW2_ID=$(echo $ROWS_RESPONSE | grep -o '"id":"[^"]*' | head -2 | tail -1 | cut -d'"' -f4)
ROW3_ID=$(echo $ROWS_RESPONSE | grep -o '"id":"[^"]*' | head -3 | tail -1 | cut -d'"' -f4)
echo "行1 ID: $ROW1_ID"
echo "行2 ID: $ROW2_ID"
echo "行3 ID: $ROW3_ID"
echo ""
echo ""

echo "8. 人工修正第3行的邮箱"
curl -s -X POST "$BASE_URL/batches/$BATCH_ID/rows/$ROW3_ID/correct" \
  -H "Content-Type: application/json" \
  -d '{
    "fieldName": "email",
    "oldValue": "wang@example",
    "newValue": "wang@example.com",
    "operator": "editor",
    "reason": "邮箱格式错误，修正域名"
  }'
echo ""
echo ""

echo "9. 添加冲突记录 - 手机号重复"
CONFLICT_RESPONSE=$(curl -s -X POST "$BASE_URL/batches/$BATCH_ID/conflicts" \
  -H "Content-Type: application/json" \
  -d '{
    "rowId": "'"$ROW2_ID"'",
    "type": "DUPLICATE_PHONE",
    "fieldName": "phone",
    "currentValue": "13900139002",
    "newValue": "13800138002",
    "message": "手机号与现有用户冲突"
  }')
echo $CONFLICT_RESPONSE
CONFLICT_ID=$(echo $CONFLICT_RESPONSE | grep -o '"conflictId":"[^"]*' | cut -d'"' -f4)
echo "冲突ID: $CONFLICT_ID"
echo ""
echo ""

echo "10. 查询批次冲突列表"
curl -s "$BASE_URL/batches/$BATCH_ID/conflicts"
echo ""
echo ""

echo "11. 裁决冲突 - 使用新值"
curl -s -X PATCH "$BASE_URL/conflicts/$CONFLICT_ID/resolve" \
  -H "Content-Type: application/json" \
  -d '{
    "resolution": "USE_NEW",
    "operator": "manager"
  }'
echo ""
echo ""

echo "12. 处理批次"
curl -s -X POST "$BASE_URL/batches/$BATCH_ID/process" \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "system"
  }'
echo ""
echo ""

echo "13. 查看单行完整信息（含修正和冲突）"
curl -s "$BASE_URL/batches/$BATCH_ID/rows/$ROW3_ID"
echo ""
echo ""

echo "14. 查看所有修正记录"
curl -s "$BASE_URL/batches/$BATCH_ID/corrections"
echo ""
echo ""

echo "15. 导出审计报告"
curl -s "$BASE_URL/batches/$BATCH_ID/report"
echo ""
echo ""

echo "16. 导出审计报告为文件（添加 ?export=json 参数）"
curl -s "$BASE_URL/batches/$BATCH_ID/report?export=json" -o "audit-report.json"
echo "报告已保存至 audit-report.json"
echo ""
echo ""

echo "=== 测试完成 ==="
echo "批次ID: $BATCH_ID"
echo "查看报告详情: curl $BASE_URL/batches/$BATCH_ID/report"
