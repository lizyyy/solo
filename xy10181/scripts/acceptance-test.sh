#!/bin/bash

BASE_URL="http://localhost:3000"
REQUEST_ID="REQ-$(date +%Y%m%d%H%M%S)"

echo "========================================"
echo "  限额审批占用释放 API 验收测试"
echo "========================================"
echo ""

echo "[1/8] 健康检查..."
curl -s -X GET "${BASE_URL}/health" | python3 -m json.tool
echo ""
echo ""

echo "[2/8] 提交审批申请（占用限额）..."
APPLY_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/v1/quota/apply" \
  -H "Content-Type: application/json" \
  -d '{
    "quotaCode": "QUOTA_001",
    "applyAmount": 50000.00,
    "applicant": "张三",
    "reason": "年度采购申请",
    "requestId": "'${REQUEST_ID}'"
  }')
echo "${APPLY_RESPONSE}" | python3 -m json.tool
echo ""
echo ""

echo "[3/8] 重复提交相同 requestId（验证幂等性）..."
DUPLICATE_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/v1/quota/apply" \
  -H "Content-Type: application/json" \
  -d '{
    "quotaCode": "QUOTA_001",
    "applyAmount": 50000.00,
    "applicant": "张三",
    "reason": "年度采购申请",
    "requestId": "'${REQUEST_ID}'"
  }')
echo "${DUPLICATE_RESPONSE}" | python3 -m json.tool
echo ""
echo ""

echo "[4/8] 查询审批状态..."
curl -s -X GET "${BASE_URL}/api/v1/quota/${REQUEST_ID}/status" | python3 -m json.tool
echo ""
echo ""

echo "[5/8] 审批通过（扣减限额）..."
APPROVE_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/v1/quota/${REQUEST_ID}/approve" \
  -H "Content-Type: application/json" \
  -d '{
    "approver": "王经理",
    "comments": "同意采购"
  }')
echo "${APPROVE_RESPONSE}" | python3 -m json.tool
echo ""
echo ""

echo "[6/8] 测试驳回流程..."
REJECT_REQUEST_ID="REJ-$(date +%Y%m%d%H%M%S)"
echo "   - 先提交申请..."
curl -s -X POST "${BASE_URL}/api/v1/quota/apply" \
  -H "Content-Type: application/json" \
  -d '{
    "quotaCode": "QUOTA_002",
    "applyAmount": 10000.00,
    "applicant": "李四",
    "reason": "项目A申请",
    "requestId": "'${REJECT_REQUEST_ID}'"
  }' | python3 -m json.tool
echo ""

echo "   - 驳回申请（释放限额）..."
curl -s -X POST "${BASE_URL}/api/v1/quota/${REJECT_REQUEST_ID}/reject" \
  -H "Content-Type: application/json" \
  -d '{
    "approver": "李总",
    "comments": "预算审核未通过"
  }' | python3 -m json.tool
echo ""
echo ""

echo "[7/8] 获取统计汇总..."
curl -s -X GET "${BASE_URL}/api/v1/quota/stats/summary" | python3 -m json.tool
echo ""
echo ""

echo "[8/8] 一致性校验..."
curl -s -X GET "${BASE_URL}/api/v1/quota/stats/consistency" | python3 -m json.tool
echo ""
echo ""

echo "========================================"
echo "  验收测试完成"
echo "========================================"
echo ""
echo "附加测试命令示例："
echo ""
echo "# 测试撤回流程"
echo "CANCEL_REQ=\"CANCEL-\$(date +%Y%m%d%H%M%S)\""
echo "curl -X POST ${BASE_URL}/api/v1/quota/apply \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{\"quotaCode\":\"QUOTA_003\",\"applyAmount\":5000,\"applicant\":\"王五\",\"requestId\":\"'\${CANCEL_REQ}'\"}'"
echo "curl -X POST ${BASE_URL}/api/v1/quota/\${CANCEL_REQ}/cancel \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{\"operator\":\"王五\",\"comments\":\"取消申请\"}'"
echo ""
echo "# 测试超额申请（应该失败）"
echo "curl -X POST ${BASE_URL}/api/v1/quota/apply \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{\"quotaCode\":\"QUOTA_003\",\"applyAmount\":999999999,\"applicant\":\"测试\",\"requestId\":\"OVERFLOW-\$(date +%s)\"}'"
echo ""
echo "# 查看审计日志"
echo "curl ${BASE_URL}/api/v1/quota/stats/audit?limit=20 | python3 -m json.tool"
