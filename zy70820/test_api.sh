#!/bin/bash

echo "=== 社区疫苗预约服务 API 测试脚本"
echo ""

BASE_URL="http://localhost:3000"

echo "1. 健康检查"
curl -s "$BASE_URL/health" | jq .
echo ""

echo "2. 创建批次"
BATCH_RESPONSE=$(curl -s -X POST "$BASE_URL/api/batches" \
  -H "Content-Type: application/json" \
  -d '{
    "batchNo": "BATCH2024001",
    "name": "2024年1月第一批次",
    "vaccineCode": "VAC001",
    "vaccineName": "乙肝疫苗",
    "createdBy": "admin"
  }')
echo "$BATCH_RESPONSE" | jq .
BATCH_ID=$(echo "$BATCH_RESPONSE" | jq -r '.data.id')
echo "批次ID: $BATCH_ID"
echo ""

echo "3. 导入疫苗库存"
curl -s -X POST "$BASE_URL/api/import/inventory" \
  -H "Content-Type: application/json" \
  -d "{\"jsonContent\": $(cat examples/sample_inventory.json | jq -c -R .)}" | jq .
echo ""

echo "4. 导入禁忌规则"
curl -s -X POST "$BASE_URL/api/import/contraindications" \
  -H "Content-Type: application/json" \
  -d "{\"jsonContent\": $(cat examples/sample_contraindications.json | jq -c -R .)}" | jq .
echo ""

echo "5. 导入预约CSV"
CSV_CONTENT=$(cat examples/sample_appointments.csv | sed 's/$/\\n/g' | tr -d '\n')
curl -s -X POST "$BASE_URL/api/import/appointments" \
  -H "Content-Type: application/json" \
  -d "{\"csvContent\": \"儿童姓名,身份证号,疫苗编码,疫苗名称,剂次,出生日期,性别,监护人姓名,监护人电话,住址,预约日期\n张三,110101202001011234,VAC001,乙肝疫苗,1,2020-01-01,male,张父,13800138001,北京市朝阳区,2024-01-15\n李四,110101202002022345,VAC001,乙肝疫苗,1,2020-02-02,male,李父,13800138002,北京市海淀区,2024-01-15\n王五,110101201903033456,VAC002,卡介苗,1,2019-03-03,female,王父,13800138003,北京市西城区,2024-01-16\", \"batchId\": \"$BATCH_ID\"}" | jq .
echo ""

echo "6. 查询所有预约记录"
RECORDS_RESPONSE=$(curl -s "$BASE_URL/api/records?batchId=$BATCH_ID")
echo "$RECORDS_RESPONSE" | jq .
FIRST_RECORD_ID=$(echo "$RECORDS_RESPONSE" | jq -r '.data[0].id')
echo "第一条记录ID: $FIRST_RECORD_ID"
echo ""

echo "7. 批量处理预约记录"
curl -s -X POST "$BASE_URL/api/batches/$BATCH_ID/process-all" \
  -H "Content-Type: application/json" \
  -d '{"operator": "张医生"}' | jq .
echo ""

echo "8. 查询单条记录详情（含追踪信息）"
curl -s "$BASE_URL/api/records/$FIRST_RECORD_ID" | jq .
echo ""

echo "9. 查询候补列表"
curl -s "$BASE_URL/api/batches/$BATCH_ID/waitlist" | jq .
echo ""

echo "10. 查询候补追踪信息"
curl -s "$BASE_URL/api/batches/$BATCH_ID/waitlist/traceability" | jq .
echo ""

echo "11. 查询批次统计信息"
curl -s "$BASE_URL/api/batches/$BATCH_ID" | jq .
echo ""

echo "12. 按儿童查询历史记录"
curl -s "$BASE_URL/api/children/110101202001011234/history" | jq .
echo ""

echo "测试完成！"
