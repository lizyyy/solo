#!/bin/bash

BASE_URL="http://localhost:8081/api"

echo "=========================================="
echo "   维修备件领用 API 演示脚本"
echo "=========================================="
echo ""

echo "=== 1. 健康检查 ==="
curl -s "$BASE_URL/health" | python3 -m json.tool
echo ""

echo "=== 2. 查看当前库存 ==="
curl -s "$BASE_URL/reports/inventory" | python3 -m json.tool
echo ""

echo "=========================================="
echo "   场景一：正常维修流程"
echo "=========================================="
echo ""

echo "--- 1. 创建工单（中央空调A-01故障） ---"
WO1_RESPONSE=$(curl -s -X POST "$BASE_URL/work-orders" \
  -H "Content-Type: application/json" \
  -d '{
    "equipmentId": "E001",
    "title": "中央空调A-01制冷效果差",
    "description": "制冷不足，需要检查压缩机和过滤网",
    "priority": "HIGH",
    "createdBy": "admin"
  }')
echo "$WO1_RESPONSE" | python3 -m json.tool
WO1_ID=$(echo "$WO1_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")
echo "工单ID: $WO1_ID"
echo ""

echo "--- 2. 未派工就申请备件（应该失败） ---"
curl -s -X POST "$BASE_URL/requisitions" \
  -H "Content-Type: application/json" \
  -d "{
    \"workOrderId\": \"$WO1_ID\",
    \"partId\": \"P001\",
    \"requestedQuantity\": 1,
    \"requestedBy\": \"S001\",
    \"reason\": \"更换压缩机\"
  }" | python3 -m json.tool
echo ""

echo "--- 3. 派工给张师傅 ---"
curl -s -X POST "$BASE_URL/work-orders/$WO1_ID/assign" \
  -H "Content-Type: application/json" \
  -d '{"staffId": "S001"}' | python3 -m json.tool
echo ""

echo "--- 4. 申请备件1：空调压缩机（非质保） ---"
REQ1_RESPONSE=$(curl -s -X POST "$BASE_URL/requisitions" \
  -H "Content-Type: application/json" \
  -d "{
    \"workOrderId\": \"$WO1_ID\",
    \"partId\": \"P001\",
    \"requestedQuantity\": 1,
    \"requestedBy\": \"S001\",
    \"reason\": \"更换故障压缩机\"
  }")
echo "$REQ1_RESPONSE" | python3 -m json.tool
REQ1_ID=$(echo "$REQ1_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")
echo "领用单ID: $REQ1_ID"
echo ""

echo "--- 5. 申请备件2：空调过滤网（质保内） ---"
REQ2_RESPONSE=$(curl -s -X POST "$BASE_URL/requisitions" \
  -H "Content-Type: application/json" \
  -d "{
    \"workOrderId\": \"$WO1_ID\",
    \"partId\": \"P002\",
    \"requestedQuantity\": 2,
    \"requestedBy\": \"S001\",
    \"reason\": \"更换过滤网\"
  }")
echo "$REQ2_RESPONSE" | python3 -m json.tool
REQ2_ID=$(echo "$REQ2_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")
echo "领用单ID: $REQ2_ID"
echo ""

echo "--- 6. 审批领用单1 ---"
curl -s -X POST "$BASE_URL/requisitions/$REQ1_ID/approve" \
  -H "Content-Type: application/json" \
  -d '{
    "approvedBy": "manager",
    "approvedQuantity": 1,
    "approvalRemark": "同意更换"
  }' | python3 -m json.tool
echo ""

echo "--- 7. 审批领用单2 ---"
curl -s -X POST "$BASE_URL/requisitions/$REQ2_ID/approve" \
  -H "Content-Type: application/json" \
  -d '{
    "approvedBy": "manager",
    "approvedQuantity": 2,
    "approvalRemark": "正常更换，成本归属质保"
  }' | python3 -m json.tool
echo ""

echo "--- 8. 出库领用 ---"
curl -s -X POST "$BASE_URL/requisitions/$REQ1_ID/issue" \
  -H "Content-Type: application/json" \
  -d '{"issuedBy": "warehouse"}' | python3 -m json.tool
echo ""
curl -s -X POST "$BASE_URL/requisitions/$REQ2_ID/issue" \
  -H "Content-Type: application/json" \
  -d '{"issuedBy": "warehouse"}' | python3 -m json.tool
echo ""

echo "--- 9. 完工消耗（全部用完） ---"
curl -s -X POST "$BASE_URL/requisitions/$REQ1_ID/consume" \
  -H "Content-Type: application/json" \
  -d '{"consumedQuantity": 1}' | python3 -m json.tool
echo ""
curl -s -X POST "$BASE_URL/requisitions/$REQ2_ID/consume" \
  -H "Content-Type: application/json" \
  -d '{"consumedQuantity": 2}' | python3 -m json.tool
