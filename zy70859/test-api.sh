#!/bin/bash

BASE_URL="http://localhost:3000/api"

echo "=== 测试法院卷宗借阅归还 API ==="
echo ""

echo "1. 检查服务状态"
curl -s http://localhost:3000/health | jq .
echo ""

echo "2. 创建新批次"
BATCH_RESPONSE=$(curl -s -X POST "$BASE_URL/batches" \
  -H "Content-Type: application/json" \
  -d '{
    "createdBy": "档案室管理员-张三",
    "description": "2024年5月份第一批借阅归还卷宗"
  }')
echo "$BATCH_RESPONSE" | jq .
BATCH_ID=$(echo "$BATCH_RESPONSE" | jq -r '.id')
echo "批次ID: $BATCH_ID"
echo ""

echo "3. 登记材料1 - 正常卷宗"
MATERIAL1_RESPONSE=$(curl -s -X POST "$BASE_URL/batches/$BATCH_ID/materials" \
  -H "Content-Type: application/json" \
  -d '{
    "materialData": {
      "document_number": "FY-2024-00123",
      "case_number": "(2024)京民初字第123号",
      "document_type": "正卷",
      "borrower": "李四法官",
      "borrow_date": "2024-05-10",
      "return_date": "2024-05-20"
    },
    "processedBy": "档案室管理员-张三"
  }')
echo "$MATERIAL1_RESPONSE" | jq .
MATERIAL1_ID=$(echo "$MATERIAL1_RESPONSE" | jq -r '.material.id')
echo "材料1 ID: $MATERIAL1_ID"
echo ""

echo "4. 登记材料2 - 缺少必填字段，应标记为待补充"
MATERIAL2_RESPONSE=$(curl -s -X POST "$BASE_URL/batches/$BATCH_ID/materials" \
  -H "Content-Type: application/json" \
  -d '{
    "materialData": {
      "document_number": "FY-2024-00124",
      "case_number": "(2024)京民初字第124号",
      "document_type": "副卷"
    },
    "processedBy": "档案室管理员-张三"
  }')
echo "$MATERIAL2_RESPONSE" | jq .
MATERIAL2_ID=$(echo "$MATERIAL2_RESPONSE" | jq -r '.material.id')
echo "材料2 ID: $MATERIAL2_ID"
echo ""

echo "5. 登记材料3 - 包含非法标识，应标记为已拦截"
MATERIAL3_RESPONSE=$(curl -s -X POST "$BASE_URL/batches/$BATCH_ID/materials" \
  -H "Content-Type: application/json" \
  -d '{
    "materialData": {
      "document_number": "TEST-FY-2024-00125",
      "case_number": "(2024)京民初字第125号",
      "document_type": "正卷",
      "borrower": "王五法官",
      "borrow_date": "2024-05-15"
    },
    "processedBy": "档案室管理员-张三"
  }')
echo "$MATERIAL3_RESPONSE" | jq .
MATERIAL3_ID=$(echo "$MATERIAL3_RESPONSE" | jq -r '.material.id')
echo "材料3 ID: $MATERIAL3_ID"
echo ""

echo "6. 查看批次下所有材料"
curl -s "$BASE_URL/batches/$BATCH_ID/materials" | jq .
echo ""

echo "7. 人工修改材料3状态 - 从拦截改为正常"
curl -s -X PATCH "$BASE_URL/materials/$MATERIAL3_ID/status" \
  -H "Content-Type: application/json" \
  -d '{
    "newStatus": "normal",
    "statusReason": "经核实，TEST为测试标记，卷宗来源合法",
    "modifiedBy": "档案室主任-赵六",
    "changeReason": "卷宗来源核查通过，修改为正常状态"
  }' | jq .
echo ""

echo "8. 查看材料1的完整追溯信息"
curl -s "$BASE_URL/materials/$MATERIAL1_ID/trail" | jq .
echo ""

echo "9. 查看材料3的审计日志（谁改过结论）"
curl -s "$BASE_URL/materials/$MATERIAL3_ID/audit-logs" | jq .
echo ""

echo "10. 查看材料3的处理轨迹"
curl -s "$BASE_URL/materials/$MATERIAL3_ID/processing-trails" | jq .
echo ""

echo "11. 触发批次重算"
curl -s -X POST "$BASE_URL/batches/$BATCH_ID/recalculate" \
  -H "Content-Type: application/json" \
  -d '{"processedBy": "档案室管理员-张三"}' | jq .
echo ""

echo "12. 查看统计数据"
curl -s "$BASE_URL/statistics" | jq .
echo ""

echo "=== 测试完成 ==="
