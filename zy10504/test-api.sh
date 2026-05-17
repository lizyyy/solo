#!/bin/bash

BASE_URL="http://localhost:3000"

echo "======================================"
echo "代码冻结例外API测试脚本"
echo "======================================"
echo ""

echo "1. 创建测试仓库..."
REPO_RESPONSE=$(curl -s -X POST "$BASE_URL/api/repositories" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "frontend-app",
    "description": "前端主应用仓库"
  }')
echo "仓库创建响应: $REPO_RESPONSE"
REPO_ID=$(echo $REPO_RESPONSE | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
echo "仓库ID: $REPO_ID"
echo ""

echo "2. 查询仓库列表..."
curl -s "$BASE_URL/api/repositories" | head -c 500
echo ""
echo ""

echo "3. 创建冻结规则..."
RULE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/freeze-rules" \
  -H "Content-Type: application/json" \
  -d "{
    \"repo_id\": \"$REPO_ID\",
    \"rule_name\": \"2024年Q2发布冻结\",
    \"freeze_start\": \"2024-06-01T00:00:00Z\",
    \"freeze_end\": \"2024-06-15T23:59:59Z\",
    \"allowed_users\": \"release-manager\",
    \"allowed_branches\": \"main\",
    \"created_by\": \"admin\"
  }")
echo "冻结规则创建响应: $RULE_RESPONSE"
RULE_ID=$(echo $RULE_RESPONSE | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
echo "规则ID: $RULE_ID"
echo ""

echo "4. 创建例外申请..."
REQUEST_RESPONSE=$(curl -s -X POST "$BASE_URL/api/exception-requests" \
  -H "Content-Type: application/json" \
  -d "{
    \"repo_id\": \"$REPO_ID\",
    \"rule_id\": \"$RULE_ID\",
    \"title\": \"紧急修复：支付页面崩溃\",
    \"description\": \"用户在支付页面点击确认支付后页面崩溃，影响所有线上用户\",
    \"risk_level\": \"critical\",
    \"risk_description\": \"影响核心支付流程，可能导致订单丢失和用户投诉\",
    \"requester\": \"developer-zhang\",
    \"branch\": \"hotfix/payment-crash\"
  }")
echo "例外申请创建响应: $REQUEST_RESPONSE"
REQUEST_ID=$(echo $REQUEST_RESPONSE | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
echo "申请ID: $REQUEST_ID"
echo ""

echo "5. 查询例外申请列表..."
curl -s "$BASE_URL/api/exception-requests" | head -c 1000
echo ""
echo ""

echo "6. 审批例外申请..."
curl -s -X POST "$BASE_URL/api/exception-requests/$REQUEST_ID/approve" \
  -H "Content-Type: application/json" \
  -d "{
    \"approver\": \"tech-leader-li\",
    \"reason\": \"确认是P0级紧急问题，批准紧急修复\",
    \"release_window_start\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\",
    \"release_window_end\": \"$(date -u -v+2H +"%Y-%m-%dT%H:%M:%SZ")\"
  }"
echo ""
echo ""

echo "7. 推进状态到进行中..."
curl -s -X PUT "$BASE_URL/api/exception-requests/$REQUEST_ID/status" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "in_progress",
    "operator": "developer-zhang",
    "reason": "开始执行紧急修复"
  }'
echo ""
echo ""

echo "8. 推进状态到已完成..."
curl -s -X PUT "$BASE_URL/api/exception-requests/$REQUEST_ID/status" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "completed",
    "operator": "developer-zhang",
    "reason": "修复完成并验证通过",
    "commit_hash": "a1b2c3d4e5f6"
  }'
echo ""
echo ""

echo "9. 人工修正申请..."
curl -s -X PUT "$BASE_URL/api/exception-requests/$REQUEST_ID/manual-correct" \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "admin",
    "reason": "补充风险说明",
    "updates": {
      "risk_description": "影响核心支付流程，可能导致订单丢失和用户投诉，已联系客服团队安抚用户"
    }
  }'
echo ""
echo ""

echo "10. 记录审计结论..."
curl -s -X POST "$BASE_URL/api/exception-requests/$REQUEST_ID/audit-conclusion" \
  -H "Content-Type: application/json" \
  -d '{
    "conclusion": "合规通过",
    "auditor": "qa-manager",
    "findings": "审批流程完整，风险评估充分，放行窗口合理",
    "recommendations": "建议后续加强单元测试覆盖"
  }'
echo ""
echo ""

echo "11. 查询审计日志..."
curl -s "$BASE_URL/api/exception-requests/$REQUEST_ID/audit-logs" | head -c 2000
echo ""
echo ""

echo "12. 导出申请清单 (JSON格式)..."
curl -s "$BASE_URL/api/export/exception-requests?format=json" | head -c 3000
echo ""
echo ""

echo "13. 导出审计轨迹..."
curl -s "$BASE_URL/api/export/audit-trails?request_id=$REQUEST_ID" | head -c 2000
echo ""
echo ""

echo "======================================"
echo "测试完成！"
echo "======================================"
echo ""
echo "交接人复核常用命令："
echo ""
echo "# 查询所有待审批申请"
echo "curl '$BASE_URL/api/exception-requests?status=pending'"
echo ""
echo "# 查询高风险申请"
echo "curl '$BASE_URL/api/exception-requests?risk_level=critical'"
echo ""
echo "# 导出CSV给业务同事"
echo "curl -O -J '$BASE_URL/api/export/exception-requests?format=csv'"
echo ""
echo "# 查看完整审计轨迹"
echo "curl '$BASE_URL/api/exception-requests/<申请ID>/audit-logs'"
echo ""
