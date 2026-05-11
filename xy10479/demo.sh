#!/bin/bash

BASE_URL="http://localhost:3000"

echo "========================================"
echo "客户成功续约API演示"
echo "========================================"
echo ""

echo "1. 创建客户..."
echo "----------------------------------------"
CUSTOMER1=$(curl -s -X POST "$BASE_URL/api/customers" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "科技有限公司",
    "industry": "互联网",
    "csm_id": "csm001",
    "csm_name": "张明"
  }')
echo "客户1: $CUSTOMER1"
echo ""

CUSTOMER2=$(curl -s -X POST "$BASE_URL/api/customers" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "创新科技股份",
    "industry": "金融科技",
    "csm_id": "csm001",
    "csm_name": "张明"
  }')
echo "客户2: $CUSTOMER2"
echo ""

CUSTOMER3=$(curl -s -X POST "$BASE_URL/api/customers" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "未来数据服务",
    "industry": "企业服务",
    "csm_id": "csm002",
    "csm_name": "李华"
  }')
echo "客户3: $CUSTOMER3"
echo ""

CUST1_ID=$(echo $CUSTOMER1 | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])")
CUST2_ID=$(echo $CUSTOMER2 | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])")
CUST3_ID=$(echo $CUSTOMER3 | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])")

echo "2. 创建合同..."
echo "----------------------------------------"
echo "客户1 - 即将到期合同（15天后到期）:"
CONTRACT1=$(curl -s -X POST "$BASE_URL/api/contracts" \
  -H "Content-Type: application/json" \
  -d "{
    \"customer_id\": \"$CUST1_ID\",
    \"contract_no\": \"CT-2024-001\",
    \"start_date\": \"2024-05-26\",
    \"end_date\": \"2026-05-26\",
    \"amount\": 100000
  }")
echo $CONTRACT1
echo ""

echo "客户2 - 正常合同（6个月后到期）:"
CONTRACT2=$(curl -s -X POST "$BASE_URL/api/contracts" \
  -H "Content-Type: application/json" \
  -d "{
    \"customer_id\": \"$CUST2_ID\",
    \"contract_no\": \"CT-2024-002\",
    \"start_date\": \"2024-11-11\",
    \"end_date\": \"2026-11-11\",
    \"amount\": 200000
  }")
echo $CONTRACT2
echo ""

echo "客户3 - 合同（2个月后到期）:"
CONTRACT3=$(curl -s -X POST "$BASE_URL/api/contracts" \
  -H "Content-Type: application/json" \
  -d "{
    \"customer_id\": \"$CUST3_ID\",
    \"contract_no\": \"CT-2024-003\",
    \"start_date\": \"2024-07-11\",
    \"end_date\": \"2026-07-11\",
    \"amount\": 150000
  }")
echo $CONTRACT3
echo ""

CONT1_ID=$(echo $CONTRACT1 | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])")
CONT2_ID=$(echo $CONTRACT2 | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])")
CONT3_ID=$(echo $CONTRACT3 | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])")

echo "3. 录入使用量数据..."
echo "----------------------------------------"
echo "客户1 - 使用量大幅下降（50%）:"
curl -s -X POST "$BASE_URL/api/usage" \
  -H "Content-Type: application/json" \
  -d "{
    \"customer_id\": \"$CUST1_ID\",
    \"month\": \"2026-03\",
    \"value\": 10000,
    \"unit\": \"api_calls\"
  }"
echo ""

curl -s -X POST "$BASE_URL/api/usage" \
  -H "Content-Type: application/json" \
  -d "{
    \"customer_id\": \"$CUST1_ID\",
    \"month\": \"2026-04\",
    \"value\": 5000,
    \"unit\": \"api_calls\"
  }"
echo ""

echo "客户2 - 使用量稳定:"
curl -s -X POST "$BASE_URL/api/usage" \
  -H "Content-Type: application/json" \
  -d "{
    \"customer_id\": \"$CUST2_ID\",
    \"month\": \"2026-03\",
    \"value\": 20000,
    \"unit\": \"api_calls\"
  }"
echo ""

curl -s -X POST "$BASE_URL/api/usage" \
  -H "Content-Type: application/json" \
  -d "{
    \"customer_id\": \"$CUST2_ID\",
    \"month\": \"2026-04\",
    \"value\": 19500,
    \"unit\": \"api_calls\"
  }"
echo ""

echo "客户3 - 使用量正常下降（10%）:"
curl -s -X POST "$BASE_URL/api/usage" \
  -H "Content-Type: application/json" \
  -d "{
    \"customer_id\": \"$CUST3_ID\",
    \"month\": \"2026-03\",
    \"value\": 15000,
    \"unit\": \"api_calls\"
  }"
echo ""

curl -s -X POST "$BASE_URL/api/usage" \
  -H "Content-Type: application/json" \
  -d "{
    \"customer_id\": \"$CUST3_ID\",
    \"month\": \"2026-04\",
    \"value\": 13500,
    \"unit\": \"api_calls\"
  }"
echo ""
echo ""

echo "4. 录入工单数据..."
echo "----------------------------------------"
echo "客户1 - 严重未关闭工单:"
TICKET1=$(curl -s -X POST "$BASE_URL/api/tickets" \
  -H "Content-Type: application/json" \
  -d "{
    \"customer_id\": \"$CUST1_ID\",
    \"title\": \"系统频繁宕机\",
    \"severity\": \"critical\",
    \"status\": \"open\",
    \"satisfaction_score\": null
  }")
echo "工单1: $TICKET1"
echo ""

echo "客户1 - 高优先级未关闭工单:"
curl -s -X POST "$BASE_URL/api/tickets" \
  -H "Content-Type: application/json" \
  -d "{
    \"customer_id\": \"$CUST1_ID\",
    \"title\": \"数据同步延迟\",
    \"severity\": \"high\",
    \"status\": \"in_progress\",
    \"satisfaction_score\": null
  }"
