#!/bin/bash

BASE_URL="http://localhost:8080/api/v1"

echo "=========================================="
echo "夜市摊位轮换 API 测试脚本"
echo "=========================================="

echo ""
echo "场景 1: 正常流程 - 创建轮换周期并分配摊位"
echo "------------------------------------------"

echo "1.1 创建新的轮换周期"
CYCLE_RESPONSE=$(curl -s -X POST "$BASE_URL/cycles" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "2026年第3周轮换",
    "start_date": "2026-05-18",
    "end_date": "2026-05-24",
    "created_by": "管理员"
  }')
echo "$CYCLE_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$CYCLE_RESPONSE"
CYCLE_ID=$(echo "$CYCLE_RESPONSE" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
echo "周期ID: $CYCLE_ID"

echo ""
echo "1.2 查看所有摊主"
curl -s "$BASE_URL/vendors" | python3 -m json.tool 2>/dev/null | head -50

echo ""
echo "1.3 查看所有摊位"
curl -s "$BASE_URL/stalls" | python3 -m json.tool 2>/dev/null | head -50

echo ""
echo "1.4 验证单个分配（老张烧烤 -> C01摊位）"
curl -s -X POST "$BASE_URL/validation/assignment" \
  -H "Content-Type: application/json" \
  -d '{
    "vendor_id": "vendor-001",
    "stall_id": "stall-006"
  }' | python3 -m json.tool 2>/dev/null

echo ""
echo "1.5 创建第一个分配（老张烧烤 -> C01）"
curl -s -X POST "$BASE_URL/cycles/$CYCLE_ID/assignments" \
  -H "Content-Type: application/json" \
  -d '{
    "cycle_id": "'$CYCLE_ID'",
    "vendor_id": "vendor-001",
    "stall_id": "stall-006",
    "operator": "管理员"
  }' | python3 -m json.tool 2>/dev/null

echo ""
echo "1.6 创建第二个分配（小李奶茶 -> B01）"
curl -s -X POST "$BASE_URL/cycles/$CYCLE_ID/assignments" \
  -H "Content-Type: application/json" \
  -d '{
    "cycle_id": "'$CYCLE_ID'",
    "vendor_id": "vendor-002",
    "stall_id": "stall-004",
    "operator": "管理员"
  }' | python3 -m json.tool 2>/dev/null

echo ""
echo "1.7 创建第三个分配（王记炒饭 -> A01）"
curl -s -X POST "$BASE_URL/cycles/$CYCLE_ID/assignments" \
  -H "Content-Type: application/json" \
  -d '{
    "cycle_id": "'$CYCLE_ID'",
    "vendor_id": "vendor-003",
    "stall_id": "stall-001",
    "operator": "管理员"
  }' | python3 -m json.tool 2>/dev/null

echo ""
echo "1.8 创建第四个分配（陈记饰品 -> B02）"
curl -s -X POST "$BASE_URL/cycles/$CYCLE_ID/assignments" \
  -H "Content-Type: application/json" \
  -d '{
    "cycle_id": "'$CYCLE_ID'",
    "vendor_id": "vendor-004",
    "stall_id": "stall-005",
    "operator": "管理员"
  }' | python3 -m json.tool 2>/dev/null

echo ""
echo "1.9 查看当前分配列表"
curl -s "$BASE_URL/cycles/$CYCLE_ID/assignments" | python3 -m json.tool 2>/dev/null

echo ""
echo "1.10 校验整个周期"
curl -s -X POST "$BASE_URL/cycles/$CYCLE_ID/validate" \
  -H "Content-Type: application/json" \
  -d '{"operator": "管理员"}' | python3 -m json.tool 2>/dev/null

echo ""
echo "1.11 定稿轮换周期"
curl -s -X POST "$BASE_URL/cycles/$CYCLE_ID/finalize" \
  -H "Content-Type: application/json" \
  -d '{"operator": "管理员"}' | python3 -m json.tool 2>/dev/null

echo ""
echo "=========================================="
echo "场景 2: 冲突场景 - 容量错配验证"
echo "------------------------------------------"

echo "2.1 创建新周期用于冲突测试"
CYCLE2_RESPONSE=$(curl -s -X POST "$BASE_URL/cycles" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "冲突测试周期",
    "start_date": "2026-05-25",
    "end_date": "2026-05-31",
    "created_by": "测试员"
  }')
