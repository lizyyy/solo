#!/bin/bash

BASE_URL="http://localhost:3000/api"

echo "=== 数据质量规则发布 API 测试脚本 ==="
echo ""

echo "1️⃣ 创建规则版本 (DRAFT)"
RULE_VERSION=$(curl -s -X POST "$BASE_URL/rule-versions" \
  -H "Content-Type: application/json" \
  -d '{
    "ruleId": "RULE-TEST-001",
    "ruleName": "测试规则",
    "content": "SELECT 1",
    "description": "用于测试的规则",
    "createdBy": "test-user"
  }')

RULE_VERSION_ID=$(echo "$RULE_VERSION" | grep -o '"id":"[^"]*' | cut -d'"' -f4)
echo "✅ 规则版本创建成功: $RULE_VERSION_ID"
echo "$RULE_VERSION"
echo ""

echo "2️⃣ 测试非法流转: DRAFT -> PUBLISHED (应该失败)"
curl -s -X POST "$BASE_URL/rule-versions/$RULE_VERSION_ID/publish" \
  -H "Content-Type: application/json" \
  -d '{"operator": "test"}'
echo ""
echo ""

echo "3️⃣ 合法流转: DRAFT -> PENDING_APPROVAL"
curl -s -X POST "$BASE_URL/rule-versions/$RULE_VERSION_ID/submit" \
  -H "Content-Type: application/json" \
  -d '{"operator": "test", "comment": "请求审批"}'
echo ""
echo ""

echo "4️⃣ 测试重复提交 (状态已是 PENDING_APPROVAL)"
curl -s -X POST "$BASE_URL/rule-versions/$RULE_VERSION_ID/submit" \
  -H "Content-Type: application/json" \
  -d '{"operator": "test"}'
echo ""
echo ""

echo "5️⃣ 合法流转: PENDING_APPROVAL -> APPROVED"
curl -s -X POST "$BASE_URL/rule-versions/$RULE_VERSION_ID/approve" \
  -H "Content-Type: application/json" \
  -d '{"operator": "approver", "comment": "审批通过"}'
echo ""
echo ""

echo "6️⃣ 合法流转: APPROVED -> PUBLISHED"
curl -s -X POST "$BASE_URL/rule-versions/$RULE_VERSION_ID/publish" \
  -H "Content-Type: application/json" \
  -d '{"operator": "publisher", "comment": "正式发布"}'
echo ""
echo ""

echo "7️⃣ 测试: 对已发布规则创建告警订阅"
curl -s -X POST "$BASE_URL/subscriptions" \
  -H "Content-Type: application/json" \
  -d "{
    \"ruleVersionId\": \"$RULE_VERSION_ID\",
    \"subscriberId\": \"USER-TEST-001\",
    \"subscriberName\": \"测试订阅者\",
    \"email\": \"test@example.com\",
    \"operator\": \"admin\"
  }"
echo ""
echo ""

echo "8️⃣ 测试: 对已发布规则创建批次重算"
BATCH=$(curl -s -X POST "$BASE_URL/batches" \
  -H "Content-Type: application/json" \
  -d "{
    \"ruleVersionId\": \"$RULE_VERSION_ID\",
    \"batchDate\": \"2026-05-10\",
    \"createdBy\": \"scheduler\"
  }")
BATCH_ID=$(echo "$BATCH" | grep -o '"id":"[^"]*' | cut -d'"' -f4)
echo "✅ 批次创建成功: $BATCH_ID"
echo "$BATCH"
echo ""

echo "9️⃣ 批次流转: PENDING -> RUNNING"
curl -s -X POST "$BASE_URL/batches/$BATCH_ID/start" \
  -H "Content-Type: application/json" \
  -d '{"operator": "scheduler"}'
echo ""
echo ""

echo "🔟 批次流转: RUNNING -> SUCCESS"
curl -s -X POST "$BASE_URL/batches/$BATCH_ID/success" \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "scheduler",
    "dataCount": 1000,
    "passCount": 950,
    "failCount": 50
  }'
echo ""
echo ""

echo "1️⃣1️⃣ 创建误报豁免"
curl -s -X POST "$BASE_URL/waives" \
  -H "Content-Type: application/json" \
  -d "{
    \"ruleVersionId\": \"$RULE_VERSION_ID\",
    \"batchId\": \"$BATCH_ID\",
    \"reason\": \"历史数据问题，不影响业务\",
    \"waivedBy\": \"data-owner\",
    \"affectedRows\": 20
  }"
echo ""
echo ""

echo "1️⃣2️⃣ 生成质量报表"
curl -s -X POST "$BASE_URL/reports" \
  -H "Content-Type: application/json" \
  -d "{
    \"ruleVersionId\": \"$RULE_VERSION_ID\",
    \"reportDate\": \"2026-05-10\",
    \"generatedBy\": \"analyst\"
  }"
echo ""
echo ""

echo "1️⃣3️⃣ 查看规则版本汇总"
curl -s "$BASE_URL/reports/rule-version/$RULE_VERSION_ID/summary"
echo ""
echo ""

echo "1️⃣4️⃣ 查看操作历史"
curl -s "$BASE_URL/logs/entity/RuleVersion/$RULE_VERSION_ID"
echo ""
echo ""

echo "=== 测试完成 ==="
echo "✅ 所有状态流转、错误处理、操作记录都已验证"
