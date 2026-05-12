#!/bin/bash

BASE_URL="http://localhost:3000"

echo "=========================================="
echo "审批流超时补偿 API - curl 演示脚本"
echo "=========================================="
echo ""

echo "检查服务状态..."
curl -s "$BASE_URL/health"
echo ""
echo ""

echo "=========================================="
echo "步骤 1: 初始化样例模板"
echo "=========================================="
echo ""
echo "curl 命令:"
echo "curl -X POST $BASE_URL/api/templates/init-samples"
echo ""
echo "响应:"
INIT_RESPONSE=$(curl -s -X POST "$BASE_URL/api/templates/init-samples")
echo "$INIT_RESPONSE"
echo ""

PURCHASE_TEMPLATE_ID=$(echo "$INIT_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
REFUND_TEMPLATE_ID=$(echo "$INIT_RESPONSE" | grep -o '"id":"[^"]*"' | head -2 | tail -1 | cut -d'"' -f4)
PERMISSION_TEMPLATE_ID=$(echo "$INIT_RESPONSE" | grep -o '"id":"[^"]*"' | head -3 | tail -1 | cut -d'"' -f4)

echo "模板 ID:"
echo "  采购审批: $PURCHASE_TEMPLATE_ID"
echo "  退款审批: $REFUND_TEMPLATE_ID"
echo "  权限申请: $PERMISSION_TEMPLATE_ID"
echo ""

echo "=========================================="
echo "场景一: 正常审批流程（采购审批）"
echo "=========================================="
echo ""
echo "1. 发起采购申请"
echo ""
echo "curl 命令:"
cat <<EOF
curl -X POST $BASE_URL/api/processes \\
  -H "Content-Type: application/json" \\
  -d '{
    "templateId": "$PURCHASE_TEMPLATE_ID",
    "applicant": "applicant_zhang",
    "formData": {
      "amount": 5000,
      "description": "采购办公用品"
    }
  }'
EOF
echo ""
echo "响应:"
PROCESS1_RESPONSE=$(curl -s -X POST "$BASE_URL/api/processes" \
  -H "Content-Type: application/json" \
  -d "{\"templateId\":\"$PURCHASE_TEMPLATE_ID\",\"applicant\":\"applicant_zhang\",\"formData\":{\"amount\":5000,\"description\":\"采购办公用品\"}}")
echo "$PROCESS1_RESPONSE"
echo ""

PROCESS1_ID=$(echo "$PROCESS1_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "创建的流程 ID: $PROCESS1_ID"
echo ""

echo "2. 部门经理审批通过 (dept_manager_a)"
echo ""
echo "curl 命令:"
cat <<EOF
curl -X POST $BASE_URL/api/processes/$PROCESS1_ID/approve \\
  -H "Content-Type: application/json" \\
  -d '{
    "approver": "dept_manager_a",
    "comment": "同意采购"
  }'
EOF
echo ""
echo "响应:"
APPROVE1_RESPONSE=$(curl -s -X POST "$BASE_URL/api/processes/$PROCESS1_ID/approve" \
  -H "Content-Type: application/json" \
  -d '{"approver":"dept_manager_a","comment":"同意采购"}')
echo "$APPROVE1_RESPONSE"
echo ""

echo "3. 财务审核通过 (finance_staff_a)"
echo ""
APPROVE2_RESPONSE=$(curl -s -X POST "$BASE_URL/api/processes/$PROCESS1_ID/approve" \
  -H "Content-Type: application/json" \
  -d '{"approver":"finance_staff_a","comment":"预算内，同意"}')
echo "$APPROVE2_RESPONSE"
echo ""

echo "4. 总监审批通过 (director_a)"
echo ""
APPROVE3_RESPONSE=$(curl -s -X POST "$BASE_URL/api/processes/$PROCESS1_ID/approve" \
  -H "Content-Type: application/json" \
  -d '{"approver":"director_a","comment":"同意"}')
echo "$APPROVE3_RESPONSE"
echo ""

echo "5. 查询流程详情（查看操作历史）"
echo ""
echo "curl 命令:"
echo "curl $BASE_URL/api/processes/$PROCESS1_ID"
echo ""
echo "响应:"
DETAIL1_RESPONSE=$(curl -s "$BASE_URL/api/processes/$PROCESS1_ID")
echo "$DETAIL1_RESPONSE"
echo ""

echo "=========================================="
echo "场景二: 超时自动升级（退款审批）"
echo "=========================================="
echo ""
echo "注意：由于实际超时需要等待，这里通过修改存储的方式演示"
echo "实际使用时，请调用 POST /api/timeout/scan 进行超时扫描"
echo ""
echo "执行超时扫描:"
echo ""
echo "curl 命令:"
echo "curl -X POST $BASE_URL/api/timeout/scan"
echo ""
echo "响应:"
SCAN1_RESPONSE=$(curl -s -X POST "$BASE_URL/api/timeout/scan")
echo "$SCAN1_RESPONSE"
echo ""

