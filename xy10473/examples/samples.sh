#!/bin/bash

BASE_URL="http://localhost:3000/api/applications"

echo "========================================"
echo "售后配件寄送API - 样例curl脚本"
echo "========================================"
echo ""

echo "【1/4】保内补寄 - 完整流程"
echo "产品: SN2024001 (保修期内), 配件: 电源线 (无需回收)"
echo "----------------------------------------"

echo ""
echo "步骤1: 创建申请"
CREATE_RESULT=$(curl -s -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "product_sn": "SN2024001",
    "part_code": "PWR-001",
    "fault_type": "电源线损坏",
    "reason": "用户反馈电源线断裂，无法正常使用",
    "quantity": 1,
    "customer_name": "张三",
    "customer_phone": "13800138001",
    "shipping_address": "北京市朝阳区XX小区1号楼101室",
    "shipping_city": "北京市",
    "operator": "客服小王"
  }')

echo "$CREATE_RESULT"
APPLICATION_NO=$(echo "$CREATE_RESULT" | grep -o '"application_no":"[^"]*"' | cut -d'"' -f4)
echo ""
echo "申请单号: $APPLICATION_NO"

echo ""
echo "步骤2: 审核通过"
curl -s -X POST "$BASE_URL/$APPLICATION_NO/review" \
  -H "Content-Type: application/json" \
  -d '{
    "approved": true,
    "comment": "情况属实，同意补寄",
    "operator": "主管李"
  }'

echo ""
echo "步骤3: 锁定库存"
curl -s -X POST "$BASE_URL/$APPLICATION_NO/lock-inventory" \
  -H "Content-Type: application/json" \
  -d '{"operator": "仓管张"}'

echo ""
echo "步骤4: 发货"
curl -s -X POST "$BASE_URL/$APPLICATION_NO/ship" \
  -H "Content-Type: application/json" \
  -d '{
    "logistics_company": "顺丰速运",
    "tracking_no": "SF1234567890",
    "operator": "仓管张"
  }'

echo ""
echo "步骤5: 签收"
curl -s -X POST "$BASE_URL/$APPLICATION_NO/deliver" \
  -H "Content-Type: application/json" \
  -d '{"operator": "客服小王"}'

echo ""
echo "步骤6: 关闭申请 (无需回收旧件)"
curl -s -X POST "$BASE_URL/$APPLICATION_NO/close" \
  -H "Content-Type: application/json" \
  -d '{
    "remark": "流程完成",
    "operator": "客服小王"
  }'

echo ""
echo "========================================"
echo ""

echo "【2/4】保外驳回 - 保修过期场景"
echo "产品: SN2023001 (已过保), 配件: 遥控器"
echo "----------------------------------------"
echo ""

echo "创建保外申请:"
OUT_WARRANTY_RESULT=$(curl -s -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "product_sn": "SN2023001",
    "part_code": "REM-001",
    "fault_type": "遥控器失灵",
    "reason": "用户反馈遥控器无法正常使用",
    "quantity": 1,
    "customer_name": "李四",
    "customer_phone": "13800138002",
    "shipping_address": "上海市浦东新区XX路123号",
    "shipping_city": "上海市",
    "operator": "客服小李"
  }')

echo "$OUT_WARRANTY_RESULT"

OUT_WARRANTY_NO=$(echo "$OUT_WARRANTY_RESULT" | grep -o '"application_no":"[^"]*"' | cut -d'"' -f4)
echo ""
echo "申请单号: $OUT_WARRANTY_NO"

echo ""
echo "审核驳回 (保外不提供免费配件):"
curl -s -X POST "$BASE_URL/$OUT_WARRANTY_NO/review" \
  -H "Content-Type: application/json" \
  -d '{
    "approved": false,
    "reason": "产品已过保修期，不提供免费配件，请用户自行购买",
    "operator": "主管李"
  }'

echo ""
echo "========================================"
echo ""

echo "【3/4】库存不足 - 无法通过审核"
echo "产品: SN2024002 (保修期内), 配件: 电池组 (库存=0)"
echo "----------------------------------------"
echo ""

echo "创建申请:"
INVENTORY_RESULT=$(curl -s -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "product_sn": "SN2024002",
    "part_code": "BAT-001",
    "fault_type": "电池老化",
    "reason": "用户反馈电池续航时间大幅减少",
    "quantity": 1,
    "customer_name": "王五",
    "customer_phone": "13800138003",
    "shipping_address": "广州市天河区XX街道456号",
    "shipping_city": "广州市",
    "operator": "客服小赵"
  }')

