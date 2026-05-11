#!/bin/bash

BASE_URL="http://localhost:3005"

PORT=3005 node index.js &
SERVER_PID=$!
sleep 2

echo "========================================"
echo "=     少儿英语学员完整流程测试           ="
echo "========================================"

echo ""
echo "--- 1. 创建少儿英语学员（小明）---"
STUDENT1=$(curl -s -X POST "$BASE_URL/api/students" \
  -H "Content-Type: application/json" \
  -d '{"name":"小明","phone":"13800000001"}')
echo "$STUDENT1"
STUDENT1_ID=$(echo "$STUDENT1" | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])")
echo "学员ID: $STUDENT1_ID"

echo ""
echo "--- 2. 购买少儿英语课程包（40课时+赠送10课时，单价150元，有效期90天）---"
PKG1=$(curl -s -X POST "$BASE_URL/api/purchases" \
  -H "Content-Type: application/json" \
  -d "{\"studentId\":\"$STUDENT1_ID\",\"courseType\":\"kids_english\",\"purchasedHours\":40,\"giftedHours\":10,\"unitPrice\":150,\"validityDays\":90}")
echo "$PKG1"
PKG1_ID=$(echo "$PKG1" | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])")
echo "课程包ID: $PKG1_ID"

echo ""
echo "--- 3. 正常排课扣课（第一次上课，扣2课时）---"
curl -s -X POST "$BASE_URL/api/consume" \
  -H "Content-Type: application/json" \
  -d "{\"packageId\":\"$PKG1_ID\",\"hours\":2,\"scheduleId\":\"SCH_EN_001\",\"reason\":\"少儿英语第1节课\"}"

echo ""
echo "--- 4. 正常排课扣课（第二次上课，扣2课时）---"
curl -s -X POST "$BASE_URL/api/consume" \
  -H "Content-Type: application/json" \
  -d "{\"packageId\":\"$PKG1_ID\",\"hours\":2,\"scheduleId\":\"SCH_EN_002\",\"reason\":\"少儿英语第2节课\"}"

echo ""
echo "--- 5. 发起冻结申请（暑假旅游，冻结30天）---"
FREEZE1=$(curl -s -X POST "$BASE_URL/api/freeze/request" \
  -H "Content-Type: application/json" \
  -d "{\"packageId\":\"$PKG1_ID\",\"idempotencyKey\":\"FREEZE_KIDS_EN_2024_SUMMER\",\"freezeDays\":30,\"freezeReason\":\"暑假外出旅游\"}")
echo "$FREEZE1"
FREEZE1_ID=$(echo "$FREEZE1" | python3 -c "import sys, json; print(json.load(sys.stdin)['requestId'])")
echo "冻结申请ID: $FREEZE1_ID"

echo ""
echo "--- 6. 重复提交相同冻结申请（幂等测试）---"
echo "使用相同的 idempotencyKey:"
curl -s -X POST "$BASE_URL/api/freeze/request" \
  -H "Content-Type: application/json" \
  -d "{\"packageId\":\"$PKG1_ID\",\"idempotencyKey\":\"FREEZE_KIDS_EN_2024_SUMMER\",\"freezeDays\":30,\"freezeReason\":\"暑假外出旅游\"}"

echo ""
echo "--- 7. 审批冻结申请 ---"
curl -s -X POST "$BASE_URL/api/freeze/approve" \
  -H "Content-Type: application/json" \
  -d "{\"requestId\":\"$FREEZE1_ID\",\"approverId\":\"ADMIN_001\"}"

echo ""
echo "--- 8. 冻结期间尝试扣课（应失败）---"
echo "尝试在冻结期间排课扣课:"
curl -s -X POST "$BASE_URL/api/consume" \
  -H "Content-Type: application/json" \
  -d "{\"packageId\":\"$PKG1_ID\",\"hours\":2,\"scheduleId\":\"SCH_EN_003\",\"reason\":\"少儿英语第3节课（冻结期间）\"}"

echo ""
echo "--- 9. 手动解冻并顺延有效期 ---"
echo "提前解冻，剩余冻结天数将顺延到有效期:"
curl -s -X POST "$BASE_URL/api/unfreeze" \
  -H "Content-Type: application/json" \
  -d "{\"packageId\":\"$PKG1_ID\",\"unfreezeReason\":\"家长提前回来，申请解冻\"}"

echo ""
echo "--- 10. 解冻后正常扣课 ---"
curl -s -X POST "$BASE_URL/api/consume" \
  -H "Content-Type: application/json" \
  -d "{\"packageId\":\"$PKG1_ID\",\"hours\":2,\"scheduleId\":\"SCH_EN_003\",\"reason\":\"少儿英语第3节课（解冻后）\"}"

echo ""
echo "--- 11. 查询课程包详情（余额、有效期、冻结历史、流水）---"
curl -s -X GET "$BASE_URL/api/packages/$PKG1_ID/query" | python3 -m json.tool

echo ""
echo ""
echo "========================================"
echo "=     成人瑜伽学员退款受限测试           ="
echo "========================================"

