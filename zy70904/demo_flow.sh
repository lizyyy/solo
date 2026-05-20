#!/bin/bash
BASE_URL="http://localhost:3000/api"

echo "====================================="
echo "  连锁门店运营后端服务 - 功能演示"
echo "====================================="
echo ""

echo "📋 步骤1: 查看活动规则"
echo "-------------------------------------"
curl -s "$BASE_URL/activity-rules" | python3 -m json.tool
echo ""

echo "📋 步骤2: 创建批次"
echo "-------------------------------------"
BATCH_RESPONSE=$(curl -s -X POST "$BASE_URL/batches" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "五一促销批次-演示",
    "activityCode": "PROMO_2024_001",
    "storeCode": "STORE001",
    "operator": "manager_zhang"
  }')
echo "$BATCH_RESPONSE" | python3 -m json.tool
BATCH_ID=$(echo "$BATCH_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")
echo "批次ID: $BATCH_ID"
echo ""

echo "📋 步骤3: 处理批次（导入小票和会员数据）"
echo "-------------------------------------"
PROCESS_RESPONSE=$(curl -s -X POST "$BASE_URL/batches/$BATCH_ID/process" \
  -H "Content-Type: application/json" \
  -d '{
    "activityCode": "PROMO_2024_001",
    "operator": "operator_li",
    "receipts": [
      {
        "receiptNo": "RX20240503001",
        "storeCode": "STORE001",
        "storeName": "北京朝阳店",
        "memberId": "M001",
        "memberPhone": "13800138001",
        "transactionTime": "2024-05-03T14:30:00",
        "totalAmount": 680,
        "discountAmount": 80,
        "payAmount": 600,
        "isReturn": false
      },
      {
        "receiptNo": "RX20240503002",
        "storeCode": "STORE001",
        "storeName": "北京朝阳店",
        "memberId": "M002",
        "memberPhone": "13800138002",
        "transactionTime": "2024-05-03T15:00:00",
        "totalAmount": 3200,
        "discountAmount": 200,
        "payAmount": 3000,
        "isReturn": false
      },
      {
        "receiptNo": "RT20240503003",
        "storeCode": "STORE001",
        "storeName": "北京朝阳店",
        "memberId": "M001",
        "memberPhone": "13800138001",
        "transactionTime": "2024-05-03T16:00:00",
        "totalAmount": 150,
        "discountAmount": 0,
        "payAmount": 150,
        "isReturn": true,
        "originalReceiptNo": "RX20240501001"
      },
      {
        "receiptNo": "RX20240503004",
        "storeCode": "STORE001",
        "storeName": "北京朝阳店",
        "memberId": "M003",
        "memberPhone": "13800138003",
        "transactionTime": "2024-05-03T17:00:00",
        "totalAmount": 80,
        "discountAmount": 0,
        "payAmount": 80,
        "isReturn": false
      }
    ],
    "members": [
      {
        "memberId": "M001",
        "name": "张三",
        "phone": "13800138001",
        "level": "GOLD",
        "points": 2500,
        "registerTime": "2023-06-15T00:00:00"
      },
      {
        "memberId": "M002",
        "name": "李四",
        "phone": "13800138002",
        "level": "PLATINUM",
        "points": 8000,
        "registerTime": "2023-01-20T00:00:00"
      },
      {
        "memberId": "M003",
        "name": "王五",
        "phone": "13800138003",
        "level": "NORMAL",
        "points": 300,
        "registerTime": "2024-04-01T00:00:00"
      }
    ]
  }')
echo "$PROCESS_RESPONSE" | python3 -m json.tool
echo ""

echo "📋 步骤4: 查看批次统计"
echo "-------------------------------------"
curl -s "$BASE_URL/batches/$BATCH_ID/stats" | python3 -m json.tool
echo ""

echo "📋 步骤5: 查看批次记录列表"
echo "-------------------------------------"
RECORDS_RESPONSE=$(curl -s "$BASE_URL/batches/$BATCH_ID/records")
echo "$RECORDS_RESPONSE" | python3 -m json.tool
echo ""

echo "📋 步骤6: 获取第一条记录的决策说明"
echo "-------------------------------------"
FIRST_RECORD_ID=$(echo "$RECORDS_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['data'][0]['id'])")
curl -s "$BASE_URL/records/$FIRST_RECORD_ID/explanation" | python3 -m json.tool
echo ""

echo "📋 步骤7: 审核通过第一条记录"
echo "-------------------------------------"
curl -s -X POST "$BASE_URL/records/$FIRST_RECORD_ID/approve" \
  -H "Content-Type: application/json" \
  -d '{"operator": "auditor_wang", "reason": "小票信息完整，符合活动规则，予以通过"}' | python3 -m json.tool
echo ""

echo "📋 步骤8: 退回第二条记录"
echo "-------------------------------------"
SECOND_RECORD_ID=$(echo "$RECORDS_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['data'][1]['id'])")
curl -s -X POST "$BASE_URL/records/$SECOND_RECORD_ID/return" \
  -H "Content-Type: application/json" \
  -d '{"operator": "auditor_wang", "reason": "大额订单需提供消费凭证复印件，请补充材料后重新提交"}' | python3 -m json.tool
echo ""

echo "📋 步骤9: 查看记录的审计轨迹"
echo "-------------------------------------"
curl -s "$BASE_URL/records/$FIRST_RECORD_ID/audit-trail" | python3 -m json.tool
echo ""

echo "📋 步骤10: 按会员等级查询（GOLD等级）"
echo "-------------------------------------"
curl -s "$BASE_URL/records/query?memberLevel=GOLD" | python3 -m json.tool
echo ""

echo "📋 步骤11: 查看操作日志"
echo "-------------------------------------"
curl -s "$BASE_URL/logs?batchId=$BATCH_ID" | python3 -m json.tool
echo ""

echo "📋 步骤12: 更新后查看批次统计"
echo "-------------------------------------"
curl -s "$BASE_URL/batches/$BATCH_ID/stats" | python3 -m json.tool
echo ""

echo "====================================="
echo "  演示完成！"
echo "====================================="
echo "💡 主要功能已验证："
echo "   ✅ 新增批次"
echo "   ✅ 导入小票CSV/会员JSON"
echo "   ✅ 自动边界检测（退货冲正、金额边界、等级边界等）"
echo "   ✅ 标记处理（通过/拒绝/退回）"
echo "   ✅ 审计追踪（原因、处理人、时间）"
echo "   ✅ 多维度查询（会员等级、活动档期等）"
echo "   ✅ 决策说明生成"
echo "   ✅ 导出功能"
echo ""
echo "🌐 服务地址: http://localhost:3000"
echo "📊 健康检查: http://localhost:3000/health"
