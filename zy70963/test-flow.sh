#!/bin/bash

echo "🚀 开始完整流程测试..."
echo ""

echo "1️⃣ 提交批次（正常数据）"
curl -s -X POST http://localhost:3000/api/batches \
  -H "Content-Type: application/json" \
  -d '{
    "batch_no": "TEST-2024-001",
    "store_id": "STORE001",
    "store_name": "朝阳区望京店",
    "region": "华北区",
    "submit_date": "2024-01-15",
    "processor": "李财务",
    "records": [
      {
        "record_date": "2024-01-01",
        "opening_cash": 5000,
        "pos_sales": 15680.50,
        "cash_deposit": 15000,
        "imprest_borrow": 0,
        "imprest_return": 0,
        "closing_cash": 5682,
        "is_holiday": true,
        "holiday_delay_note": "元旦假期入账延迟"
      },
      {
        "record_date": "2024-01-02",
        "opening_cash": 5682,
        "pos_sales": 22350.00,
        "cash_deposit": 22000,
        "imprest_borrow": 200,
        "imprest_return": 0,
        "closing_cash": 5830
      },
      {
        "record_date": "2024-01-03",
        "opening_cash": 5830,
        "pos_sales": 18500.00,
        "cash_deposit": 18500,
        "imprest_borrow": 0,
        "imprest_return": 200,
        "closing_cash": 6032
      }
    ]
  }'

echo ""
echo ""
echo "2️⃣ 重复提交同一批次（测试去重）"
curl -s -X POST http://localhost:3000/api/batches \
  -H "Content-Type: application/json" \
  -d '{
    "batch_no": "TEST-2024-001",
    "store_id": "STORE001",
    "store_name": "朝阳区望京店",
    "region": "华北区",
    "submit_date": "2024-01-15",
    "processor": "李财务",
    "records": [{"record_date": "2024-01-01"}]
  }'

echo ""
echo ""
echo "3️⃣ 提交包含异常数据的批次（待补充+已拦截）"
curl -s -X POST http://localhost:3000/api/batches \
  -H "Content-Type: application/json" \
  -d '{
    "batch_no": "TEST-2024-002",
    "store_id": "STORE002",
    "store_name": "海淀区中关村店",
    "region": "华北区",
    "submit_date": "2024-01-15",
    "processor": "王财务",
    "records": [
      {
        "record_date": "2024-01-04",
        "opening_cash": 5000,
        "pos_sales": null,
        "cash_deposit": 10000,
        "closing_cash": 5000
      },
      {
        "record_date": "2024-01-05",
        "opening_cash": 5000,
        "pos_sales": 50000,
        "cash_deposit": 0,
        "imprest_borrow": 0,
        "closing_cash": 54500
      }
    ]
  }'

echo ""
echo ""
echo "4️⃣ 查询批次详情"
curl -s http://localhost:3000/api/batches/TEST-2024-001

echo ""
echo ""
echo "5️⃣ 查看统计数据"
curl -s http://localhost:3000/api/statistics

echo ""
echo ""
echo "6️⃣ 导出批次报告"
EXPORT_RESULT=$(curl -s http://localhost:3000/api/export/batch/TEST-2024-001)
echo "$EXPORT_RESULT"
FILENAME=$(echo "$EXPORT_RESULT" | sed -n 's/.*"filename":"\([^"]*\)".*/\1/p')

echo ""
echo "7️⃣ 下载报告文件"
if [ -n "$FILENAME" ]; then
  curl -s -O "http://localhost:3000/api/export/download/$FILENAME"
  echo "已下载文件: $FILENAME"
  ls -la "$FILENAME"
fi

echo ""
echo ""
echo "✅ 测试完成！"