echo ""
echo "--- 1. 创建成人瑜伽学员（李女士）---"
STUDENT2=$(curl -s -X POST "$BASE_URL/api/students" \
  -H "Content-Type: application/json" \
  -d '{"name":"李女士","phone":"13900000002"}')
echo "$STUDENT2"
STUDENT2_ID=$(echo "$STUDENT2" | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])")
echo "学员ID: $STUDENT2_ID"

echo ""
echo "--- 2. 购买成人瑜伽课程包（20课时+赠送5课时，单价200元，有效期60天）---"
PKG2=$(curl -s -X POST "$BASE_URL/api/purchases" \
  -H "Content-Type: application/json" \
  -d "{\"studentId\":\"$STUDENT2_ID\",\"courseType\":\"adult_yoga\",\"purchasedHours\":20,\"giftedHours\":5,\"unitPrice\":200,\"validityDays\":60}")
echo "$PKG2"
PKG2_ID=$(echo "$PKG2" | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])")
echo "课程包ID: $PKG2_ID"

echo ""
echo "--- 3. 上了很多课（消耗18课时，主要用赠送课时）---"
for i in 1 2 3 4 5 6 7 8 9; do
  curl -s -X POST "$BASE_URL/api/consume" \
    -H "Content-Type: application/json" \
    -d "{\"packageId\":\"$PKG2_ID\",\"hours\":2,\"scheduleId\":\"SCH_YOGA_00$i\",\"reason\":\"成人瑜伽第${i}节课\"}" > /dev/null
  echo "已扣课第$i次"
done

echo ""
echo "--- 4. 此时剩余7课时（25总课时-18已消耗）---"
echo "但是赠送5课时已全部用完，剩余7课时中：2课时是赠送剩余，5课时是购买的"

echo ""
echo "--- 5. 申请退款（应扣除赠送课时）---"
echo "规则：退款只退购买课时，赠送课时不退"
REFUND1=$(curl -s -X POST "$BASE_URL/api/refund/request" \
  -H "Content-Type: application/json" \
  -d "{\"packageId\":\"$PKG2_ID\",\"idempotencyKey\":\"REFUND_YOGA_2024_01\",\"refundReason\":\"搬家距离太远\"}")
echo "$REFUND1"
REFUND1_ID=$(echo "$REFUND1" | python3 -c "import sys, json; print(json.load(sys.stdin).get('requestId', 'N/A'))")

echo ""
echo "--- 6. 审批退款 ---"
if [ "$REFUND1_ID" != "N/A" ]; then
  curl -s -X POST "$BASE_URL/api/refund/approve" \
    -H "Content-Type: application/json" \
    -d "{\"requestId\":\"$REFUND1_ID\"}"
fi

echo ""
echo "--- 7. 查询课程包详情 ---"
curl -s -X GET "$BASE_URL/api/packages/$PKG2_ID/query" | python3 -m json.tool

echo ""
echo ""
echo "========================================"
echo "=     退款受限极端场景测试               ="
echo "========================================"

echo ""
echo "--- 1. 创建学员（测试用户）---"
STUDENT3=$(curl -s -X POST "$BASE_URL/api/students" \
  -H "Content-Type: application/json" \
  -d '{"name":"测试用户","phone":"13700000003"}')
STUDENT3_ID=$(echo "$STUDENT3" | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])")

echo ""
echo "--- 2. 购买课程包（10课时+赠送10课时）---"
PKG3=$(curl -s -X POST "$BASE_URL/api/purchases" \
  -H "Content-Type: application/json" \
  -d "{\"studentId\":\"$STUDENT3_ID\",\"courseType\":\"test_course\",\"purchasedHours\":10,\"giftedHours\":10,\"unitPrice\":100,\"validityDays\":30}")
PKG3_ID=$(echo "$PKG3" | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])")

echo ""
echo "--- 3. 只消耗10课时（刚好用完购买的）---"
for i in 1 2 3 4 5; do
  curl -s -X POST "$BASE_URL/api/consume" \
    -H "Content-Type: application/json" \
    -d "{\"packageId\":\"$PKG3_ID\",\"hours\":2,\"scheduleId\":\"TEST_00$i\"}" > /dev/null
done

echo ""
echo "--- 4. 剩余10课时全是赠送的，申请退款应失败 ---"
echo "规则：已消耗课时优先从购买课时扣除，赠送课时不退款"
curl -s -X POST "$BASE_URL/api/refund/request" \
  -H "Content-Type: application/json" \
  -d "{\"packageId\":\"$PKG3_ID\",\"idempotencyKey\":\"REFUND_TEST_001\",\"refundReason\":\"测试退款受限\"}"

echo ""
echo "--- 5. 查询异常流水 ---"
curl -s -X GET "$BASE_URL/api/packages/$PKG3_ID/query" | python3 -m json.tool

echo ""
echo ""
echo "========================================"
echo "=     测试完成！                        ="
echo "========================================"

kill $SERVER_PID 2>/dev/null