echo ""

echo "客户2 - 已关闭工单（高满意度）:"
curl -s -X POST "$BASE_URL/api/tickets" \
  -H "Content-Type: application/json" \
  -d "{
    \"customer_id\": \"$CUST2_ID\",
    \"title\": \"新功能咨询\",
    \"severity\": \"low\",
    \"status\": \"closed\",
    \"satisfaction_score\": 4.8
  }"
echo ""
echo ""

echo "5. 创建续约机会..."
echo "----------------------------------------"
echo "为客户2创建续约机会:"
OPP1=$(curl -s -X POST "$BASE_URL/api/renewal-opportunities" \
  -H "Content-Type: application/json" \
  -d "{
    \"customer_id\": \"$CUST2_ID\",
    \"contract_id\": \"$CONT2_ID\",
    \"amount\": 220000,
    \"stage\": \"qualified\",
    \"probability\": 0.7,
    \"notes\": \"客户明确表示愿意续约，已初步沟通\"
  }")
echo "机会1: $OPP1"
echo ""

echo "为客户3创建续约机会:"
OPP2=$(curl -s -X POST "$BASE_URL/api/renewal-opportunities" \
  -H "Content-Type: application/json" \
  -d "{
    \"customer_id\": \"$CUST3_ID\",
    \"contract_id\": \"$CONT3_ID\",
    \"amount\": 165000,
    \"stage\": \"identified\",
    \"probability\": 0.3,
    \"notes\": \"客户对价格敏感，需要进一步沟通\"
  }")
echo "机会2: $OPP2"
echo ""

echo "尝试重复创建客户2的续约机会:"
curl -s -X POST "$BASE_URL/api/renewal-opportunities" \
  -H "Content-Type: application/json" \
  -d "{
    \"customer_id\": \"$CUST2_ID\",
    \"contract_id\": \"$CONT2_ID\",
    \"amount\": 220000,
    \"stage\": \"identified\",
    \"probability\": 0.2,
    \"notes\": \"重复创建\"
  }"
echo ""
echo ""

echo "6. 推进续约机会（客户2从qualified到proposal）:"
echo "----------------------------------------"
OPP1_ID=$(echo $OPP1 | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])")
curl -s -X PUT "$BASE_URL/api/renewal-opportunities/$OPP1_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "stage": "proposal",
    "probability": 0.85,
    "notes": "已提交续约报价单"
  }'
echo ""
echo ""

echo "7. 录入跟进记录..."
echo "----------------------------------------"
echo "客户1跟进记录:"
curl -s -X POST "$BASE_URL/api/follow-up" \
  -H "Content-Type: application/json" \
  -d "{
    \"customer_id\": \"$CUST1_ID\",
    \"csm_id\": \"csm001\",
    \"type\": \"电话\",
    \"content\": \"讨论系统稳定性问题，客户表示不满。建议安排技术团队紧急支持。\",
    \"next_follow_up_date\": \"2026-05-12\"
  }"
echo ""

echo "客户2跟进记录:"
curl -s -X POST "$BASE_URL/api/follow-up" \
  -H "Content-Type: application/json" \
  -d "{
    \"customer_id\": \"$CUST2_ID\",
    \"csm_id\": \"csm001\",
    \"type\": \"会议\",
    \"content\": \"续约沟通非常顺利，客户对服务满意。\",
    \"next_follow_up_date\": \"2026-06-01\"
  }"
echo ""
echo ""

echo "========================================"
echo "查询接口演示"
echo "========================================"
echo ""

echo "8. 查询健康客户（健康度>=80）:"
echo "----------------------------------------"
curl -s "$BASE_URL/api/health-customers" | python3 -m json.tool
echo ""

echo "9. 查询风险客户:"
echo "----------------------------------------"
curl -s "$BASE_URL/api/risk-customers" | python3 -m json.tool
echo ""

echo "10. 查询单个客户健康详情（客户1 - 高风险）:"
echo "----------------------------------------"
curl -s "$BASE_URL/api/health/$CUST1_ID" | python3 -m json.tool
echo ""

echo "11. 续约金额预测:"
echo "----------------------------------------"
curl -s "$BASE_URL/api/renewal-prediction" | python3 -m json.tool
echo ""

echo "12. 待跟进客户:"
echo "----------------------------------------"
curl -s "$BASE_URL/api/follow-up-pending" | python3 -m json.tool
echo ""

echo "13. CSM续约漏斗:"
echo "----------------------------------------"
curl -s "$BASE_URL/api/csm-funnel" | python3 -m json.tool
echo ""

echo "========================================"
echo "风险豁免演示"
echo "========================================"
echo ""

echo "14. 豁免客户1的风险（保留下次跟进日期）:"
echo "----------------------------------------"
EXEMPT=$(curl -s -X POST "$BASE_URL/api/risk-exemptions" \
  -H "Content-Type: application/json" \
  -d "{
    \"customer_id\": \"$CUST1_ID\",
    \"risk_type\": \"usage_decline\",
    \"reason\": \"客户业务淡季导致使用量下降，已确认后续会回升\",
    \"exempted_by\": \"csm001\",
    \"next_review_date\": \"2026-06-01\"
  }")
echo $EXEMPT
echo ""

echo "15. 查询豁免记录:"
echo "----------------------------------------"
curl -s "$BASE_URL/api/risk-exemptions" | python3 -m json.tool
echo ""

echo "16. 仪表盘概览:"
echo "----------------------------------------"
curl -s "$BASE_URL/api/dashboard" | python3 -m json.tool
echo ""

echo "========================================"
echo "演示完成！"
echo "========================================"
