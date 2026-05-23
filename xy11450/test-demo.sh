#!/bin/bash

BASE_URL="http://localhost:3000"
OPERATOR_ID="admin_001"
OPERATOR_NAME="财务管理员"

echo "========================================"
echo "  设备租赁归还异常回执状态机 API 演示"
echo "========================================"
echo ""

echo "1. 创建归还批次..."
BATCH_RESPONSE=$(curl -s -X POST "$BASE_URL/api/batches" \
  -H "Content-Type: application/json" \
  -H "x-operator-id: $OPERATOR_ID" \
  -H "x-operator-name: $OPERATOR_NAME" \
  -d '{
    "batchData": {
      "batchNo": "RTN20260523001",
      "customerId": "CUST001",
      "customerName": "北京某科技有限公司",
      "orderId": "ORD202605001"
    },
    "equipmentItems": [
      {
        "equipmentCode": "EQ-001",
        "equipmentName": "高清摄像机 A7M4",
        "expectedReturnDate": "2026-05-20",
        "actualReturnDate": "2026-05-22",
        "depositAmount": 5000,
        "deductibleAmount": 0,
        "condition": "GOOD"
      },
      {
        "equipmentCode": "EQ-002",
        "equipmentName": "专业三脚架",
        "expectedReturnDate": "2026-05-20",
        "actualReturnDate": "2026-05-22",
        "depositAmount": 800,
        "deductibleAmount": 0,
        "condition": "DAMAGED"
      }
    ]
  }')

BATCH_ID=$(echo $BATCH_RESPONSE | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
echo "   批次ID: $BATCH_ID"
echo "   当前状态: $(echo $BATCH_RESPONSE | grep -o '"status":"[^"]*"' | cut -d'"' -f4)"
echo ""

echo "2. 上传出库单附件..."
curl -s -X POST "$BASE_URL/api/batches/$BATCH_ID/attachments" \
  -H "Content-Type: application/json" \
  -H "x-operator-id: $OPERATOR_ID" \
  -H "x-operator-name: $OPERATOR_NAME" \
  -d '{
    "type": "OUTBOUND_ORDER",
    "fileName": "出库单_ORD202605001.pdf",
    "fileUrl": "/uploads/outbound/ORD202605001.pdf",
    "fileSize": 102400
  }' | grep -o '"message":"[^"]*"' | cut -d'"' -f4
echo ""

echo "3. 上传归还照片附件..."
curl -s -X POST "$BASE_URL/api/batches/$BATCH_ID/attachments" \
  -H "Content-Type: application/json" \
  -H "x-operator-id: $OPERATOR_ID" \
  -H "x-operator-name: $OPERATOR_NAME" \
  -d '{
    "type": "RETURN_PHOTO",
    "fileName": "归还现场照片_20260522.zip",
    "fileUrl": "/uploads/photos/RTN20260523001.zip",
    "fileSize": 5242880
  }' | grep -o '"message":"[^"]*"' | cut -d'"' -f4
echo ""

echo "4. 标记附件上传完成..."
curl -s -X POST "$BASE_URL/api/batches/$BATCH_ID/transition" \
  -H "Content-Type: application/json" \
  -H "x-operator-id: $OPERATOR_ID" \
  -H "x-operator-name: $OPERATOR_NAME" \
  -d '{
    "transitionKey": "COMPLETE_ATTACHMENTS",
    "reason": "出库单和归还照片已上传完成，材料齐全"
  }' | grep -o '"message":"[^"]*"' | cut -d'"' -f4
echo ""

echo "5. 开始复核..."
curl -s -X POST "$BASE_URL/api/batches/$BATCH_ID/transition" \
  -H "Content-Type: application/json" \
  -H "x-operator-id: $OPERATOR_ID" \
  -H "x-operator-name: $OPERATOR_NAME" \
  -d '{
    "transitionKey": "START_REVIEW",
    "reason": "开始复核材料"
  }' | grep -o '"message":"[^"]*"' | cut -d'"' -f4
echo ""

echo "6. 添加扣款记录（三脚架损坏）..."
curl -s -X POST "$BASE_URL/api/batches/$BATCH_ID/deductions" \
  -H "Content-Type: application/json" \
  -H "x-operator-id: $OPERATOR_ID" \
  -H "x-operator-name: $OPERATOR_NAME" \
  -d '{
    "deductionType": "DAMAGE",
    "amount": 300,
    "reason": "三脚架云台损坏，需要维修",
    "evidenceAttachmentIds": []
  }' | grep -o '"message":"[^"]*"' | cut -d'"' -f4
echo ""

echo "7. 复核通过（扣款300元，退款5500元）..."
curl -s -X POST "$BASE_URL/api/batches/$BATCH_ID/transition" \
  -H "Content-Type: application/json" \
  -H "x-operator-id: $OPERATOR_ID" \
  -H "x-operator-name: $OPERATOR_NAME" \
  -d '{
    "transitionKey": "APPROVE_REVIEW",
    "reason": "材料审核通过，三脚架损坏扣款300元",
    "context": {
      "deductibleAmount": 300,
      "finalRefund": 5500
    }
  }' | grep -o '"message":"[^"]*"' | cut -d'"' -f4
echo ""

echo "8. 查询批次详情..."
DETAIL_RESPONSE=$(curl -s "$BASE_URL/api/batches/$BATCH_ID")
echo "   当前状态: $(echo $DETAIL_RESPONSE | grep -o '"status":"[^"]*"' | cut -d'"' -f4)"
echo "   总押金: $(echo $DETAIL_RESPONSE | grep -o '"totalDeposit":[0-9]*' | cut -d':' -f2)"
echo "   扣款金额: $(echo $DETAIL_RESPONSE | grep -o '"deductibleAmount":[0-9]*' | cut -d':' -f2)"
echo "   退款金额: $(echo $DETAIL_RESPONSE | grep -o '"finalRefund":[0-9]*' | cut -d':' -f2)"
echo "   数据一致性: $(echo $DETAIL_RESPONSE | grep -o '"dataConsistency":{"valid":[^,]*' | cut -d':' -f3)"
echo ""

echo "9. 查询操作历史..."
curl -s "$BASE_URL/api/batches/$BATCH_ID/history" | grep -o '"action":"[^"]*"' | cut -d'"' -f4 | nl
echo ""

echo "10. 查询财务汇总..."
curl -s "$BASE_URL/api/finance/summary" | python3 -m json.tool | head -20
echo ""

echo "11. 导出批次列表..."
curl -s -X POST "$BASE_URL/api/batches/export" \
  -H "Content-Type: application/json" \
  -d '{}' | grep -o '"filePath":"[^"]*"' | cut -d'"' -f4
echo ""

echo "========================================"
echo "  演示完成！"
echo "========================================"
echo ""
echo "可用的 API 端点:"
echo "  GET  /api/batches              - 批次列表"
echo "  GET  /api/batches/:id          - 批次详情"
echo "  GET  /api/batches/:id/history  - 操作历史"
echo "  GET  /api/finance/summary      - 财务汇总"
echo "  GET  /api/finance/failed-records - 失败记录"
echo ""
