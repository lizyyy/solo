#!/bin/bash

BASE_URL="http://localhost:8080/api/v1"

echo "======================================"
echo "  作业结果签名 API 自检脚本"
echo "======================================"
echo ""

echo "[1/8] 检查服务健康状态..."
curl -s -X GET "$BASE_URL/health" | jq .
echo ""

echo "[2/8] 创建消费方..."
CONSUMER_RESP=$(curl -s -X POST "$BASE_URL/consumers" -H "Content-Type: application/json" -d '{"name": "test-consumer"}')
echo $CONSUMER_RESP | jq .
CONSUMER_ID=$(echo $CONSUMER_RESP | jq -r '.id')
echo "消费方 ID: $CONSUMER_ID"
echo ""

BATCH_NO="BATCH-$(date +%Y%m%d%H%M%S)"
echo "[3/8] 创建作业批次 (BatchNo: $BATCH_NO)..."
BATCH_RESP=$(curl -s -X POST "$BASE_URL/batches" -H "Content-Type: application/json" -d "{
  \"batch_no\": \"$BATCH_NO\",
  \"creator\": \"api-tester\",
  \"expire_days\": 3,
  \"files\": [
    {\"file_name\": \"result_20240101_01.txt\", \"file_hash\": \"abc123def456\", \"file_size\": 1024},
    {\"file_name\": \"result_20240101_02.txt\", \"file_hash\": \"xyz789uvw012\", \"file_size\": 2048}
  ]
}")
echo $BATCH_RESP | jq .
BATCH_ID=$(echo $BATCH_RESP | jq -r '.batch_id')
echo "批次 ID: $BATCH_ID"
echo ""

echo "[4/8] 重复提交相同批次号（预期返回 409 冲突）..."
curl -s -X POST "$BASE_URL/batches" -H "Content-Type: application/json" -d "{
  \"batch_no\": \"$BATCH_NO\",
  \"creator\": \"api-tester\",
  \"expire_days\": 3,
  \"files\": [
    {\"file_name\": \"result_20240101_01.txt\", \"file_hash\": \"abc123def456\", \"file_size\": 1024}
  ]
}" -w "\nHTTP 状态码: %{http_code}\n"
echo ""

echo "[5/8] 签名作业批次..."
SIGN_RESP=$(curl -s -X POST "$BASE_URL/batches/$BATCH_ID/sign" -H "Content-Type: application/json" -d "{
  \"batch_id\": \"$BATCH_ID\",
  \"signer\": \"sign-service-01\"
}")
echo $SIGN_RESP | jq .
DIGEST=$(echo $SIGN_RESP | jq -r '.digest')
echo "摘要值: $DIGEST"
echo ""

echo "[6/8] 重复签名（预期返回 400 状态不允许跳转）..."
curl -s -X POST "$BASE_URL/batches/$BATCH_ID/sign" -H "Content-Type: application/json" -d "{
  \"batch_id\": \"$BATCH_ID\",
  \"signer\": \"sign-service-01\"
}" -w "\nHTTP 状态码: %{http_code}\n"
echo ""

echo "[7/8] 使用错误摘要验签（预期返回 401 摘要不匹配）..."
curl -s -X POST "$BASE_URL/batches/$BATCH_ID/verify" -H "Content-Type: application/json" -d "{
  \"batch_id\": \"$BATCH_ID\",
  \"consumer_id\": \"$CONSUMER_ID\",
  \"digest\": \"wrong_digest_value\"
}" -w "\nHTTP 状态码: %{http_code}\n"
echo ""

echo "[8/8] 使用正确摘要验签（预期返回 200 成功）..."
curl -s -X POST "$BASE_URL/batches/$BATCH_ID/verify" -H "Content-Type: application/json" -d "{
  \"batch_id\": \"$BATCH_ID\",
  \"consumer_id\": \"$CONSUMER_ID\",
  \"digest\": \"$DIGEST\"
}"
echo ""

echo ""
echo "======================================"
echo "  获取批次状态和验签历史"
echo "======================================"
echo ""

echo "批次当前状态:"
curl -s -X GET "$BASE_URL/batches/$BATCH_ID" | jq .
echo ""

echo "验签历史记录:"
curl -s -X GET "$BASE_URL/batches/$BATCH_ID/history" | jq .
echo ""

echo "======================================"
echo "  所有测试场景执行完毕！"
echo "======================================"
