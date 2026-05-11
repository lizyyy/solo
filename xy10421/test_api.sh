#!/bin/bash

BASE_URL="http://localhost:3001"

echo "======================================"
echo "  客诉赔偿额度 API 测试脚本"
echo "======================================"
echo ""

echo "首先安装依赖并启动服务器..."
echo "请先运行: npm install && npm start"
echo "然后在另一个终端运行此脚本"
echo ""

read -p "服务器已启动？(y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
fi

echo ""
echo "======================================"
echo "  测试 1: 正常赔付流程（自动通过）"
echo "======================================"
echo ""

echo "步骤 1: 创建投诉（ORD001，金额1000元，P2 问题，最高20%=200元）"
CREATE_RESP=$(curl -s -X POST "$BASE_URL/api/complaints" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "ORD001",
    "agentId": "AGENT001",
    "problemType": "物流延迟",
    "level": "P2",
    "description": "商品晚到3天"
  }')
echo "响应:"
echo "$CREATE_RESP" | python3 -m json.tool
COMPLAINT_ID_1=$(echo "$CREATE_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['complaintId'])")
echo ""
echo "投诉ID: $COMPLAINT_ID_1"
echo ""

echo "步骤 2: 试算赔偿 150 元（在20%上限内）"
curl -s -X POST "$BASE_URL/api/complaints/$COMPLAINT_ID_1/calculate" \
  -H "Content-Type: application/json" \
  -d '{"requestedAmount": 150}' | python3 -m json.tool
echo ""

echo "步骤 3: 提交赔偿方案"
SUBMIT_RESP=$(curl -s -X POST "$BASE_URL/api/complaints/$COMPLAINT_ID_1/submit" \
  -H "Content-Type: application/json" \
  -d '{
    "requestedAmount": 150,
    "reason": "物流延迟补偿"
  }')
echo "响应:"
echo "$SUBMIT_RESP" | python3 -m json.tool
echo ""

echo "步骤 4: 结案"
curl -s -X POST "$BASE_URL/api/complaints/$COMPLAINT_ID_1/close" \
  -H "Content-Type: application/json" | python3 -m json.tool
echo ""

echo "======================================"
echo "  测试 2: 超额驳回"
echo "======================================"
echo ""

echo "创建投诉（ORD002，金额500元，P2 问题，最高20%=100元）"
CREATE_RESP2=$(curl -s -X POST "$BASE_URL/api/complaints" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "ORD002",
    "agentId": "AGENT002",
    "problemType": "商品质量",
    "level": "P2",
    "description": "商品有瑕疵"
  }')
COMPLAINT_ID_2=$(echo "$CREATE_RESP2" | python3 -c "import sys,json; print(json.load(sys.stdin)['complaintId'])")
echo "投诉ID: $COMPLAINT_ID_2"
echo ""

echo "尝试提交赔偿 200 元（超过上限，应驳回）"
curl -s -X POST "$BASE_URL/api/complaints/$COMPLAINT_ID_2/submit" \
  -H "Content-Type: application/json" \
  -d '{
    "requestedAmount": 200,
    "reason": "质量问题补偿"
  }' | python3 -m json.tool
echo ""

echo "======================================"
echo "  测试 3: 主管审批通过流程"
echo "======================================"
echo ""

echo "创建投诉（ORD003，金额2000元，P3 问题，最高50%=1000元，需审批）"
CREATE_RESP3=$(curl -s -X POST "$BASE_URL/api/complaints" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "ORD003",
    "agentId": "AGENT001",
    "problemType": "商家欺诈",
    "level": "P3",
    "description": "商家发假货"
  }')
COMPLAINT_ID_3=$(echo "$CREATE_RESP3" | python3 -c "import sys,json; print(json.load(sys.stdin)['complaintId'])")
echo "投诉ID: $COMPLAINT_ID_3"
echo ""

echo "提交赔偿方案 800 元"
SUBMIT_RESP3=$(curl -s -X POST "$BASE_URL/api/complaints/$COMPLAINT_ID_3/submit" \
  -H "Content-Type: application/json" \
  -d '{
    "requestedAmount": 800,
    "reason": "假货全额赔偿"
  }')
echo "提交响应（应显示 pending_approval）:"
echo "$SUBMIT_RESP3" | python3 -m json.tool
echo ""

