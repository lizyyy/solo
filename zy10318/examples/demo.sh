#!/bin/bash

BASE_URL="http://localhost:8080/api/v1"

echo "=== 接口流量镜像控制器 - 使用示例 ==="
echo ""

echo "1. 健康检查"
curl -s "${BASE_URL}/../health" | jq .
echo ""

echo "2. 创建目标环境 - 测试环境A"
TARGET_A=$(curl -s -X POST "${BASE_URL}/targets" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "测试环境A",
    "base_url": "https://jsonplaceholder.typicode.com",
    "auth_type": "Bearer",
    "auth_token": "test-token-123",
    "timeout_sec": 30,
    "enabled": true
  }')
echo "$TARGET_A" | jq .
TARGET_A_ID=$(echo "$TARGET_A" | jq -r '.data.id')
echo ""

echo "3. 创建目标环境 - 测试环境B"
TARGET_B=$(curl -s -X POST "${BASE_URL}/targets" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "测试环境B",
    "base_url": "https://jsonplaceholder.typicode.com",
    "timeout_sec": 30,
    "enabled": true
  }')
echo "$TARGET_B" | jq .
TARGET_B_ID=$(echo "$TARGET_B" | jq -r '.data.id')
echo ""

echo "4. 查看所有目标环境"
curl -s "${BASE_URL}/targets" | jq .
echo ""

echo "5. 创建镜像规则（幂等测试 - 第一次）"
IDEMPOTENCY_KEY="rule-$(date +%s)-001"
RULE1=$(curl -s -X POST "${BASE_URL}/rules" \
  -H "Content-Type: application/json" \
  -d "{
    \"idempotency_key\": \"${IDEMPOTENCY_KEY}\",
    \"name\": \"用户接口镜像规则\",
    \"description\": \"镜像用户相关接口到测试环境进行验证\",
    \"source_path\": \"/api/users\",
    \"source_method\": \"POST\",
    \"sample_rate\": 1.0,
    \"targets\": [\"${TARGET_A_ID}\", \"${TARGET_B_ID}\"],
    \"masking_fields\": [
      {
        \"field_path\": \"password\",
        \"mask_type\": \"REDACT\"
      },
      {
        \"field_path\": \"phone\",
        \"mask_type\": \"MASK\"
      }
    ],
    \"compare_mode\": true,
    \"created_by\": \"admin\"
  }")
echo "$RULE1" | jq .
RULE_ID=$(echo "$RULE1" | jq -r '.data.id')
echo ""

echo "6. 重复提交相同的幂等键 - 验证不会重复创建"
RULE2=$(curl -s -X POST "${BASE_URL}/rules" \
  -H "Content-Type: application/json" \
  -d "{
    \"idempotency_key\": \"${IDEMPOTENCY_KEY}\",
    \"name\": \"用户接口镜像规则\",
    \"description\": \"镜像用户相关接口到测试环境进行验证\",
    \"source_path\": \"/api/users\",
    \"source_method\": \"POST\",
    \"sample_rate\": 1.0,
    \"targets\": [\"${TARGET_A_ID}\", \"${TARGET_B_ID}\"],
    \"compare_mode\": true,
    \"created_by\": \"admin\"
  }")
echo "$RULE2" | jq .
echo ""

echo "7. 查看所有镜像规则"
curl -s "${BASE_URL}/rules" | jq .
echo ""

echo "8. 查看单个镜像规则详情"
curl -s "${BASE_URL}/rules/${RULE_ID}" | jq .
echo ""

echo "9. 更新规则状态为 ACTIVE"
curl -s -X PATCH "${BASE_URL}/rules/${RULE_ID}/status" \
  -H "Content-Type: application/json" \
  -d '{"status": "ACTIVE"}' | jq .
echo ""

echo "10. 提交请求进行镜像"
curl -s -X POST "${BASE_URL}/copies/submit" \
  -H "Content-Type: application/json" \
  -d "{
    \"rule_id\": \"${RULE_ID}\",
    \"trace_id\": \"trace-$(date +%s)-001\",
    \"method\": \"POST\",
    \"url\": \"https://jsonplaceholder.typicode.com/posts\",
    \"headers\": {
      \"Content-Type\": \"application/json\",
      \"Authorization\": \"Bearer test\"
    },
    \"body\": \"{\\\"title\\\":\\\"test\\\",\\\"body\\\":\\\"bar\\\",\\\"userId\\\":1,\\\"password\\\":\\\"secret123\\\",\\\"phone\\\":\\\"13800138000\\\"}\"
  }" | jq .
echo ""

echo "11. 等待异步处理..."
sleep 3
echo ""

echo "12. 查看请求副本列表"
curl -s "${BASE_URL}/copies?rule_id=${RULE_ID}" | jq .
echo ""

echo "13. 查看比对结果"
curl -s "${BASE_URL}/results?rule_id=${RULE_ID}" | jq .
echo ""

echo "14. 按状态筛选规则"
curl -s "${BASE_URL}/rules?status=ACTIVE" | jq .
echo ""

echo "=== 测试完成 ==="
echo ""
echo "常用查询参数:"
echo "- 分页: page, page_size"
echo "- 筛选: status, rule_id, trace_id"
echo ""
echo "状态说明:"
echo "- DRAFT: 草稿"
echo "- ACTIVE: 激活"
echo "- PAUSED: 暂停"
echo "- DISABLED: 禁用"
