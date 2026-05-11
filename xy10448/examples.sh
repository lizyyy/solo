#!/bin/bash

BASE_URL="http://localhost:8000"

echo "========================================"
echo "  诊所耗材收费 API - Curl 示例脚本"
echo "========================================"
echo ""

echo "==================== 1. 查询基础数据 ===================="
echo ""
echo "-- 查询所有治疗项目 --"
curl -s -X GET "$BASE_URL/api/treatment-items/" | python3 -m json.tool
echo ""

echo "-- 查询所有耗材 --"
curl -s -X GET "$BASE_URL/api/supplies/" | python3 -m json.tool
echo ""

echo "==================== 2. 正常收费流程（针灸治疗） ===================="
echo ""

echo "-- 步骤1: 创建患者（或查询已有） --"
PATIENT_RESPONSE=$(curl -s -X POST "$BASE_URL/api/patients/" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "张三",
    "phone": "13800138001"
  }')
echo "患者信息:"
echo $PATIENT_RESPONSE | python3 -m json.tool
PATIENT_ID=$(echo $PATIENT_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])")
echo "患者ID: $PATIENT_ID"
echo ""

echo "-- 步骤2: 创建就诊记录（针灸治疗） --"
VISIT_RESPONSE=$(curl -s -X POST "$BASE_URL/api/visits/" \
  -H "Content-Type: application/json" \
  -d "{
    \"patient_id\": $PATIENT_ID,
    \"visit_items\": [
      {
        \"treatment_item_id\": 1,
        \"quantity\": 1
      }
    ],
    \"notes\": \"腰痛针灸治疗\"
  }")
echo "就诊记录:"
echo $VISIT_RESPONSE | python3 -m json.tool
VISIT_ID=$(echo $VISIT_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])")
echo "就诊ID: $VISIT_ID"
echo ""

echo "-- 步骤3: 收费确认 --"
CHARGE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/visits/$VISIT_ID/charge/" \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "王医生",
    "notes": "现金支付"
  }')
echo "收费记录:"
echo $CHARGE_RESPONSE | python3 -m json.tool
CHARGE_ID=$(echo $CHARGE_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])")
echo "收费ID: $CHARGE_ID"
echo ""

echo "-- 验证: 查看就诊状态（应为 charged） --"
curl -s -X GET "$BASE_URL/api/visits/$VISIT_ID/" | python3 -m json.tool
echo ""

echo "-- 验证: 查看耗材库存变化（针灸针应该减少了10支） --"
echo "针灸针库存:"
curl -s -X GET "$BASE_URL/api/supplies/1/" | python3 -m json.tool
echo ""

echo "==================== 3. 耗材不足场景（换药 - 胶带库存为0） ===================="
echo ""

echo "-- 步骤1: 创建新就诊（换药） --"
VISIT2_RESPONSE=$(curl -s -X POST "$BASE_URL/api/visits/" \
  -H "Content-Type: application/json" \
  -d "{
    \"patient_id\": $PATIENT_ID,
    \"visit_items\": [
      {
        \"treatment_item_id\": 2,
        \"quantity\": 1
      }
    ],
    \"notes\": \"腿部伤口换药\"
  }")
echo "就诊记录:"
echo $VISIT2_RESPONSE | python3 -m json.tool
VISIT2_ID=$(echo $VISIT2_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])")
echo "就诊ID: $VISIT2_ID"
echo ""

echo "-- 步骤2: 尝试收费（应该失败，因为胶带库存为0） --"
echo "尝试收费:"
curl -s -X POST "$BASE_URL/api/visits/$VISIT2_ID/charge/" \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "王医生"
  }'
echo ""
echo ""

echo "-- 验证: 查看胶带库存 --"
curl -s -X GET "$BASE_URL/api/supplies/9/" | python3 -m json.tool
echo ""

echo "==================== 4. 实际追加耗材场景 ===================="
echo ""

echo "-- 步骤1: 创建新患者 --"
PATIENT2_RESPONSE=$(curl -s -X POST "$BASE_URL/api/patients/" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "李四",
    "phone": "13800138002"
  }')
echo "患者信息:"
echo $PATIENT2_RESPONSE | python3 -m json.tool
PATIENT2_ID=$(echo $PATIENT2_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])")
echo "患者ID: $PATIENT2_ID"
echo ""

echo "-- 步骤2: 创建雾化治疗就诊 --"
VISIT3_RESPONSE=$(curl -s -X POST "$BASE_URL/api/visits/" \
  -H "Content-Type: application/json" \
  -d "{
    \"patient_id\": $PATIENT2_ID,
    \"visit_items\": [
      {
        \"treatment_item_id\": 3,
        \"quantity\": 1
      }
    ],
    \"notes\": \"感冒雾化治疗\"
  }")