echo "$INVENTORY_RESULT"
INVENTORY_NO=$(echo "$INVENTORY_RESULT" | grep -o '"application_no":"[^"]*"' | cut -d'"' -f4)
echo ""
echo "申请单号: $INVENTORY_NO"

echo ""
echo "尝试审核通过 (库存不足):"
curl -s -X POST "$BASE_URL/$INVENTORY_NO/review" \
  -H "Content-Type: application/json" \
  -d '{
    "approved": true,
    "comment": "同意申请，但需等待补货",
    "operator": "主管李"
  }'

echo ""
echo "========================================"
echo ""

echo "【4/4】旧件未回收 - 无法关闭申请"
echo "产品: SN2024001 (保修期内), 配件: 遥控器 (需要回收)"
echo "----------------------------------------"
echo ""

echo "步骤1: 创建申请"
RECYCLE_RESULT=$(curl -s -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "product_sn": "SN2024001",
    "part_code": "REM-001",
    "fault_type": "遥控器按键失灵",
    "reason": "用户反馈遥控器部分按键失灵",
    "quantity": 1,
    "customer_name": "张三",
    "customer_phone": "13800138001",
    "shipping_address": "北京市朝阳区XX小区1号楼101室",
    "shipping_city": "北京市",
    "operator": "客服小王"
  }')

echo "$RECYCLE_RESULT"
RECYCLE_NO=$(echo "$RECYCLE_RESULT" | grep -o '"application_no":"[^"]*"' | cut -d'"' -f4)
echo ""
echo "申请单号: $RECYCLE_NO"

echo ""
echo "步骤2: 审核通过"
curl -s -X POST "$BASE_URL/$RECYCLE_NO/review" \
  -H "Content-Type: application/json" \
  -d '{
    "approved": true,
    "comment": "需要回收旧遥控器",
    "operator": "主管李"
  }'

echo ""
echo "步骤3: 锁定库存"
curl -s -X POST "$BASE_URL/$RECYCLE_NO/lock-inventory" \
  -H "Content-Type: application/json" \
  -d '{"operator": "仓管张"}'

echo ""
echo "步骤4: 发货"
curl -s -X POST "$BASE_URL/$RECYCLE_NO/ship" \
  -H "Content-Type: application/json" \
  -d '{
    "logistics_company": "顺丰速运",
    "tracking_no": "SF9876543210",
    "operator": "仓管张"
  }'

echo ""
echo "步骤5: 签收"
curl -s -X POST "$BASE_URL/$RECYCLE_NO/deliver" \
  -H "Content-Type: application/json" \
  -d '{"operator": "客服小王"}'

echo ""
echo "步骤6: 尝试关闭 (旧件未回收，应该失败):"
curl -s -X POST "$BASE_URL/$RECYCLE_NO/close" \
  -H "Content-Type: application/json" \
  -d '{
    "remark": "尝试未回收就关闭",
    "operator": "客服小王"
  }'

echo ""
echo "步骤7: 记录旧件回收后再关闭:"
echo "  记录旧件回收:"
curl -s -X POST "$BASE_URL/$RECYCLE_NO/receive-old-part" \
  -H "Content-Type: application/json" \
  -d '{
    "old_part_logistics_company": "中通快递",
    "old_part_tracking_no": "ZT111222333",
    "operator": "客服小王"
  }'

echo ""
echo "  关闭申请:"
curl -s -X POST "$BASE_URL/$RECYCLE_NO/close" \
  -H "Content-Type: application/json" \
  -d '{
    "remark": "旧件已回收，流程完成",
    "operator": "客服小王"
  }'

echo ""
echo "========================================"
echo ""

echo "【额外示例】查询接口演示"
echo "----------------------------------------"
echo ""

echo "1. 查询待发货列表:"
curl -s "$BASE_URL/pending-shipments"

echo ""
echo "2. 查询待回收列表:"
curl -s "$BASE_URL/pending-recycling"

echo ""
echo "3. 查询异常申请:"
curl -s "$BASE_URL/abnormal"

echo ""
echo "4. 查询配件消耗统计:"
curl -s "$BASE_URL/consumption"

echo ""
echo "5. 查询库存状态:"
curl -s "$BASE_URL/inventory"

echo ""
echo "6. 查询逾期待办:"
curl -s "$BASE_URL/todos"

echo ""
echo "========================================"
echo "演示完成"
echo "========================================"