CYCLE2_ID=$(echo "$CYCLE2_RESPONSE" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
echo "冲突测试周期ID: $CYCLE2_ID"

echo ""
echo "2.2 测试高功率错配（老张烧烤7000W -> A01摊位5000W）"
curl -s -X POST "$BASE_URL/cycles/$CYCLE2_ID/assignments" \
  -H "Content-Type: application/json" \
  -d '{
    "cycle_id": "'$CYCLE2_ID'",
    "vendor_id": "vendor-001",
    "stall_id": "stall-001",
    "operator": "测试员"
  }' | python3 -m json.tool 2>/dev/null

echo ""
echo "2.3 测试油烟需求错配（王记炒饭需要油烟 -> A03无油烟）"
curl -s -X POST "$BASE_URL/cycles/$CYCLE2_ID/assignments" \
  -H "Content-Type: application/json" \
  -d '{
    "cycle_id": "'$CYCLE2_ID'",
    "vendor_id": "vendor-003",
    "stall_id": "stall-003",
    "operator": "测试员"
  }' | python3 -m json.tool 2>/dev/null

echo ""
echo "2.4 查看当前分配列表"
curl -s "$BASE_URL/cycles/$CYCLE2_ID/assignments" | python3 -m json.tool 2>/dev/null

echo ""
echo "2.5 校验周期（应该检测到问题）"
curl -s -X POST "$BASE_URL/cycles/$CYCLE2_ID/validate" \
  -H "Content-Type: application/json" \
  -d '{"operator": "测试员"}' | python3 -m json.tool 2>/dev/null

echo ""
echo "2.6 尝试定稿（应该失败，因为有问题）"
curl -s -X POST "$BASE_URL/cycles/$CYCLE2_ID/finalize" \
  -H "Content-Type: application/json" \
  -d '{"operator": "测试员"}' | python3 -m json.tool 2>/dev/null

echo ""
echo "=========================================="
echo "场景 3: 撤回场景 - 撤回分配和周期"
echo "------------------------------------------"

echo "3.1 删除一个有问题的分配"
ASSIGNMENTS=$(curl -s "$BASE_URL/cycles/$CYCLE2_ID/assignments")
FIRST_ASSIGN_ID=$(echo "$ASSIGNMENTS" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "删除分配ID: $FIRST_ASSIGN_ID"
curl -s -X DELETE "$BASE_URL/cycles/assignments/$FIRST_ASSIGN_ID" \
  -H "Content-Type: application/json" \
  -d '{"operator": "测试员"}' | python3 -m json.tool 2>/dev/null

echo ""
echo "3.2 修复后重新分配（王记炒饭 -> A02有油烟）"
curl -s -X POST "$BASE_URL/cycles/$CYCLE2_ID/assignments" \
  -H "Content-Type: application/json" \
  -d '{
    "cycle_id": "'$CYCLE2_ID'",
    "vendor_id": "vendor-003",
    "stall_id": "stall-002",
    "operator": "测试员"
  }' | python3 -m json.tool 2>/dev/null

echo ""
echo "3.3 修复高功率问题（老张烧烤 -> C01）"
curl -s -X POST "$BASE_URL/cycles/$CYCLE2_ID/assignments" \
  -H "Content-Type: application/json" \
  -d '{
    "cycle_id": "'$CYCLE2_ID'",
    "vendor_id": "vendor-001",
    "stall_id": "stall-006",
    "operator": "测试员"
  }' | python3 -m json.tool 2>/dev/null

echo ""
echo "3.4 重新校验周期"
curl -s -X POST "$BASE_URL/cycles/$CYCLE2_ID/validate" \
  -H "Content-Type: application/json" \
  -d '{"operator": "测试员"}' | python3 -m json.tool 2>/dev/null

echo ""
echo "=========================================="
echo "场景 4: 投诉处理和扣分"
echo "------------------------------------------"

echo "4.1 查看待处理投诉"
curl -s "$BASE_URL/complaints/pending" | python3 -m json.tool 2>/dev/null

echo ""
echo "4.2 处理第一个投诉（批准扣分）"
COMPLAINTS=$(curl -s "$BASE_URL/complaints/pending")
FIRST_COMPLAINT_ID=$(echo "$COMPLAINTS" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "处理投诉ID: $FIRST_COMPLAINT_ID"
curl -s -X POST "$BASE_URL/complaints/$FIRST_COMPLAINT_ID/resolve" \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "管理员",
    "apply_deduction": true
  }' | python3 -m json.tool 2>/dev/null

