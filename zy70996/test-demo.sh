#!/bin/bash

BASE_URL="http://localhost:3000"

echo "=== 工会福利领用系统测试脚本 ==="
echo ""

echo "1. 健康检查"
curl -s "$BASE_URL/api/health" | head -c 200
echo ""
echo ""

echo "2. 查询所有员工"
curl -s "$BASE_URL/api/employees" | head -c 500
echo ""
echo ""

echo "3. 查询所有批次"
curl -s "$BASE_URL/api/batches" | head -c 500
echo ""
echo ""

echo "4. 导入领用CSV（测试离职拦截和重复领取）"
CSV_CONTENT="employeeId,method,proxyEmployeeId,couponCode,备注
E001,SELF,,COUPON_SPRING_0001,本人领取
E005,SELF,,,离职员工测试
E002,PROXY,E003,,代领测试
E001,SELF,,COUPON_SPRING_0002,重复领取测试"

curl -s -X POST "$BASE_URL/api/collection/import/csv" \
  -H "Content-Type: application/json" \
  -d "{\"batchId\": \"BATCH_2026_SPRING\", \"operator\": \"union_worker\", \"csvContent\": \"$CSV_CONTENT\"}"
echo ""
echo ""

echo "5. 查询所有领用记录"
curl -s "$BASE_URL/api/collection" | head -c 1000
echo ""
echo ""

echo "6. 查询第一条记录的追踪信息"
FIRST_ID=$(curl -s "$BASE_URL/api/collection" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
if [ -n "$FIRST_ID" ]; then
  echo "记录ID: $FIRST_ID"
  curl -s "$BASE_URL/api/collection/$FIRST_ID/trace"
fi
echo ""
echo ""

echo "7. 按领取方式筛选（代领）"
curl -s "$BASE_URL/api/collection?method=PROXY" | head -c 500
echo ""
echo ""

echo "8. 按员工状态筛选（在职）"
curl -s "$BASE_URL/api/collection?employeeStatus=ACTIVE" | head -c 500
echo ""
echo ""

echo "9. 导出CSV"
curl -s -o "export_test.csv" "$BASE_URL/api/export/collection?batchId=BATCH_2026_SPRING"
echo "导出文件已保存为 export_test.csv"
echo ""

echo "=== 测试完成 ==="