echo ""

echo "--- 10. 工单完工 ---"
curl -s -X POST "$BASE_URL/work-orders/$WO1_ID/complete" \
  -H "Content-Type: application/json" \
  -d '{"remarks": "压缩机更换完成，制冷恢复正常"}' | python3 -m json.tool
echo ""

echo "--- 11. 查看工单总成本（注意质保和非质保的区分） ---"
curl -s "$BASE_URL/work-orders/$WO1_ID" | python3 -m json.tool
echo ""

echo "=========================================="
echo "   场景二：退件回库"
echo "=========================================="
echo ""

echo "--- 1. 创建新工单（电机维修） ---"
WO2_RESPONSE=$(curl -s -X POST "$BASE_URL/work-orders" \
  -H "Content-Type: application/json" \
  -d '{
    "equipmentId": "E002",
    "title": "驱动电机M-05异响",
    "description": "电机运行时有异响，怀疑轴承问题",
    "priority": "NORMAL",
    "createdBy": "admin"
  }')
echo "$WO2_RESPONSE" | python3 -m json.tool
WO2_ID=$(echo "$WO2_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")
echo "工单ID: $WO2_ID"
echo ""

echo "--- 2. 派工给李师傅 ---"
curl -s -X POST "$BASE_URL/work-orders/$WO2_ID/assign" \
  -H "Content-Type: application/json" \
  -d '{"staffId": "S002"}' | python3 -m json.tool
echo ""

echo "--- 3. 申请2个轴承（多申请了1个） ---"
REQ3_RESPONSE=$(curl -s -X POST "$BASE_URL/requisitions" \
  -H "Content-Type: application/json" \
  -d "{
    \"workOrderId\": \"$WO2_ID\",
    \"partId\": \"P004\",
    \"requestedQuantity\": 2,
    \"requestedBy\": \"S002\",
    \"reason\": \"更换电机轴承\"
  }")
echo "$REQ3_RESPONSE" | python3 -m json.tool
REQ3_ID=$(echo "$REQ3_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")
echo "领用单ID: $REQ3_ID"
echo ""

echo "--- 4. 查看轴承当前库存 ---"
curl -s "$BASE_URL/reports/inventory" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for item in data['data']:
    if item['partId'] == 'P004':
        print(f\"轴承库存: {item['quantity']}\")
"
echo ""

echo "--- 5. 审批出库 ---"
curl -s -X POST "$BASE_URL/requisitions/$REQ3_ID/approve" \
  -H "Content-Type: application/json" \
  -d '{
    "approvedBy": "manager",
    "approvedQuantity": 2
  }' | python3 -m json.tool
echo ""
curl -s -X POST "$BASE_URL/requisitions/$REQ3_ID/issue" \
  -H "Content-Type: application/json" \
  -d '{"issuedBy": "warehouse"}' | python3 -m json.tool
echo ""

