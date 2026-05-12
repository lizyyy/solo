#!/bin/bash

BASE_URL="${QUOTA_API_URL:-http://localhost:3000}"

echo "=========================================="
echo "  SaaS 租户配额超用 API - curl 演示"
echo "=========================================="
echo ""
echo "服务地址: $BASE_URL"
echo ""

TENANT_ID="curl-demo-$(date +%s)"
TODAY=$(date +%Y-%m-%d)
YESTERDAY=$(date -v-1d +%Y-%m-%d 2>/dev/null || date --date="yesterday" +%Y-%m-%d)

echo "【步骤 1】健康检查"
echo "------------------------------------------"
curl -s "$BASE_URL/health" | python3 -m json.tool 2>/dev/null || curl -s "$BASE_URL/health"
echo ""

echo ""
echo "【步骤 2】查看可用套餐"
echo "------------------------------------------"
curl -s "$BASE_URL/api/plans" | python3 -m json.tool 2>/dev/null || curl -s "$BASE_URL/api/plans"
echo ""

echo ""
echo "【步骤 3】创建租户 '$TENANT_ID' (套餐: starter 入门版)"
echo "------------------------------------------"
CREATE_RESP=$(curl -s -X POST "$BASE_URL/api/tenants" \
  -H "Content-Type: application/json" \
  -d "{\"id\":\"$TENANT_ID\",\"name\":\"Curl演示公司\",\"planId\":\"starter\"}")
echo "$CREATE_RESP" | python3 -m json.tool 2>/dev/null || echo "$CREATE_RESP"
echo ""

echo ""
echo "【步骤 4】查询配额账本 (创建后)"
echo "------------------------------------------"
curl -s "$BASE_URL/api/tenants/$TENANT_ID/ledger" | python3 -m json.tool 2>/dev/null || curl -s "$BASE_URL/api/tenants/$TENANT_ID/ledger"
echo ""

echo ""
echo "【步骤 5】上报昨天用量: 存储 3GB"
echo "------------------------------------------"
curl -s -X POST "$BASE_URL/api/tenants/$TENANT_ID/usage" \
  -H "Content-Type: application/json" \
  -d "{\"resourceType\":\"storage\",\"amount\":3,\"usageDate\":\"$YESTERDAY\",\"requestId\":\"curl-req-001\"}" | python3 -m json.tool 2>/dev/null
echo ""

echo ""
echo "【步骤 6】上报今日用量: 存储 6GB (累计 9GB，接近 10GB 配额)"
echo "------------------------------------------"
curl -s -X POST "$BASE_URL/api/tenants/$TENANT_ID/usage" \
  -H "Content-Type: application/json" \
  -d "{\"resourceType\":\"storage\",\"amount\":6,\"usageDate\":\"$TODAY\",\"requestId\":\"curl-req-002\"}" | python3 -m json.tool 2>/dev/null
echo ""

echo ""
echo "【步骤 7】查询配额账本 - 状态应为 warning (软限制 80%)"
echo "------------------------------------------"
curl -s "$BASE_URL/api/tenants/$TENANT_ID/ledger" | python3 -m json.tool 2>/dev/null
echo ""

echo ""
echo "【步骤 8】继续上报: 存储 2GB (累计 11GB -> 超配额 1GB)"
echo "------------------------------------------"
curl -s -X POST "$BASE_URL/api/tenants/$TENANT_ID/usage" \
  -H "Content-Type: application/json" \
  -d "{\"resourceType\":\"storage\",\"amount\":2,\"requestId\":\"curl-req-003\"}" | python3 -m json.tool 2>/dev/null
echo ""

echo ""
echo "【步骤 9】查询配额账本 - 状态应为 over (硬超用)"
echo "------------------------------------------"
curl -s "$BASE_URL/api/tenants/$TENANT_ID/ledger" | python3 -m json.tool 2>/dev/null
echo ""

echo ""
echo "【步骤 10】加购 5GB 存储包"
echo "------------------------------------------"
curl -s -X POST "$BASE_URL/api/tenants/$TENANT_ID/addons" \
  -H "Content-Type: application/json" \
  -d "{\"type\":\"storage\",\"amount\":5,\"source\":\"purchase\",\"operator\":\"sales-001\"}" | python3 -m json.tool 2>/dev/null
echo ""

echo ""
echo "【步骤 11】查询配额账本 - 加购后总配额 15GB，恢复正常"
echo "------------------------------------------"
curl -s "$BASE_URL/api/tenants/$TENANT_ID/ledger" | python3 -m json.tool 2>/dev/null
echo ""

echo ""
echo "【步骤 12】套餐降级: 从 starter -> free (仅 1GB 存储)"
echo "------------------------------------------"
curl -s -X POST "$BASE_URL/api/tenants/$TENANT_ID/plan" \
  -H "Content-Type: application/json" \
  -d "{\"planId\":\"free\",\"reason\":\"用户主动降级\",\"operator\":\"cs-001\"}" | python3 -m json.tool 2>/dev/null
