#!/bin/bash

BASE_URL="http://localhost:5000/api"

echo "=========================================="
echo "  图片审核回调幂等 API - 使用示例"
echo "=========================================="
echo ""

echo "【1】健康检查"
echo "------------------------------------------"
curl -s "$BASE_URL/health" | python3 -m json.tool
echo ""

echo "【2】创建审核任务"
echo "------------------------------------------"
CREATE_RESPONSE=$(curl -s -X POST "$BASE_URL/tasks" \
  -H "Content-Type: application/json" \
  -d '{
    "business_id": "ORDER_2024_001",
    "image_url": "https://example.com/products/001.jpg",
    "image_source": "用户上传",
    "remark": "商品详情页主图"
  }')
echo "$CREATE_RESPONSE" | python3 -m json.tool
TASK_ID=$(echo "$CREATE_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['task_id'])")
echo ""
echo "📋 任务ID: $TASK_ID"
echo ""

echo "【3】发送回调 - 审核中 (序号1)"
echo "------------------------------------------"
curl -s -X POST "$BASE_URL/callback" \
  -H "Content-Type: application/json" \
  -d "{
    \"task_id\": \"$TASK_ID\",
    \"callback_id\": \"CB_DEMO_001\",
    \"callback_sequence\": 1,
    \"review_result\": \"PROCESSING\",
    \"raw_payload\": {\"message\": \"开始处理\"}
  }" | python3 -m json.tool
echo ""

echo "【4】发送回调 - 审核通过 (序号2)"
echo "------------------------------------------"
curl -s -X POST "$BASE_URL/callback" \
  -H "Content-Type: application/json" \
  -d "{
    \"task_id\": \"$TASK_ID\",
    \"callback_id\": \"CB_DEMO_002\",
    \"callback_sequence\": 2,
    \"review_result\": \"APPROVED\",
    \"review_score\": 0.98,
    \"risk_category\": \"无风险\",
    \"raw_payload\": {\"confidence\": 0.98}
  }" | python3 -m json.tool
echo ""

echo "【5】尝试用旧序号覆盖 (序号0) - 应该被忽略"
echo "------------------------------------------"
curl -s -X POST "$BASE_URL/callback" \
  -H "Content-Type: application/json" \
  -d "{
    \"task_id\": \"$TASK_ID\",
    \"callback_id\": \"CB_DEMO_OLD\",
    \"callback_sequence\": 0,
    \"review_result\": \"REJECTED\",
    \"raw_payload\": {\"try_override\": true}
  }" | python3 -m json.tool
echo ""

echo "【6】查询任务详情（含历史记录）"
echo "------------------------------------------"
curl -s "$BASE_URL/tasks/$TASK_ID" | python3 -m json.tool
echo ""

echo "【7】查看统计数据"
echo "------------------------------------------"
curl -s "$BASE_URL/statistics" | python3 -m json.tool
echo ""

echo "【8】获取状态列表说明"
echo "------------------------------------------"
curl -s "$BASE_URL/status-info" | python3 -m json.tool
echo ""

echo "=========================================="
echo "  API 示例执行完成"
echo "=========================================="