echo "--- 6. 出库后查看库存 ---"
curl -s "$BASE_URL/reports/inventory" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for item in data['data']:
    if item['partId'] == 'P004':
        print(f\"出库后库存: {item['quantity']}\")
"
echo ""

echo "--- 7. 实际只用1个，消耗登记 ---"
curl -s -X POST "$BASE_URL/requisitions/$REQ3_ID/consume" \
  -H "Content-Type: application/json" \
  -d '{"consumedQuantity": 1}' | python3 -m json.tool
echo ""

echo "--- 8. 退回剩余1个 ---"
curl -s -X POST "$BASE_URL/requisitions/$REQ3_ID/return" \
  -H "Content-Type: application/json" \
  -d '{"returnRemark": "只用了1个，剩余1个退回"}' | python3 -m json.tool
echo ""

echo "--- 9. 退回后查看库存 ---"
curl -s "$BASE_URL/reports/inventory" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for item in data['data']:
    if item['partId'] == 'P004':
        print(f\"退回后库存: {item['quantity']}\")
"
echo ""

echo "--- 10. 完工 ---"
curl -s -X POST "$BASE_URL/work-orders/$WO2_ID/complete" \
  -H "Content-Type: application/json" \
  -d '{"remarks": "更换1个轴承，异响消除"}' | python3 -m json.tool
echo ""

echo "=========================================="
echo "   场景三：库存不足"
echo "=========================================="
echo ""

echo "--- 查看温度传感器探头库存 ---"
curl -s "$BASE_URL/reports/inventory" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for item in data['data']:
    if item['partId'] == 'P005':
        print(f\"P005库存: {item['quantity']}\")
"
echo ""

echo "--- 1. 创建传感器维修工单 ---"
WO3_RESPONSE=$(curl -s -X POST "$BASE_URL/work-orders" \
  -H "Content-Type: application/json" \
  -d '{
    "equipmentId": "E003",
    "title": "温度传感器TS-12读数异常",
    "description": "温度读数不稳定",
    "priority": "LOW",
    "createdBy": "admin"
  }')
WO3_ID=$(echo "$WO3_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")
echo "工单ID: $WO3_ID"
echo ""

echo "--- 2. 派工 ---"
curl -s -X POST "$BASE_URL/work-orders/$WO3_ID/assign" \
  -H "Content-Type: application/json" \
  -d '{"staffId": "S001"}' | python3 -m json.tool
echo ""

echo "--- 3. 申请2个（库存只有1个，应该失败） ---"
curl -s -X POST "$BASE_URL/requisitions" \
  -H "Content-Type: application/json" \
  -d "{
    \"workOrderId\": \"$WO3_ID\",
    \"partId\": \"P005\",
    \"requestedQuantity\": 2,
    \"requestedBy\": \"S001\",
    \"reason\": \"更换探头\"
  }" | python3 -m json.tool
echo ""

echo "--- 4. 申请1个（应该成功） ---"
REQ4_RESPONSE=$(curl -s -X POST "$BASE_URL/requisitions" \
  -H "Content-Type: application/json" \
  -d "{
    \"workOrderId\": \"$WO3_ID\",
    \"partId\": \"P005\",
    \"requestedQuantity\": 1,
    \"requestedBy\": \"S001\",
    \"reason\": \"更换探头\"
  }")
echo "$REQ4_RESPONSE" | python3 -m json.tool
REQ4_ID=$(echo "$REQ4_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")
echo "领用单ID: $REQ4_ID"
echo ""

echo "--- 快速完成工单以便统计 ---"
curl -s -X POST "$BASE_URL/requisitions/$REQ4_ID/approve" \
  -H "Content-Type: application/json" \
  -d '{"approvedBy":"manager","approvedQuantity":1}' > /dev/null
curl -s -X POST "$BASE_URL/requisitions/$REQ4_ID/issue" \
  -H "Content-Type: application/json" \
  -d '{"issuedBy":"warehouse"}' > /dev/null
curl -s -X POST "$BASE_URL/requisitions/$REQ4_ID/consume" \
  -H "Content-Type: application/json" \
  -d '{"consumedQuantity":1}' > /dev/null
curl -s -X POST "$BASE_URL/work-orders/$WO3_ID/complete" \
  -H "Content-Type: application/json" \
  -d '{"remarks":"维修完成"}' > /dev/null
echo "已完成WO3"
echo ""

echo "=========================================="
echo "   场景四：重复提交"
echo "=========================================="
echo ""

echo "--- 再创建一个空调工单 ---"
WO4_RESPONSE=$(curl -s -X POST "$BASE_URL/work-orders" \
  -H "Content-Type: application/json" \
  -d '{
    "equipmentId": "E001",
    "title": "定期维护",
    "description": "季度保养",
    "priority": "LOW",
    "createdBy": "admin"
  }')
WO4_ID=$(echo "$WO4_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")
echo "工单ID: $WO4_ID"
echo ""

echo "--- 派工 ---"
curl -s -X POST "$BASE_URL/work-orders/$WO4_ID/assign" \
  -H "Content-Type: application/json" \
  -d '{"staffId": "S001"}' | python3 -m json.tool
echo ""

echo "--- 第一次申请过滤网 ---"
REQ5_RESPONSE=$(curl -s -X POST "$BASE_URL/requisitions" \
  -H "Content-Type: application/json" \
  -d "{
    \"workOrderId\": \"$WO4_ID\",
    \"partId\": \"P002\",
    \"requestedQuantity\": 1,
    \"requestedBy\": \"S001\",
    \"reason\": \"保养更换\"
  }")
echo "$REQ5_RESPONSE" | python3 -m json.tool
echo ""

echo "--- 再次申请同一备件（应该失败） ---"
curl -s -X POST "$BASE_URL/requisitions" \
  -H "Content-Type: application/json" \
  -d "{
    \"workOrderId\": \"$WO4_ID\",
    \"partId\": \"P002\",
    \"requestedQuantity\": 1,
    \"requestedBy\": \"S001\",
    \"reason\": \"保养更换\"
  }" | python3 -m json.tool
echo ""

echo "=========================================="
echo "   成本统计查询"
echo "=========================================="
echo ""

echo "--- 按维修人员汇总 ---"
curl -s "$BASE_URL/reports/cost/staff" | python3 -m json.tool
echo ""

echo "--- 按设备类型汇总 ---"
curl -s "$BASE_URL/reports/cost/equipment-type" | python3 -m json.tool
echo ""

echo "--- 最终库存状态 ---"
curl -s "$BASE_URL/reports/inventory" | python3 -m json.tool
echo ""

echo "=========================================="
echo "   演示完成"
echo "=========================================="