echo "就诊记录:"
echo $VISIT3_RESPONSE | python3 -m json.tool
VISIT3_ID=$(echo $VISIT3_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])")
echo "就诊ID: $VISIT3_ID"
echo ""

echo "-- 步骤3: 查看当前实际耗材 --"
echo "当前实际耗材:"
curl -s -X GET "$BASE_URL/api/visits/$VISIT3_ID/" | python3 -m json.tool
echo ""

echo "-- 步骤4: 追加额外耗材（额外的生理盐水2瓶） --"
echo "更新实际耗材，追加生理盐水:"
curl -s -X POST "$BASE_URL/api/visits/$VISIT3_ID/supplies/" \
  -H "Content-Type: application/json" \
  -d '[
    {
      "supply_id": 7,
      "actual_quantity": 1
    },
    {
      "supply_id": 8,
      "actual_quantity": 2,
      "is_additional": true
    }
  ]' | python3 -m json.tool
echo ""

echo "-- 步骤5: 再次查看就诊记录 --"
curl -s -X GET "$BASE_URL/api/visits/$VISIT3_ID/" | python3 -m json.tool
echo ""

echo "-- 步骤6: 收费确认 --"
CHARGE3_RESPONSE=$(curl -s -X POST "$BASE_URL/api/visits/$VISIT3_ID/charge/" \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "李护士"
  }')
echo "收费记录:"
echo $CHARGE3_RESPONSE | python3 -m json.tool
echo ""

echo "==================== 5. 退费回滚场景 ===================="
echo ""

echo "-- 步骤1: 创建新就诊 --"
PATIENT3_RESPONSE=$(curl -s -X POST "$BASE_URL/api/patients/" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "王五",
    "phone": "13800138003"
  }')
PATIENT3_ID=$(echo $PATIENT3_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])")

VISIT4_RESPONSE=$(curl -s -X POST "$BASE_URL/api/visits/" \
  -H "Content-Type: application/json" \
  -d "{
    \"patient_id\": $PATIENT3_ID,
    \"visit_items\": [
      {
        \"treatment_item_id\": 1,
        \"quantity\": 1
      }
    ],
    \"notes\": \"头痛针灸治疗\"
  }")
VISIT4_ID=$(echo $VISIT4_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])")

CHARGE4_RESPONSE=$(curl -s -X POST "$BASE_URL/api/visits/$VISIT4_ID/charge/" \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "赵医生"
  }')
CHARGE4_ID=$(echo $CHARGE4_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])")
echo "收费记录ID: $CHARGE4_ID"
echo ""

echo "-- 步骤2: 查看退费前针灸针库存 --"
echo "退费前针灸针库存:"
curl -s -X GET "$BASE_URL/api/supplies/1/" | python3 -m json.tool
echo ""

echo "-- 步骤3: 全额退费（选择库存回滚） --"
echo "退费操作:"
REFUND_RESPONSE=$(curl -s -X POST "$BASE_URL/api/refunds/" \
  -H "Content-Type: application/json" \
  -d "{
    \"charge_id\": $CHARGE4_ID,
    \"refund_type\": \"full\",
    \"amount\": 80.0,
    \"stock_rollback\": true,
    \"operator\": \"财务张\",
    \"reason\": \"患者临时取消治疗\"
  }")
echo $REFUND_RESPONSE | python3 -m json.tool
echo ""

echo "-- 步骤4: 查看退费后就诊状态（应为 refunded） --"
echo "就诊状态:"
curl -s -X GET "$BASE_URL/api/visits/$VISIT4_ID/" | python3 -m json.tool
echo ""

echo "-- 步骤5: 查看退费后针灸针库存（应该回滚增加10支） --"
echo "退费后针灸针库存:"
curl -s -X GET "$BASE_URL/api/supplies/1/" | python3 -m json.tool
echo ""

echo "==================== 6. 统计数据查询 ===================="
echo ""
echo "-- 查询统计数据 --"
curl -s -X GET "$BASE_URL/api/statistics/" | python3 -m json.tool
echo ""

echo "==================== 7. 重复收费验证 ===================="
echo ""
echo "-- 尝试对已收费就诊再次收费（应该失败） --"
curl -s -X POST "$BASE_URL/api/visits/$VISIT3_ID/charge/" \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "王医生"
  }'
echo ""

echo ""
echo "========================================"
echo "  所有示例执行完成！"
echo "========================================"