echo ""
echo "4.3 驳回第二个投诉（不扣分）"
SECOND_COMPLAINT_ID=$(echo "$COMPLAINTS" | grep -o '"id":"[^"]*"' | head -2 | tail -1 | cut -d'"' -f4)
echo "驳回投诉ID: $SECOND_COMPLAINT_ID"
curl -s -X POST "$BASE_URL/complaints/$SECOND_COMPLAINT_ID/reject" \
  -H "Content-Type: application/json" \
  -d '{"operator": "管理员"}' | python3 -m json.tool 2>/dev/null

echo ""
echo "4.4 查看摊主分数变化（赵家炸串 vendor-007）"
curl -s "$BASE_URL/vendors" | python3 -m json.tool 2>/dev/null | grep -A 20 "vendor-007"

echo ""
echo "=========================================="
echo "场景 5: 换位状态机流程"
echo "------------------------------------------"

echo "5.1 在正常周期中创建换位申请（小李奶茶 <-> 陈记饰品）"
SWAP_RESPONSE=$(curl -s -X POST "$BASE_URL/cycles/$CYCLE_ID/swaps" \
  -H "Content-Type: application/json" \
  -d '{
    "cycle_id": "'$CYCLE_ID'",
    "requesting_vendor_id": "vendor-002",
    "target_vendor_id": "vendor-004",
    "reason": "希望换到更好的位置"
  }')
echo "$SWAP_RESPONSE" | python3 -m json.tool 2>/dev/null
SWAP_ID=$(echo "$SWAP_RESPONSE" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
echo "换位申请ID: $SWAP_ID"

echo ""
echo "5.2 批准换位申请"
curl -s -X POST "$BASE_URL/swaps/$SWAP_ID/approve" \
  -H "Content-Type: application/json" \
  -d '{"operator": "管理员"}' | python3 -m json.tool 2>/dev/null

echo ""
echo "5.3 完成换位（更新实际分配）"
curl -s -X POST "$BASE_URL/swaps/$SWAP_ID/complete" \
  -H "Content-Type: application/json" \
  -d '{"operator": "管理员"}' | python3 -m json.tool 2>/dev/null

echo ""
echo "5.4 查看换位后的分配"
curl -s "$BASE_URL/cycles/$CYCLE_ID/assignments" | python3 -m json.tool 2>/dev/null

echo ""
echo "=========================================="
echo "场景 6: 人工修正和重新打开"
echo "------------------------------------------"

echo "6.1 尝试重新打开已完成的周期"
curl -s -X POST "$BASE_URL/cycles/$CYCLE_ID/reopen" \
  -H "Content-Type: application/json" \
  -d '{"operator": "管理员"}' | python3 -m json.tool 2>/dev/null

echo ""
echo "6.2 添加新的分配（刘姐麻辣烫 -> C02）"
curl -s -X POST "$BASE_URL/cycles/$CYCLE_ID/assignments" \
  -H "Content-Type: application/json" \
  -d '{
    "cycle_id": "'$CYCLE_ID'",
    "vendor_id": "vendor-005",
    "stall_id": "stall-007",
    "operator": "管理员"
  }' | python3 -m json.tool 2>/dev/null

echo ""
echo "6.3 重新校验和定稿"
curl -s -X POST "$BASE_URL/cycles/$CYCLE_ID/validate" \
  -H "Content-Type: application/json" \
  -d '{"operator": "管理员"}' | python3 -m json.tool 2>/dev/null

curl -s -X POST "$BASE_URL/cycles/$CYCLE_ID/finalize" \
  -H "Content-Type: application/json" \
  -d '{"operator": "管理员"}' | python3 -m json.tool 2>/dev/null

echo ""
echo "=========================================="
echo "场景 7: 报告生成和导出"
echo "------------------------------------------"

echo "7.1 生成轮换报告"
curl -s "$BASE_URL/cycles/$CYCLE_ID/report" | python3 -m json.tool 2>/dev/null | head -80

echo ""
echo "7.2 导出CSV报告"
curl -s "$BASE_URL/cycles/$CYCLE_ID/export" | python3 -m json.tool 2>/dev/null

echo ""
echo "7.3 查看审计日志"
curl -s "$BASE_URL/audit/logs" | python3 -m json.tool 2>/dev/null | head -60

echo ""
echo "=========================================="
echo "测试完成！"
echo "=========================================="