echo "再次执行超时扫描（应该跳过已处理的，避免重复升级）:"
echo ""
SCAN2_RESPONSE=$(curl -s -X POST "$BASE_URL/api/timeout/scan")
echo "$SCAN2_RESPONSE"
echo ""

echo "=========================================="
echo "场景三: 转派后通过（权限申请）"
echo "=========================================="
echo ""
echo "1. 发起权限申请"
echo ""
PROCESS3_RESPONSE=$(curl -s -X POST "$BASE_URL/api/processes" \
  -H "Content-Type: application/json" \
  -d "{\"templateId\":\"$PERMISSION_TEMPLATE_ID\",\"applicant\":\"applicant_li\",\"formData\":{\"riskLevel\":\"high\",\"description\":\"申请生产数据库访问权限\",\"system\":\"Production DB\",\"permissionType\":\"read_write\"}}")
PROCESS3_ID=$(echo "$PROCESS3_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "创建的流程 ID: $PROCESS3_ID"
echo ""

echo "2. 当前审批人 (dept_manager_a) 转派给 dept_manager_b"
echo ""
echo "curl 命令:"
cat <<EOF
curl -X POST $BASE_URL/api/processes/$PROCESS3_ID/transfer \\
  -H "Content-Type: application/json" \\
  -d '{
    "currentApprover": "dept_manager_a",
    "newApprover": "dept_manager_b",
    "reason": "出差中，委托同事审批"
  }'
EOF
echo ""
echo "响应:"
TRANSFER_RESPONSE=$(curl -s -X POST "$BASE_URL/api/processes/$PROCESS3_ID/transfer" \
  -H "Content-Type: application/json" \
  -d '{"currentApprover":"dept_manager_a","newApprover":"dept_manager_b","reason":"出差中，委托同事审批"}')
echo "$TRANSFER_RESPONSE"
echo ""

echo "3. 转派后的审批人 (dept_manager_b) 审批通过"
echo ""
APPROVE3a_RESPONSE=$(curl -s -X POST "$BASE_URL/api/processes/$PROCESS3_ID/approve" \
  -H "Content-Type: application/json" \
  -d '{"approver":"dept_manager_b","comment":"同意"}')
echo "$APPROVE3a_RESPONSE"
echo ""

echo "4. 查询流程详情（查看转派记录，原审批人是否保留）"
echo ""
DETAIL3_RESPONSE=$(curl -s "$BASE_URL/api/processes/$PROCESS3_ID")
echo "$DETAIL3_RESPONSE"
echo ""

echo "=========================================="
echo "场景四: 撤回后扫描跳过"
echo "=========================================="
echo ""
echo "1. 发起采购申请"
echo ""
PROCESS4_RESPONSE=$(curl -s -X POST "$BASE_URL/api/processes" \
  -H "Content-Type: application/json" \
  -d "{\"templateId\":\"$PURCHASE_TEMPLATE_ID\",\"applicant\":\"applicant_zhao\",\"formData\":{\"amount\":50000,\"description\":\"采购测试设备\"}}")
PROCESS4_ID=$(echo "$PROCESS4_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "创建的流程 ID: $PROCESS4_ID"
echo ""

echo "2. 申请人撤回申请"
echo ""
echo "curl 命令:"
cat <<EOF
curl -X POST $BASE_URL/api/processes/$PROCESS4_ID/withdraw \\
  -H "Content-Type: application/json" \\
  -d '{
    "applicant": "applicant_zhao"
  }'
EOF
echo ""
echo "响应:"
WITHDRAW_RESPONSE=$(curl -s -X POST "$BASE_URL/api/processes/$PROCESS4_ID/withdraw" \
  -H "Content-Type: application/json" \
  -d '{"applicant":"applicant_zhao"}')
echo "$WITHDRAW_RESPONSE"
echo ""

echo "3. 执行超时扫描（应该跳过已撤回的流程）"
echo ""
SCAN3_RESPONSE=$(curl -s -X POST "$BASE_URL/api/timeout/scan")
echo "$SCAN3_RESPONSE"
echo ""

echo "4. 尝试审批已撤回的流程（应该失败）"
echo ""
APPROVE_FAIL_RESPONSE=$(curl -s -X POST "$BASE_URL/api/processes/$PROCESS4_ID/approve" \
  -H "Content-Type: application/json" \
  -d '{"approver":"dept_manager_a","comment":"同意"}')
echo "$APPROVE_FAIL_RESPONSE"
echo ""

echo "=========================================="
echo "演示完成！"
echo "=========================================="
echo ""
echo "您可以使用以下命令查询各流程详情:"
echo ""
echo "正常审批流程:"
echo "  curl $BASE_URL/api/processes/$PROCESS1_ID"
echo ""
echo "转派流程:"
echo "  curl $BASE_URL/api/processes/$PROCESS3_ID"
echo ""
echo "撤回流程:"
echo "  curl $BASE_URL/api/processes/$PROCESS4_ID"
echo ""
echo "查询补偿记录:"
echo "  curl $BASE_URL/api/compensations"
echo ""
