#!/bin/bash

BASE_URL="http://localhost:3000"

echo "=========================================="
echo "  数据修复工单 API - curl 演示脚本"
echo "=========================================="
echo ""
echo "请先确保服务已启动: npm install && npm start"
echo ""

echo "按 Enter 继续..."
read

echo ""
echo "=========================================="
echo "【场景一】正常修复流程 - 订单状态修复"
echo "=========================================="
echo ""

echo "[1] 查询修复前的订单状态 (ORD001)"
curl -s "$BASE_URL/api/v1/data/orders/ORD001" | python3 -m json.tool
echo ""
echo ""

echo "[2] 创建订单状态修复工单"
TICKET_ORDER=$(curl -s -X POST "$BASE_URL/api/v1/tickets" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "订单 ORD001 状态异常修复",
    "description": "用户投诉订单状态异常，需要从 PAID 改为 REFUNDING",
    "creator": "zhangsan",
    "department": "订单中心",
    "reason": "用户申请退款，系统未正确更新状态",
    "repair_actions": [
      {
        "table": "orders",
        "record_id": "ORD001",
        "updates": {
            "status": "REFUNDING"
        }
    ]
  }' | python3 -m json.tool)

TICKET_ID1=$(echo "$TICKET_ORDER" | python3 -c "import sys,json; print(json.load(sys.stdin)['id']" 2>/dev/null || echo "请手动替换ID")

echo "$TICKET_ORDER" | python3 -m json.tool
echo ""
echo "工单 ID: $TICKET_ID1"
echo ""

echo "[3] 执行预检"
PRECHECK_RESULT=$(curl -s -X POST "$BASE_URL/api/v1/tickets/$TICKET_ID1/precheck" | python3 -m json.tool)
echo "$PRECHECK_RESULT"
echo ""
echo ""

echo "[4] 审批 (普通审批"
APPROVAL=$(curl -s -X POST "$BASE_URL/api/v1/tickets/$TICKET_ID1/approve" \
  -H "Content-Type: application/json" \
  -d '{
    "approver": "manager01",
    "level": 1,
    "comment": "已核实，同意修复"
  }' | python3 -m json.tool)
echo "$APPROVAL"
echo ""

echo "[5] 执行修复"
EXECUTION=$(curl -s -X POST "$BASE_URL/api/v1/tickets/$TICKET_ID1/execute" \
  -H "Content-Type: application/json" \
  -d '{
    "executor": "operator01"
  }' | python3 -m json.tool)
echo "$EXECUTION"
echo ""

echo "[6] 查询修复后的订单状态"
curl -s "$BASE_URL/api/v1/data/orders/ORD001" | python3 -m json.tool
echo ""
echo ""

echo "=========================================="
echo "【场景二】预检阻断场景 - 不存在的记录"
echo "=========================================="
echo ""

echo "[1] 创建包含错误的工单"
TICKET_BAD=$(curl -s -X POST "$BASE_URL/api/v1/tickets" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "测试预检阻断",
    "creator": "zhangsan",
    "department": "测试",
    "reason": "测试预检功能",
    "repair_actions": [
      {
        "table": "orders",
        "record_id": "NOT_EXIST_999",
        "updates": {
            "status": "CANCELLED"
        }
      }
    ]
  }' | python3 -m json.tool)

TICKET_ID_BAD=$(echo "$TICKET_BAD" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null || echo "请手动替换")

echo "$TICKET_BAD"
echo ""

echo "[2] 执行预检"
PRECHECK_BAD=$(curl -s -X POST "$BASE_URL/api/v1/tickets/$TICKET_ID_BAD/precheck" | python3 -m json.tool)
echo "$PRECHECK_BAD"
echo ""

echo "[3] 尝试审批"
curl -s -X POST "$BASE_URL/api/v1/tickets/$TICKET_ID_BAD/approve" \
  -H "Content-Type: application/json" \
  -d '{
    "approver": "manager01",
    "level": 1,
    "comment": "测试"
  }' | python3 -m json.tool
echo ""
echo ""

echo "=========================================="
echo "【场景三】高风险字段 - 会员积分修复（需要二级审批"
echo "=========================================="
echo ""

echo "[1] 查询修复前的会员积分 (USER002)"
curl -s "$BASE_URL/api/v1/data/members/USER002" | python3 -m json.tool
echo ""

echo "[2] 创建会员积分修复工单"
TICKET_MEMBER=$(curl -s -X POST "$BASE_URL/api/v1/tickets" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "会员 USER002 积分补发",
    "description": "活动奖励积分未到账，补发 3000积分",
    "creator": "lisi",
    "department": "会员中心",
    "reason": "营销活动奖励",
    "repair_actions": [
      {
        "table": "members",
        "record_id": "USER002",
        "updates": {
            "points": 5000,
            "level": "GOLD"
        }
      }
    ]
  }' | python3 -m json.tool)

TICKET_ID2=$(echo "$TICKET_MEMBER" | python3 -c "import sys,json; print(json.load(sys.stdin)['id']" 2>/dev/null || echo "请手动替换")

echo "$TICKET_MEMBER"
echo "工单 ID: $TICKET_ID2"
echo ""

echo "[3] 执行预检（会检测到高风险字段"
PRECHECK_MEMBER=$(curl -s -X POST "$BASE_URL/api/v1/tickets/$TICKET_ID2/precheck" | python3 -m json.tool)
echo "$PRECHECK_MEMBER"
echo ""
echo "注意: points 和 level 都是高风险字段"
echo ""

