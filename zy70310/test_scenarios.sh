#!/bin/bash

BASE_URL="http://localhost:5000/api"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "========================================"
echo "  内部服务配额 API - 测试场景演示"
echo "========================================"
echo ""

echo "步骤 1: 查看现有团队和服务"
echo "----------------------------------------"
echo "获取团队列表:"
curl -s "$BASE_URL/teams" | python3 -m json.tool
echo ""
echo "获取服务列表:"
curl -s "$BASE_URL/services" | python3 -m json.tool
echo ""
echo ""

echo "步骤 2: 查看交易平台团队的配额情况"
echo "----------------------------------------"
echo "交易平台团队 ID=1 的配额:"
curl -s "$BASE_URL/teams/1/quotas" | python3 -m json.tool
echo ""
echo ""

echo "步骤 3: 场景一 - 正常计量（在配额内调用）"
echo "----------------------------------------"
echo "交易平台团队调用统一认证服务（配额 50000，使用 100）:"
curl -s -X POST "$BASE_URL/usage" \
  -H "Content-Type: application/json" \
  -d '{
    "team_id": 1,
    "service_id": 1,
    "request_id": "req_normal_001",
    "amount": 100
  }' | python3 -m json.tool
echo ""
echo "查看剩余额度:"
curl -s "$BASE_URL/teams/1/quotas" | python3 "$SCRIPT_DIR/helpers.py" print_quota_remaining 1
echo ""
echo ""

echo "步骤 4: 场景二 - 重复上报调用量"
echo "----------------------------------------"
echo "使用相同 request_id 再次上报（应返回重复）:"
curl -s -X POST "$BASE_URL/usage" \
  -H "Content-Type: application/json" \
  -d '{
    "team_id": 1,
    "service_id": 1,
    "request_id": "req_normal_001",
    "amount": 100
  }' | python3 -m json.tool
echo ""
echo "验证额度未重复扣减:"
curl -s "$BASE_URL/teams/1/quotas" | python3 "$SCRIPT_DIR/helpers.py" print_quota_used 1
echo ""
echo ""

echo "步骤 5: 场景三 - 超额冻结（低优先级调用被拒绝）"
echo "----------------------------------------"
echo "先使用掉大部分配额（49800）:"
curl -s -X POST "$BASE_URL/usage" \
  -H "Content-Type: application/json" \
  -d '{
    "team_id": 1,
    "service_id": 1,
    "request_id": "req_large_001",
    "amount": 49800
  }' | python3 -m json.tool
echo ""
echo "查看当前剩余额度:"
curl -s "$BASE_URL/teams/1/quotas" | python3 "$SCRIPT_DIR/helpers.py" print_total_available 1
echo ""
echo "尝试使用 500 单位（剩余 100，应该被冻结）:"
curl -s -X POST "$BASE_URL/usage" \
  -H "Content-Type: application/json" \
  -d '{
    "team_id": 1,
    "service_id": 1,
    "request_id": "req_frozen_001",
    "amount": 500,
    "priority": "normal"
  }' | python3 -m json.tool
echo ""
echo "查看被冻结的调用:"
curl -s "$BASE_URL/teams/1/quotas" | python3 "$SCRIPT_DIR/helpers.py" print_frozen_calls 1
echo ""
echo ""

echo "步骤 6: 场景四 - 高优先级调用超额（记录风险，不拒绝）"
echo "----------------------------------------"
echo "高优先级调用（超额 400，应记录风险）:"
curl -s -X POST "$BASE_URL/usage" \
  -H "Content-Type: application/json" \
  -d '{
    "team_id": 1,
    "service_id": 1,
    "request_id": "req_risk_001",
    "amount": 500,
    "priority": "high"
  }' | python3 -m json.tool
echo ""
echo "查看当前状态:"
curl -s "$BASE_URL/teams/1/quotas" | python3 "$SCRIPT_DIR/helpers.py" print_quota_status 1
echo ""
echo ""

echo "步骤 7: 场景五 - 临时扩容申请与审批"
echo "----------------------------------------"
echo "数据智能团队申请订单查询服务扩容 20000:"
today=$(date +%Y-%m-%d)
next_week=$(date -v+7d +%Y-%m-%d 2>/dev/null || date -d "+7 day" +%Y-%m-%d)

expansion_response=$(curl -s -X POST "$BASE_URL/expansions" \
  -H "Content-Type: application/json" \
  -d "{
    \"team_id\": 2,
    \"service_id\": 2,
    \"amount\": 20000,
    \"reason\": \"双11活动期间数据查询量激增\",
    \"start_date\": \"${today}T00:00:00\",
    \"end_date\": \"${next_week}T23:59:59\"
  }")
echo "$expansion_response" | python3 -m json.tool

