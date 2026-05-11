#!/bin/bash

BASE_URL="http://localhost:3001/api"

echo "========================================"
echo "1. 创建房源"
echo "========================================"
HOUSE=$(curl -s -X POST $BASE_URL/houses \
  -H "Content-Type: application/json" \
  -d '{
    "name": "阳光小区1号楼",
    "address": "北京市朝阳区阳光路1号",
    "waterPrice": 5.0,
    "electricityPrice": 0.8,
    "publicWaterShare": "by_person",
    "publicElectricityShare": "by_person"
  }')
echo "房源创建成功:"
echo "$HOUSE" | python3 -m json.tool 2>/dev/null || echo "$HOUSE"
HOUSE_ID=$(echo "$HOUSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo ""

echo "========================================"
echo "2. 创建房间（3个房间）"
echo "========================================"
ROOM1=$(curl -s -X POST $BASE_URL/rooms \
  -H "Content-Type: application/json" \
  -d "{\"houseId\":\"$HOUSE_ID\",\"roomNumber\":\"101\",\"hasWaterMeter\":true,\"hasElectricityMeter\":true}")
ROOM1_ID=$(echo "$ROOM1" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "房间 101 创建成功"

ROOM2=$(curl -s -X POST $BASE_URL/rooms \
  -H "Content-Type: application/json" \
  -d "{\"houseId\":\"$HOUSE_ID\",\"roomNumber\":\"102\",\"hasWaterMeter\":true,\"hasElectricityMeter\":true}")
ROOM2_ID=$(echo "$ROOM2" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "房间 102 创建成功"

ROOM3=$(curl -s -X POST $BASE_URL/rooms \
  -H "Content-Type: application/json" \
  -d "{\"houseId\":\"$HOUSE_ID\",\"roomNumber\":\"103\",\"hasWaterMeter\":true,\"hasElectricityMeter\":true}")
ROOM3_ID=$(echo "$ROOM3" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "房间 103 创建成功"
echo ""

echo "========================================"
echo "3. 创建租客"
echo "========================================"
TENANT1=$(curl -s -X POST $BASE_URL/tenants \
  -H "Content-Type: application/json" \
  -d "{\"roomId\":\"$ROOM1_ID\",\"name\":\"张三\",\"phone\":\"13800138001\",\"checkInDate\":\"2024-01-01\"}")
TENANT1_ID=$(echo "$TENANT1" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "租客张三创建成功（整月入住）"

TENANT2=$(curl -s -X POST $BASE_URL/tenants \
  -H "Content-Type: application/json" \
  -d "{\"roomId\":\"$ROOM2_ID\",\"name\":\"李四\",\"phone\":\"13800138002\",\"checkInDate\":\"2024-01-01\"}")
TENANT2_ID=$(echo "$TENANT2" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "租客李四创建成功（半月后退租）"

TENANT3=$(curl -s -X POST $BASE_URL/tenants \
  -H "Content-Type: application/json" \
  -d "{\"roomId\":\"$ROOM2_ID\",\"name\":\"王五\",\"phone\":\"13800138003\",\"checkInDate\":\"2024-01-16\"}")
TENANT3_ID=$(echo "$TENANT3" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "租客王五创建成功（1月16日入住）"
echo ""

echo "========================================"
echo "4. 创建抄表记录（月初读数）"
echo "========================================"
echo "公共水表: 1000"
curl -s -X POST $BASE_URL/meter-readings \
  -H "Content-Type: application/json" \
  -d "{\"houseId\":\"$HOUSE_ID\",\"readingType\":\"water\",\"readingDate\":\"2024-01-01\",\"readingValue\":1000,\"isPublic\":true}" > /dev/null

echo "公共电表: 5000"
curl -s -X POST $BASE_URL/meter-readings \
  -H "Content-Type: application/json" \
  -d "{\"houseId\":\"$HOUSE_ID\",\"readingType\":\"electricity\",\"readingDate\":\"2024-01-01\",\"readingValue\":5000,\"isPublic\":true}" > /dev/null

echo "房间101水表: 100"
curl -s -X POST $BASE_URL/meter-readings \
  -H "Content-Type: application/json" \
  -d "{\"houseId\":\"$HOUSE_ID\",\"roomId\":\"$ROOM1_ID\",\"readingType\":\"water\",\"readingDate\":\"2024-01-01\",\"readingValue\":100}" > /dev/null

echo "房间101电表: 200"
curl -s -X POST $BASE_URL/meter-readings \
  -H "Content-Type: application/json" \
  -d "{\"houseId\":\"$HOUSE_ID\",\"roomId\":\"$ROOM1_ID\",\"readingType\":\"electricity\",\"readingDate\":\"2024-01-01\",\"readingValue\":200}" > /dev/null

echo "房间102水表: 150"
curl -s -X POST $BASE_URL/meter-readings \
  -H "Content-Type: application/json" \
  -d "{\"houseId\":\"$HOUSE_ID\",\"roomId\":\"$ROOM2_ID\",\"readingType\":\"water\",\"readingDate\":\"2024-01-01\",\"readingValue\":150}" > /dev/null

echo "房间102电表: 250"
curl -s -X POST $BASE_URL/meter-readings \
  -H "Content-Type: application/json" \
  -d "{\"houseId\":\"$HOUSE_ID\",\"roomId\":\"$ROOM2_ID\",\"readingType\":\"electricity\",\"readingDate\":\"2024-01-01\",\"readingValue\":250}" > /dev/null

echo "房间103水表: 180"
curl -s -X POST $BASE_URL/meter-readings \
  -H "Content-Type: application/json" \
  -d "{\"houseId\":\"$HOUSE_ID\",\"roomId\":\"$ROOM3_ID\",\"readingType\":\"water\",\"readingDate\":\"2024-01-01\",\"readingValue\":180}" > /dev/null

echo "房间103电表: 280"
curl -s -X POST $BASE_URL/meter-readings \
  -H "Content-Type: application/json" \
  -d "{\"houseId\":\"$HOUSE_ID\",\"roomId\":\"$ROOM3_ID\",\"readingType\":\"electricity\",\"readingDate\":\"2024-01-01\",\"readingValue\":280}" > /dev/null

echo ""

echo "========================================"
echo "5. 创建抄表记录（1月15日，李四退租前）"
echo "========================================"
echo "房间102水表: 170（20吨）"
curl -s -X POST $BASE_URL/meter-readings \
  -H "Content-Type: application/json" \
  -d "{\"houseId\":\"$HOUSE_ID\",\"roomId\":\"$ROOM2_ID\",\"readingType\":\"water\",\"readingDate\":\"2024-01-15\",\"readingValue\":170}" > /dev/null

echo "房间102电表: 350（100度）"
curl -s -X POST $BASE_URL/meter-readings \
  -H "Content-Type: application/json" \
  -d "{\"houseId\":\"$HOUSE_ID\",\"roomId\":\"$ROOM2_ID\",\"readingType\":\"electricity\",\"readingDate\":\"2024-01-15\",\"readingValue\":350}" > /dev/null

echo ""

echo "========================================"
echo "6. 李四退租（2024-01-15）"
echo "========================================"
curl -s -X POST $BASE_URL/tenants/$TENANT2_ID/checkout \
  -H "Content-Type: application/json" \
  -d "{\"checkOutDate\":\"2024-01-15\"}" > /dev/null
echo "李四已退租"
echo ""

echo "========================================"
echo "7. 创建抄表记录（月末读数）"
echo "========================================"
echo "公共水表: 1100（100吨）"
curl -s -X POST $BASE_URL/meter-readings \
  -H "Content-Type: application/json" \
  -d "{\"houseId\":\"$HOUSE_ID\",\"readingType\":\"water\",\"readingDate\":\"2024-01-31\",\"readingValue\":1100,\"isPublic\":true}" > /dev/null

echo "公共电表: 5500（500度）"
curl -s -X POST $BASE_URL/meter-readings \
  -H "Content-Type: application/json" \
  -d "{\"houseId\":\"$HOUSE_ID\",\"readingType\":\"electricity\",\"readingDate\":\"2024-01-31\",\"readingValue\":5500,\"isPublic\":true}" > /dev/null

echo "房间101水表: 120（20吨）"
curl -s -X POST $BASE_URL/meter-readings \
  -H "Content-Type: application/json" \
  -d "{\"houseId\":\"$HOUSE_ID\",\"roomId\":\"$ROOM1_ID\",\"readingType\":\"water\",\"readingDate\":\"2024-01-31\",\"readingValue\":120}" > /dev/null

echo "房间101电表: 300（100度）"
curl -s -X POST $BASE_URL/meter-readings \
  -H "Content-Type: application/json" \
  -d "{\"houseId\":\"$HOUSE_ID\",\"roomId\":\"$ROOM1_ID\",\"readingType\":\"electricity\",\"readingDate\":\"2024-01-31\",\"readingValue\":300}" > /dev/null

echo "房间102水表: 190（20吨）"
curl -s -X POST $BASE_URL/meter-readings \
  -H "Content-Type: application/json" \
  -d "{\"houseId\":\"$HOUSE_ID\",\"roomId\":\"$ROOM2_ID\",\"readingType\":\"water\",\"readingDate\":\"2024-01-31\",\"readingValue\":190}" > /dev/null

echo "房间102电表: 450（100度）"
curl -s -X POST $BASE_URL/meter-readings \
  -H "Content-Type: application/json" \
  -d "{\"houseId\":\"$HOUSE_ID\",\"roomId\":\"$ROOM2_ID\",\"readingType\":\"electricity\",\"readingDate\":\"2024-01-31\",\"readingValue\":450}" > /dev/null

echo "房间103水表: 210（30吨）"
curl -s -X POST $BASE_URL/meter-readings \
  -H "Content-Type: application/json" \
  -d "{\"houseId\":\"$HOUSE_ID\",\"roomId\":\"$ROOM3_ID\",\"readingType\":\"water\",\"readingDate\":\"2024-01-31\",\"readingValue\":210}" > /dev/null

echo "房间103电表: 400（120度）"
curl -s -X POST $BASE_URL/meter-readings \
  -H "Content-Type: application/json" \
  -d "{\"houseId\":\"$HOUSE_ID\",\"roomId\":\"$ROOM3_ID\",\"readingType\":\"electricity\",\"readingDate\":\"2024-01-31\",\"readingValue\":400}" > /dev/null

echo ""

echo "========================================"
echo "8. 生成1月月度账单"
echo "========================================"
MONTHLY_BILLS=$(curl -s -X POST $BASE_URL/bills/generate-monthly \
  -H "Content-Type: application/json" \
  -d "{\"houseId\":\"$HOUSE_ID\",\"year\":2024,\"month\":1}")
echo "1月账单生成结果:"
echo "$MONTHLY_BILLS" | python3 -m json.tool 2>/dev/null || echo "$MONTHLY_BILLS"
echo ""

echo "========================================"
echo "9. 生成李四退租结算账单"
echo "========================================"
CHECKOUT_BILL=$(curl -s -X POST $BASE_URL/bills/checkout/$TENANT2_ID \
  -H "Content-Type: application/json" \
  -d "{}")
echo "李四退租结算账单:"
echo "$CHECKOUT_BILL" | python3 -m json.tool 2>/dev/null || echo "$CHECKOUT_BILL"
echo ""

echo "========================================"
echo "10. 测试读数异常（抄表倒退）"
echo "========================================"
echo "尝试创建倒退读数（房间101水表从120降到100）:"
ABNORMAL_READING=$(curl -s -X POST $BASE_URL/meter-readings \
  -H "Content-Type: application/json" \
  -d "{\"houseId\":\"$HOUSE_ID\",\"roomId\":\"$ROOM1_ID\",\"readingType\":\"water\",\"readingDate\":\"2024-02-01\",\"readingValue\":100}")
echo "结果:"
echo "$ABNORMAL_READING" | python3 -m json.tool 2>/dev/null || echo "$ABNORMAL_READING"
echo ""

echo "========================================"
echo "11. 测试账单周期重叠检测"
echo "========================================"
echo "尝试为张三再次生成1月账单:"
DUPLICATE_BILL=$(curl -s -X POST $BASE_URL/bills/generate \
  -H "Content-Type: application/json" \
  -d "{\"houseId\":\"$HOUSE_ID\",\"tenantId\":\"$TENANT1_ID\",\"billingStart\":\"2024-01-01\",\"billingEnd\":\"2024-01-31\"}")
echo "结果:"
echo "$DUPLICATE_BILL" | python3 -m json.tool 2>/dev/null || echo "$DUPLICATE_BILL"
echo ""

echo "========================================"
echo "12. 查询张三的账单详情（整月入住）"
echo "========================================"
TENANT1_DETAILS=$(curl -s $BASE_URL/bills/tenant/$TENANT1_ID)
echo "张三账单详情:"
echo "$TENANT1_DETAILS" | python3 -m json.tool 2>/dev/null || echo "$TENANT1_DETAILS"
echo ""

echo "========================================"
echo "13. 查询李四的账单详情（半月退租）"
echo "========================================"
TENANT2_DETAILS=$(curl -s $BASE_URL/bills/tenant/$TENANT2_ID)
echo "李四账单详情:"
echo "$TENANT2_DETAILS" | python3 -m json.tool 2>/dev/null || echo "$TENANT2_DETAILS"
echo ""

echo "========================================"
echo "14. 查询房源账单汇总（含异常读数）"
echo "========================================"
HOUSE_SUMMARY=$(curl -s "$BASE_URL/bills/house/$HOUSE_ID/summary?startDate=2024-01-01&endDate=2024-01-31")
echo "房源账单汇总:"
echo "$HOUSE_SUMMARY" | python3 -m json.tool 2>/dev/null || echo "$HOUSE_SUMMARY"
echo ""

echo "========================================"
echo "测试完成!"
echo "========================================"