echo "[4] 一级审批"
curl -s -X POST "$BASE_URL/api/v1/tickets/$TICKET_ID2/approve" \
  -H "Content-Type: application/json" \
  -d '{
    "approver": "manager01",
    "level": 1,
    "comment": "一级审批通过"
  }' | python3 -m json.tool
echo ""

echo "[5] 尝试执行（会失败，因为需要二级审批"
echo "尝试执行前状态："
curl -s "$BASE_URL/api/v1/tickets/$TICKET_ID2" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f\"当前状态: {d['status']}\n需要审批级别: {d['required_approval_level']}\n当前审批级别: {d['current_approval_level']}"
echo ""
curl -s -X POST "$BASE_URL/api/v1/tickets/$TICKET_ID2/execute" \
  -H "Content-Type: application/json" \
  -d '{
    "executor": "operator01"
  }' | python3 -m json.tool
echo ""

echo "[6] 二级审批"
curl -s -X POST "$BASE_URL/api/v1/tickets/$TICKET_ID2/approve" \
  -H "Content-Type: application/json" \
  -d '{
    "approver": "director01",
    "level": 2,
    "comment": "二级审批通过"
  }' | python3 -m json.tool
echo ""

echo "[7] 再次执行"
curl -s -X POST "$BASE_URL/api/v1/tickets/$TICKET_ID2/execute" \
  -H "Content-Type: application/json" \
  -d '{
    "executor": "operator01"
  }' | python3 -m json.tool
echo ""

echo "[8] 查询修复后的会员信息"
curl -s "$BASE_URL/api/v1/data/members/USER002" | python3 -m json.tool
echo ""
echo ""

echo "=========================================="
echo "【场景四】回滚场景 - 发票状态修复与回滚"
echo "=========================================="
echo ""

echo "[1] 查询修复前的发票状态 (INV001)"
curl -s "$BASE_URL/api/v1/data/invoices/INV001" | python3 -m json.tool
echo ""

echo "[2] 创建发票状态修复工单"
TICKET_INVOICE=$(curl -s -X POST "$BASE_URL/api/v1/tickets" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "发票 INV001 状态修复",
    "description": "发票状态从 PENDING 改为 ISSUED",
    "creator": "wangwu",
    "department": "财务中心",
    "reason": "发票已开具",
    "repair_actions": [
      {
        "table": "invoices",
        "record_id": "INV001",
        "updates": {
            "status": "ISSUED"
        }
      }
    ]
  }' | python3 -m json.tool)

TICKET_ID3=$(echo "$TICKET_INVOICE" | python3 -c "import sys,json; print(json.load(sys.stdin)['id']" 2>/dev/null || echo "请手动替换")

echo "$TICKET_INVOICE"
echo "工单 ID: $TICKET_ID3"
echo ""

echo "[3] 预检"
curl -s -X POST "$BASE_URL/api/v1/tickets/$TICKET_ID3/precheck" | python3 -m json.tool
echo ""

echo "[4] 审批"
curl -s -X POST "$BASE_URL/api/v1/tickets/$TICKET_ID3/approve" \
  -H "Content-Type: application/json" \
  -d '{
    "approver": "manager01",
    "level": 1,
    "comment": "同意"
  }' | python3 -m json.tool
echo ""

echo "[5] 执行修复"
EXEC_RESULT=$(curl -s -X POST "$BASE_URL/api/v1/tickets/$TICKET_ID3/execute" \
  -H "Content-Type: application/json" \
  -d '{
    "executor": "operator01"
  }' | python3 -m json.tool)
echo "$EXEC_RESULT"
echo ""

echo "[6] 查询修复后的发票状态"
curl -s "$BASE_URL/api/v1/data/invoices/INV001" | python3 -m json.tool
echo ""

EXECUTION_ID=$(echo "$EXEC_RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null || echo "请手动替换")
echo "执行记录 ID: $EXECUTION_ID"
echo ""

echo "[7] 准备回滚，需要引用执行记录"
curl -s -X POST "$BASE_URL/api/v1/tickets/$TICKET_ID3/rollback" \
  -H "Content-Type: application/json" \
  -d '{
    "executor": "operator01",
    "reference_execution_id": "$EXECUTION_ID"
  }' | python3 -m json.tool
echo ""

echo "[8] 查询回滚后的发票状态"
curl -s "$BASE_URL/api/v1/data/invoices/INV001" | python3 -m json.tool
echo ""

echo "=========================================="
echo "【场景五】审计报告查询"
echo "=========================================="
echo ""

echo "查询工单1 审计信息"
curl -s "$BASE_URL/api/v1/tickets/$TICKET_ID1" | python3 -m json.tool
echo ""

echo ""
echo "=========================================="
echo "【场景六】重复执行场景"
echo "=========================================="
echo ""

echo "尝试重复执行订单工单1（已成功执行的工单"
curl -s -X POST "$BASE_URL/api/v1/tickets/$TICKET_ID1/execute" \
  -H "Content-Type: application/json" \
  -d '{
    "executor": "operator01"
  }' | python3 -m json.tool
echo ""

echo ""
echo "=========================================="
echo "演示完成"
echo "=========================================="
echo ""
echo "可用查询命令："
echo "  curl -s $BASE_URL/api/v1/tickets | python3 -m json.tool"
echo ""
