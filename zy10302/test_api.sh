#!/bin/bash
set -e

echo "=== 批量任务租约 API 测试脚本 ==="
echo ""

BASE_URL="http://localhost:8080"

# 检查服务是否运行
echo "1. 检查服务状态..."
if ! curl -s "$BASE_URL/tasks/list > /dev/null 2>&1; then
    echo "   服务未启动，请先运行: go run main.go"
    exit 1
fi
echo "   ✓ 服务运行正常"
echo ""

# 创建任务
echo "2. 创建测试任务..."
TASK_RESPONSE=$(curl -s -X POST "$BASE_URL/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "name": "test-data-processing",
    "payload": "{\"test\": true}",
    "priority": 10,
    "lease_timeout": 60,
    "max_retries": 3
  }')
TASK_ID=$(echo "$TASK_RESPONSE" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
echo "   ✓ 任务创建成功: $TASK_ID"
echo ""

# 列出任务
echo "3. 列出所有任务..."
curl -s "$BASE_URL/tasks/list" | head -c 200
echo ""
echo ""

# 领取租约
echo "4. worker-01 领取租约..."
LEASE_RESPONSE=$(curl -s -X POST "$BASE_URL/lease/acquire \
  -H "Content-Type: application/json" \
  -d "{
    \"task_id\": \"$TASK_ID\",
    \"holder_id\": \"worker-01\",
    \"holder_name\": \"Test Worker 1\"
  }")
LEASE_ID=$(echo "$LEASE_RESPONSE" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
echo "   ✓ 租约领取成功: $LEASE_ID"
echo ""

# 查看任务状态
echo "5. 查看任务状态..."
curl -s "$BASE_URL/tasks/$TASK_ID" | head -c 200
echo ""
echo ""

# worker-02 尝试领取（应该失败）
echo "6. worker-02 尝试领取同一任务（预期失败）..."
curl -s -X POST "$BASE_URL/lease/acquire \
  -H "Content-Type: application/json" \
  -d "{
    \"task_id\": \"$TASK_ID\",
    \"holder_id\": \"worker-02\",
    \"holder_name\": \"Test Worker 2\"
  }"
echo ""
echo ""

# 续约
echo "7. worker-01 续约..."
curl -s -X POST "$BASE_URL/lease/renew \
  -H "Content-Type: application/json" \
  -d "{
    \"lease_id\": \"$LEASE_ID\",
    \"holder_id\": \"worker-01\"
  }" | head -c 200
echo ""
echo ""

# 提交结果
echo "8. 提交执行结果..."
STARTED_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
curl -s -X POST "$BASE_URL/result/submit \
  -H "Content-Type: application/json" \
  -d "{
    \"task_id\": \"$TASK_ID\",
    \"lease_id\": \"$LEASE_ID\",
    \"holder_id\": \"worker-01\",
    \"status\": \"success\",
    \"result_data\": \"{\\\"processed\\\": 1000}\",
    \"started_at\": \"$STARTED_AT\"
  }" | head -c 300
echo ""
echo ""

# 重复提交（应该失败）
echo "9. 重复提交结果（预期失败）..."
curl -s -X POST "$BASE_URL/result/submit \
  -H "Content-Type: application/json" \
  -d "{
    \"task_id\": \"$TASK_ID\",
    \"lease_id\": \"$LEASE_ID\",
    \"holder_id\": \"worker-01\",
    \"status\": \"success\",
    \"result_data\": \"{\\\"processed\\\": 1000}\",
    \"started_at\": \"$STARTED_AT\"
  }"
echo ""
echo ""

# 查看时间线
echo "10. 查看任务时间线..."
curl -s "$BASE_URL/timeline/$TASK_ID"
echo ""
echo ""

# 导出诊断报告
echo "11. 导出诊断报告（文本格式）..."
curl -s "$BASE_URL/diagnostics/export?format=text
echo ""
echo ""

echo "=== 测试完成 ==="
echo ""
echo "查看更多 API 文档请参考 README.md"
