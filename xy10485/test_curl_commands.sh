#!/bin/bash
BASE_URL="http://localhost:8000"

echo "===================================="
echo "1. 创建知识条目（初始为草稿）"
echo "===================================="
CREATE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/entries/" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "退款流程说明",
    "question": "如何申请退款？退款流程是什么？",
    "answer": "申请退款步骤：1. 进入订单详情页 2. 点击申请退款按钮 3. 填写退款原因 4. 提交申请 5. 等待商家审核",
    "keywords": "退款,申请退款,退款流程,退款申请"
  }')
echo "$CREATE_RESPONSE"
ENTRY_ID=$(echo "$CREATE_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])")
VERSION_ID=$(echo "$CREATE_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['versions'][0]['id'])")
echo "创建的条目ID: $ENTRY_ID, 版本ID: $VERSION_ID"
echo ""

echo "===================================="
echo "2. 发布知识版本"
echo "===================================="
curl -s -X POST "$BASE_URL/api/versions/$VERSION_ID/publish" \
  -H "Content-Type: application/json" \
  -d "{\"version_id\": $VERSION_ID}"
echo ""
echo ""

echo "===================================="
echo "3. 提交客服问题，获取候选答案"
echo "===================================="
QUERY_RESPONSE=$(curl -s -X POST "$BASE_URL/api/query" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "我想申请退款，怎么操作？",
    "query_id": "query_001"
  }')
echo "$QUERY_RESPONSE"
echo ""

echo "===================================="
echo "4. 命中采用 - 客服直接使用推荐答案"
echo "===================================="
curl -s -X POST "$BASE_URL/api/adopt" \
  -H "Content-Type: application/json" \
  -d "{
    \"query_id\": \"query_001\",
    \"version_id\": $VERSION_ID
  }"
echo ""
echo ""

echo "===================================="
echo "5. 另一个查询 - 后续改写用例"
echo "===================================="
QUERY2_RESPONSE=$(curl -s -X POST "$BASE_URL/api/query" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "退款怎么弄？",
    "query_id": "query_002"
  }')
echo "$QUERY2_RESPONSE"
echo ""

echo "===================================="
echo "6. 命中后改写 - 客服修改了答案"
echo "===================================="
curl -s -X POST "$BASE_URL/api/rewrite" \
  -H "Content-Type: application/json" \
  -d "{
    \"query_id\": \"query_002\",
    \"version_id\": $VERSION_ID,
    \"rewritten_answer\": \"您好！申请退款请按以下步骤：1) 登录账户进入订单中心；2) 找到对应订单点击详情；3) 点击【申请退款】按钮；4) 选择退款类型并填写原因；5) 提交后1-3个工作日内完成审核。如有问题请联系客服电话400-xxx-xxxx\"
  }"
echo ""
echo ""

echo "===================================="
echo "7. 过期下线 - 标记答案过期"
echo "===================================="
curl -s -X POST "$BASE_URL/api/versions/$VERSION_ID/expire" \
  -H "Content-Type: application/json" \
  -d "{
    \"version_id\": $VERSION_ID,
    \"reason\": \"退款流程已更新，此版本答案已过时\"
  }"
echo ""
echo ""

echo "===================================="
echo "8. 验证过期后不能被检索"
echo "===================================="
echo "查询已过期的退款问题:"
curl -s -X POST "$BASE_URL/api/query" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "如何申请退款？",
    "query_id": "query_003"
  }'
echo ""
echo ""

echo "===================================="
echo "9. 无答案反馈 - 知识库中没有的问题"
echo "===================================="
curl -s -X POST "$BASE_URL/api/no-answer" \
  -H "Content-Type: application/json" \
  -d '{
    "query_id": "query_004",
    "query": "如何申请VIP会员升级？",
    "feedback": "用户询问如何从普通会员升级到VIP，知识库中没有相关答案"
  }'
echo ""
echo ""

echo "===================================="
echo "10. 同一问题重复反馈（应该检测到已存在）"
echo "===================================="
curl -s -X POST "$BASE_URL/api/no-answer" \
  -H "Content-Type: application/json" \
  -d '{
    "query_id": "query_004",
    "query": "如何申请VIP会员升级？",
    "feedback": "又一次询问同样的问题"
  }'
echo ""
echo ""

echo "===================================="
echo "11. 查看统计数据"
echo "===================================="
curl -s -X GET "$BASE_URL/api/statistics" \
  -H "Content-Type: application/json"
echo ""
echo ""

echo "===================================="
echo "测试脚本执行完成！"
echo "===================================="
