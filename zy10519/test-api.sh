#!/bin/bash

BASE_URL="http://localhost:3001/api/import"

echo "=========================================="
echo "       文件导入断点续传 API 测试"
echo "=========================================="
echo ""

# 1. 健康检查
echo "🔍 1. 健康检查..."
curl -s http://localhost:3001/health | jq .
echo ""

# 2. 创建导入任务
echo "📝 2. 创建导入任务..."
TASK_RESPONSE=$(curl -s -X POST $BASE_URL/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "fileName": "测试用户数据.xlsx",
    "fileSize": 1048576,
    "fileType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "totalRows": 50,
    "chunkSize": 10,
    "createdBy": "测试用户",
    "businessType": "测试批量导入",
    "description": "这是一个测试任务"
  }')

echo "$TASK_RESPONSE" | jq .
TASK_ID=$(echo "$TASK_RESPONSE" | jq -r '.data.taskId')
echo "任务ID: $TASK_ID"
echo ""

# 3. 获取分片信息
echo "📦 3. 获取分片信息..."
CHUNKS_RESPONSE=$(curl -s $BASE_URL/tasks/$TASK_ID/chunks)
echo "$CHUNKS_RESPONSE" | jq .
CHUNK_ID=$(echo "$CHUNKS_RESPONSE" | jq -r '.data[0].chunkId')
echo "第一个分片ID: $CHUNK_ID"
echo ""

# 4. 开始处理
echo "▶️ 4. 开始处理任务..."
curl -s -X POST $BASE_URL/tasks/$TASK_ID/process | jq .
echo ""

# 5. 处理第一个分片
echo "⚙️ 5. 处理第一个分片（1-10行）..."
ROWS_DATA='['
for i in $(seq 1 10); do
  ROWS_DATA="$ROWS_DATA{\"rowNumber\": $i, \"rowData\": \"{\\\"name\\\":\\\"用户$i\\\",\\\"email\\\":\\\"user$i@example.com\\\"}\"}"
  if [ $i -lt 10 ]; then
    ROWS_DATA="$ROWS_DATA,"
  fi
done
ROWS_DATA="$ROWS_DATA]"

curl -s -X POST $BASE_URL/tasks/$TASK_ID/chunks/$CHUNK_ID/process \
  -H "Content-Type: application/json" \
  -d "{\"rowsData\": $ROWS_DATA}" | jq .
echo ""

# 6. 获取成功明细
echo "✅ 6. 获取成功明细..."
curl -s $BASE_URL/tasks/$TASK_ID/successes | jq .
echo ""

# 7. 获取失败明细
echo "❌ 7. 获取失败明细..."
curl -s $BASE_URL/tasks/$TASK_ID/failures | jq .
echo ""

# 8. 获取续传摘要
echo "📋 8. 获取续传摘要..."
curl -s $BASE_URL/tasks/$TASK_ID/resume-summary | jq .
echo ""

# 9. 导出业务数据
echo "📊 9. 导出业务数据（业务友好格式）..."
curl -s $BASE_URL/tasks/$TASK_ID/export | jq .
echo ""

# 10. 续传任务
echo "🔄 10. 续传任务..."
curl -s -X POST $BASE_URL/tasks/$TASK_ID/resume | jq .
echo ""

echo "=========================================="
echo "            测试完成！"
echo "=========================================="
echo ""
echo "📌 提示："
echo "   - 第10行应该处理失败（模拟10%失败率）"
echo "   - 可以调用人工修正接口修正失败记录"
echo "   - 查看 API_USAGE.md 了解更多接口详情"
