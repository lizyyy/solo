#!/bin/bash

BASE_URL="http://localhost:3001"

echo "======================================"
echo "研发环境租期 API - 完整演示脚本"
echo "======================================"
echo ""
sleep 1

echo "【场景1: 正常申请环境 - 电商项目组】"
echo "--------------------------------------------------"
echo "1. 电商项目组申请测试环境..."
echo ""
APPLY_RESPONSE=$(curl -s -X POST "$BASE_URL/api/leases/apply" \
  -H "Content-Type: application/json" \
  -d '{
    "teamId": "team-002",
    "requester": "张三",
    "reason": "电商系统V2.0功能测试",
    "days": 7
  }')
echo "申请响应:"
echo "$APPLY_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$APPLY_RESPONSE"
LEASE_ID=$(echo "$APPLY_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])" 2>/dev/null)
echo ""
echo "生成的租期ID: $LEASE_ID"
echo ""
sleep 2

echo "2. 管理员审批申请，分配环境..."
echo ""
APPROVE_RESPONSE=$(curl -s -X PUT "$BASE_URL/api/leases/$LEASE_ID/approve" \
  -H "Content-Type: application/json" \
  -d '{"approver": "admin_李总"}')
echo "审批响应:"
echo "$APPROVE_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$APPROVE_RESPONSE"
echo ""
sleep 2

echo "3. 查询所有环境状态..."
echo ""
curl -s "$BASE_URL/api/environments" | python3 -m json.tool 2>/dev/null || curl -s "$BASE_URL/api/environments"
echo ""
sleep 2

echo "【场景2: 续期操作】"
echo "--------------------------------------------------"
echo "4. 电商项目组申请续期..."
echo ""
RENEW_RESPONSE=$(curl -s -X POST "$BASE_URL/api/leases/$LEASE_ID/renew" \
  -H "Content-Type: application/json" \
  -d '{"days": 7}')
echo "续期响应:"
echo "$RENEW_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RENEW_RESPONSE"
echo ""
sleep 2

echo "【场景3: 重复申请被拒】"
echo "--------------------------------------------------"
echo "5. 电商项目组再次申请环境（应该被拒，因为已有活跃环境）..."
echo ""
DUPLICATE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/leases/apply" \
  -H "Content-Type: application/json" \
  -d '{
    "teamId": "team-002",
    "requester": "李四",
    "reason": "另一个测试任务"
  }')
echo "重复申请响应:"
echo "$DUPLICATE_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$DUPLICATE_RESPONSE"
echo ""
sleep 2

echo "【场景4: 主动释放】"
echo "--------------------------------------------------"
echo "6. 电商项目组主动释放环境..."
echo ""
RELEASE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/leases/$LEASE_ID/release" \
  -H "Content-Type: application/json" \
  -d '{"actor": "张三"}')
echo "释放响应:"
echo "$RELEASE_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RELEASE_RESPONSE"
echo ""
sleep 2

echo "7. 释放后查询环境状态..."
echo ""
curl -s "$BASE_URL/api/environments" | python3 -m json.tool 2>/dev/null || curl -s "$BASE_URL/api/environments"
echo ""
sleep 2

echo "【场景5: 平台组申请环境】"
echo "--------------------------------------------------"
echo "8. 平台组申请测试环境..."
echo ""
PLATFORM_APPLY=$(curl -s -X POST "$BASE_URL/api/leases/apply" \
  -H "Content-Type: application/json" \
  -d '{
    "teamId": "team-001",
    "requester": "王五",
    "reason": "平台组件升级测试",
    "days": 14
  }')
echo "申请响应:"
echo "$PLATFORM_APPLY" | python3 -m json.tool 2>/dev/null || echo "$PLATFORM_APPLY"
PLATFORM_LEASE_ID=$(echo "$PLATFORM_APPLY" | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])" 2>/dev/null)
echo ""
sleep 2

echo "9. 审批平台组申请..."
echo ""
curl -s -X PUT "$BASE_URL/api/leases/$PLATFORM_LEASE_ID/approve" \
  -H "Content-Type: application/json" \
  -d '{"approver": "admin_李总"}' | python3 -m json.tool 2>/dev/null || curl -s -X PUT "$BASE_URL/api/leases/$PLATFORM_LEASE_ID/approve" -H "Content-Type: application/json" -d '{"approver": "admin_李总"}'
echo ""
sleep 2

echo "【场景6: 查询功能演示】"
echo "--------------------------------------------------"
echo "10. 查询即将到期列表（7天内）..."
echo ""
curl -s "$BASE_URL/api/leases/expiring?days=7" | python3 -m json.tool 2>/dev/null || curl -s "$BASE_URL/api/leases/expiring?days=7"
echo ""
sleep 2

echo "11. 费用归属统计..."
echo ""
curl -s "$BASE_URL/api/statistics/cost" | python3 -m json.tool 2>/dev/null || curl -s "$BASE_URL/api/statistics/cost"
echo ""
sleep 2

echo "12. 历史审计记录（最近10条）..."
echo ""
curl -s "$BASE_URL/api/audit-logs?limit=10" | python3 -m json.tool 2>/dev/null || curl -s "$BASE_URL/api/audit-logs?limit=10"
echo ""
sleep 2

echo "13. 平台组租期详情（包含任务和审计）..."
echo ""
curl -s "$BASE_URL/api/leases/$PLATFORM_LEASE_ID" | python3 -m json.tool 2>/dev/null || curl -s "$BASE_URL/api/leases/$PLATFORM_LEASE_ID"
echo ""
sleep 2

echo "【场景7: 到期释放】"
echo "--------------------------------------------------"
echo "14. 支付项目组申请1天短租期..."
echo ""
PAYMENT_APPLY=$(curl -s -X POST "$BASE_URL/api/leases/apply" \
  -H "Content-Type: application/json" \
  -d '{
    "teamId": "team-003",
    "requester": "赵六",
    "reason": "支付接口快速验证",
    "days": 1
  }')
echo "$PAYMENT_APPLY" | python3 -m json.tool 2>/dev/null || echo "$PAYMENT_APPLY"
PAYMENT_LEASE_ID=$(echo "$PAYMENT_APPLY" | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])" 2>/dev/null)
echo ""
sleep 2

echo "15. 审批支付项目组申请..."
echo ""
curl -s -X PUT "$BASE_URL/api/leases/$PAYMENT_LEASE_ID/approve" \
  -H "Content-Type: application/json" \
  -d '{"approver": "admin_李总"}' | python3 -m json.tool 2>/dev/null || curl -s -X PUT "$BASE_URL/api/leases/$PAYMENT_LEASE_ID/approve" -H "Content-Type: application/json" -d '{"approver": "admin_李总"}'
echo ""
sleep 2

echo "16. 查询审计记录中的释放类型（expire/release）..."
echo ""
curl -s "$BASE_URL/api/audit-logs?action=expire&limit=5" | python3 -m json.tool 2>/dev/null || curl -s "$BASE_URL/api/audit-logs?action=expire&limit=5"
echo ""

echo "======================================"
echo "演示完成！"
echo "======================================"
echo ""
echo "提示: 由于实际到期需要等待，你可以重启服务后手动模拟到期场景"
echo "或查看代码中的 checkExpiredLeases 函数来理解到期释放逻辑"
echo ""