echo ""

echo ""
echo "【步骤 13】查询配额账本 - 降级后再次超用，并显示超用原因"
echo "------------------------------------------"
curl -s "$BASE_URL/api/tenants/$TENANT_ID/ledger" | python3 -m json.tool 2>/dev/null
echo ""

echo ""
echo "【步骤 14】冻结租户"
echo "------------------------------------------"
curl -s -X POST "$BASE_URL/api/tenants/$TENANT_ID/freeze" \
  -H "Content-Type: application/json" \
  -d "{\"reason\":\"超用未续费\",\"operator\":\"compliance-001\"}" | python3 -m json.tool 2>/dev/null
echo ""

echo ""
echo "【步骤 15】冻结后尝试上报用量 -> 应该失败"
echo "------------------------------------------"
curl -s -X POST "$BASE_URL/api/tenants/$TENANT_ID/usage" \
  -H "Content-Type: application/json" \
  -d "{\"resourceType\":\"storage\",\"amount\":1,\"requestId\":\"curl-req-004\"}" | python3 -m json.tool 2>/dev/null
echo ""

echo ""
echo "【步骤 16】幂等性测试 - 重复上报同一 requestId"
echo "------------------------------------------"
echo "先解冻以进行测试..."
curl -s -X POST "$BASE_URL/api/tenants/$TENANT_ID/unfreeze" \
  -H "Content-Type: application/json" \
  -d "{\"reason\":\"测试幂等\",\"operator\":\"test\"}" > /dev/null

echo ""
echo "第一次上报 (requestId: curl-idempotent-001):"
curl -s -X POST "$BASE_URL/api/tenants/$TENANT_ID/usage" \
  -H "Content-Type: application/json" \
  -d "{\"resourceType\":\"call\",\"amount\":100,\"requestId\":\"curl-idempotent-001\"}" | python3 -m json.tool 2>/dev/null

echo ""
echo "第二次上报 (相同 requestId):"
curl -s -X POST "$BASE_URL/api/tenants/$TENANT_ID/usage" \
  -H "Content-Type: application/json" \
  -d "{\"resourceType\":\"call\",\"amount\":100,\"requestId\":\"curl-idempotent-001\"}" | python3 -m json.tool 2>/dev/null
echo ""

echo ""
echo "【步骤 17】人工修正: 扣除 2GB (需指定操作人)"
echo "------------------------------------------"
curl -s -X POST "$BASE_URL/api/tenants/$TENANT_ID/correction" \
  -H "Content-Type: application/json" \
  -d "{\"resourceType\":\"storage\",\"correction\":-2,\"reason\":\"重复统计修正\",\"operator\":\"ops-admin-001\"}" | python3 -m json.tool 2>/dev/null
echo ""

echo ""
echo "【步骤 18】查询历史记录"
echo "------------------------------------------"
curl -s "$BASE_URL/api/tenants/$TENANT_ID/history" | python3 -m json.tool 2>/dev/null
echo ""

echo ""
echo "【步骤 19】导出日期用量报告 (JSON)"
echo "------------------------------------------"
WEEK_AGO=$(date -v-7d +%Y-%m-%d 2>/dev/null || date --date="7 days ago" +%Y-%m-%d)
curl -s "$BASE_URL/api/tenants/$TENANT_ID/report/daily?from=$WEEK_AGO&to=$TODAY" | python3 -m json.tool 2>/dev/null
echo ""

echo ""
echo "【步骤 20】导出日期用量报告 (CSV) - 保存到文件"
echo "------------------------------------------"
curl -s "$BASE_URL/api/tenants/$TENANT_ID/report/daily?from=$WEEK_AGO&to=$TODAY&format=csv" -o "quota-report-$TENANT_ID.csv"
echo "报告已保存到: quota-report-$TENANT_ID.csv"
cat "quota-report-$TENANT_ID.csv"
echo ""

echo ""
echo "=========================================="
echo "  curl 演示完成！"
echo "=========================================="
echo ""
echo "💡 失败路径演示 (手动执行):"
echo ""
echo "  # 1. 查询不存在的租户"
echo "  curl -s $BASE_URL/api/tenants/nonexistent/ledger | python3 -m json.tool"
echo ""
echo "  # 2. 缺少必填参数"
echo "  curl -s -X POST $BASE_URL/api/tenants/$TENANT_ID/usage \\"
echo "    -H 'Content-Type: application/json' -d '{\"resourceType\":\"storage\"}' | python3 -m json.tool"
echo ""
echo "  # 3. 人工修正缺少操作人"
echo "  curl -s -X POST $BASE_URL/api/tenants/$TENANT_ID/correction \\"
echo "    -H 'Content-Type: application/json' -d '{\"resourceType\":\"storage\",\"correction\":-1}' | python3 -m json.tool"
echo ""