echo "主管 SUP001 审批通过"
curl -s -X POST "$BASE_URL/api/complaints/$COMPLAINT_ID_3/approve" \
  -H "Content-Type: application/json" \
  -d '{
    "supervisorId": "SUP001",
    "action": "approve",
    "comment": "情况属实，同意赔偿"
  }' | python3 -m json.tool
echo ""

echo "结案"
curl -s -X POST "$BASE_URL/api/complaints/$COMPLAINT_ID_3/close" \
  -H "Content-Type: application/json" | python3 -m json.tool
echo ""

echo "======================================"
echo "  测试 4: 重复提交（幂等性）"
echo "======================================"
echo ""

echo "第一次创建投诉"
FIRST=$(curl -s -X POST "$BASE_URL/api/complaints" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "ORD004",
    "agentId": "AGENT002",
    "problemType": "客服态度",
    "level": "P1",
    "description": "客服态度不好"
  }')
echo "第一次响应:"
echo "$FIRST" | python3 -m json.tool
FIRST_ID=$(echo "$FIRST" | python3 -c "import sys,json; print(json.load(sys.stdin)['complaintId'])")
echo ""

echo "第二次创建相同投诉（应返回相同结果，不会重复创建）"
SECOND=$(curl -s -X POST "$BASE_URL/api/complaints" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "ORD004",
    "agentId": "AGENT002",
    "problemType": "客服态度",
    "level": "P1",
    "description": "客服态度不好"
  }')
echo "第二次响应:"
echo "$SECOND" | python3 -m json.tool
SECOND_ID=$(echo "$SECOND" | python3 -c "import sys,json; print(json.load(sys.stdin)['complaintId'])")
echo ""

if [ "$FIRST_ID" = "$SECOND_ID" ]; then
    echo "✅ 幂等性验证通过：两次返回相同的投诉ID"
else
    echo "❌ 幂等性验证失败：返回了不同的投诉ID"
fi
echo ""

echo "======================================"
echo "  测试 5: 累计赔付上限"
echo "======================================"
echo ""

echo "ORD004 金额800元，累计上限50%=400元"
echo "现在已有投诉 P1(最高10%=80元)"
echo "先赔偿 50 元"
curl -s -X POST "$BASE_URL/api/complaints/$FIRST_ID/submit" \
  -H "Content-Type: application/json" \
  -d '{
    "requestedAmount": 50,
    "reason": "态度问题道歉补偿"
  }' | python3 -m json.tool
echo ""

echo "结案"
curl -s -X POST "$BASE_URL/api/complaints/$FIRST_ID/close" \
  -H "Content-Type: application/json" | python3 -m json.tool
echo ""

echo "再创建一个针对 ORD004 的投诉，尝试赔偿 400 元（应因累计上限被驳回）"
CREATE_RESP4=$(curl -s -X POST "$BASE_URL/api/complaints" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "ORD004",
    "agentId": "AGENT001",
    "problemType": "质量问题",
    "level": "P2",
    "description": "还有质量问题"
  }')
COMPLAINT_ID_4=$(echo "$CREATE_RESP4" | python3 -c "import sys,json; print(json.load(sys.stdin)['complaintId'])")
echo "投诉ID: $COMPLAINT_ID_4"
echo ""

echo "尝试赔偿 400 元（累计已有50元，剩余可赔350元，400应被驳回）"
curl -s -X POST "$BASE_URL/api/complaints/$COMPLAINT_ID_4/submit" \
  -H "Content-Type: application/json" \
  -d '{
    "requestedAmount": 400,
    "reason": "质量问题"
  }' | python3 -m json.tool
echo ""

echo "======================================"
echo "  测试 6: 统计接口"
echo "======================================"
echo ""

echo "按客服、问题类型、日期汇总:"
curl -s "$BASE_URL/api/statistics" | python3 -m json.tool
echo ""

echo "======================================"
echo "  测试 7: 已结案投诉不能再改"
echo "======================================"
echo ""

echo "尝试对已结案的 $COMPLAINT_ID_1 提交新赔偿"
curl -s -X POST "$BASE_URL/api/complaints/$COMPLAINT_ID_1/submit" \
  -H "Content-Type: application/json" \
  -d '{"requestedAmount": 100}' | python3 -m json.tool
echo ""

echo "======================================"
echo "  测试完成"
echo "======================================"