expansion_id=$(echo "$expansion_response" | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])")
echo "扩容申请 ID: $expansion_id"
echo ""
echo "审批扩容申请:"
curl -s -X POST "$BASE_URL/expansions/${expansion_id}/approve" \
  -H "Content-Type: application/json" \
  -d '{"approval_note": "同意活动期间临时扩容"}' | python3 -m json.tool
echo ""
echo "查看数据智能团队配额（应包含扩容额度）:"
curl -s "$BASE_URL/teams/2/quotas" | python3 "$SCRIPT_DIR/helpers.py" print_expansion_status 2
echo ""
echo ""

echo "步骤 8: 场景六 - 借用其他团队配额"
echo "----------------------------------------"
echo "支付网关团队向用户中心团队借用统一认证服务配额:"
echo "查看借用前双方配额:"
echo "支付网关团队 (ID=3):"
curl -s "$BASE_URL/teams/3/quotas" | python3 "$SCRIPT_DIR/helpers.py" print_base_remaining 1
echo "用户中心团队 (ID=4):"
curl -s "$BASE_URL/teams/4/quotas" | python3 "$SCRIPT_DIR/helpers.py" print_base_remaining 1
echo ""

echo "支付网关团队发起借用申请（借用 10000）:"
borrow_response=$(curl -s -X POST "$BASE_URL/borrows" \
  -H "Content-Type: application/json" \
  -d '{
    "borrower_id": 3,
    "lender_id": 4,
    "service_id": 1,
    "amount": 10000,
    "reason": "支付系统高峰，需要额外认证配额"
  }')
echo "$borrow_response" | python3 -m json.tool

borrow_id=$(echo "$borrow_response" | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])")
echo "借用申请 ID: $borrow_id"
echo ""
echo "尝试在审批前使用借用额度（应该失败，因为未审批）:"
curl -s -X POST "$BASE_URL/usage" \
  -H "Content-Type: application/json" \
  -d '{
    "team_id": 3,
    "service_id": 1,
    "request_id": "req_try_borrow_before",
    "amount": 50000
  }' | python3 -m json.tool
echo ""
echo "审批借用申请:"
curl -s -X POST "$BASE_URL/borrows/${borrow_id}/approve" \
  -H "Content-Type: application/json" \
  -d '{"approval_note": "同意支持支付团队高峰需求"}' | python3 -m json.tool
echo ""
echo "查看双方借用关系:"
echo "支付网关团队（借入方）:"
curl -s "$BASE_URL/teams/3/borrows" | python3 -m json.tool
echo ""
echo "用户中心团队（借出方）:"
curl -s "$BASE_URL/teams/4/borrows" | python3 -m json.tool
echo ""
echo "现在使用借用的额度:"
curl -s -X POST "$BASE_URL/usage" \
  -H "Content-Type: application/json" \
  -d '{
    "team_id": 3,
    "service_id": 1,
    "request_id": "req_use_borrowed",
    "amount": 5000
  }' | python3 -m json.tool
echo ""
echo "查看借用额度使用情况:"
curl -s "$BASE_URL/teams/3/borrows" | python3 "$SCRIPT_DIR/helpers.py" print_borrow_usage
echo ""
echo ""

echo "步骤 9: 生成月度对账"
echo "----------------------------------------"
echo "生成当前月份对账:"
curl -s -X POST "$BASE_URL/reconciliation" \
  -H "Content-Type: application/json" \
  -d '{}' | python3 -m json.tool
echo ""
echo "查询交易平台团队的对账详情:"
curl -s "$BASE_URL/reconciliation?team_id=1" | python3 -m json.tool
echo ""
echo "查询数据智能团队的对账（含扩容）:"
curl -s "$BASE_URL/reconciliation?team_id=2" | python3 "$SCRIPT_DIR/helpers.py" print_recon_expansion
echo ""
echo "查询借用双方的对账:"
echo "支付网关团队（借入）:"
curl -s "$BASE_URL/reconciliation?team_id=3" | python3 "$SCRIPT_DIR/helpers.py" print_recon_borrowed
echo "用户中心团队（借出）:"
curl -s "$BASE_URL/reconciliation?team_id=4" | python3 "$SCRIPT_DIR/helpers.py" print_recon_lent
echo ""
echo ""

echo "========================================"
echo "  所有场景演示完成！"
echo "========================================"
echo ""
echo "总结测试场景:"
echo "  ✓ 正常计量"
echo "  ✓ 重复上报去重"
echo "  ✓ 超额冻结（低优先级拒绝）"
echo "  ✓ 高优先级超额（记录风险）"
echo "  ✓ 临时扩容申请与审批"
echo "  ✓ 借用审批流程（未审批不生效）"
echo "  ✓ 借用额度使用追踪"
echo "  ✓ 月度对账生成与查询"
echo ""
