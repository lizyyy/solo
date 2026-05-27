#!/bin/bash

BASE_URL="http://localhost:3000"

echo "=== 快递驿站滞留件处理 API 测试流程 ==="
echo ""

echo "=== 1. 健康检查 ==="
curl -s "$BASE_URL/api/health"
echo ""

echo -e "\n=== 2. 创建包含多种情况的批次（正常、待补充、已拦截、重复运单） ==="
RESPONSE=$(curl -s -X POST "$BASE_URL/api/batches" \
  -H "Content-Type: application/json" \
  -d '{
    "station_id": "STATION_001",
    "batch_no": "BATCH_20240527_001",
    "items": [
      {
        "waybill_no": "SF1234567890001",
        "receiver_name": "张三",
        "receiver_phone": "13800138001",
        "detained_at": "2024-05-25T09:00:00Z",
        "expected_pickup_at": "2024-05-30T18:00:00Z",
        "parcel_type": "普通",
        "storage_location": "A-01-01",
        "remark": ""
      },
      {
        "waybill_no": "SF1234567890002",
        "receiver_name": "",
        "receiver_phone": "13800138002",
        "detained_at": "2024-05-20T09:00:00Z",
        "expected_pickup_at": "2024-05-25T18:00:00Z",
        "parcel_type": "生鲜",
        "storage_location": "B-02-01",
        "remark": ""
      },
      {
        "waybill_no": "SF1234567890003",
        "receiver_name": "王五",
        "receiver_phone": "13800138003",
        "detained_at": "2024-05-28T09:00:00Z",
        "expected_pickup_at": "2024-05-26T18:00:00Z",
        "parcel_type": "贵重",
        "storage_location": "C-01-01",
        "remark": "用户要求拦截"
      },
      {
        "waybill_no": "SF1234567890001",
        "receiver_name": "赵六",
        "receiver_phone": "13800138004",
        "detained_at": "2024-05-24T09:00:00Z",
        "expected_pickup_at": "2024-05-29T18:00:00Z",
        "parcel_type": "普通",
        "storage_location": "A-01-02",
        "remark": ""
      }
    ]
  }')

echo "$RESPONSE"
echo ""

BATCH_ID=$(echo "$RESPONSE" | grep -o '"batch_id":"[^"]*"' | cut -d'"' -f4)
echo -e "批次ID: $BATCH_ID"

echo -e "\n=== 3. 测试重复提交（应返回历史结果，duplicate: true） ==="
curl -s -X POST "$BASE_URL/api/batches" \
  -H "Content-Type: application/json" \
  -d '{
    "station_id": "STATION_001",
    "batch_no": "BATCH_20240527_002",
    "items": [
      {
        "waybill_no": "SF1234567890001",
        "receiver_name": "张三",
        "receiver_phone": "13800138001",
        "detained_at": "2024-05-25T09:00:00Z",
        "expected_pickup_at": "2024-05-30T18:00:00Z",
        "parcel_type": "普通",
        "storage_location": "A-01-01",
        "remark": ""
      },
      {
        "waybill_no": "SF1234567890002",
        "receiver_name": "",
        "receiver_phone": "13800138002",
        "detained_at": "2024-05-20T09:00:00Z",
        "expected_pickup_at": "2024-05-25T18:00:00Z",
        "parcel_type": "生鲜",
        "storage_location": "B-02-01",
        "remark": ""
      },
      {
        "waybill_no": "SF1234567890003",
        "receiver_name": "王五",
        "receiver_phone": "13800138003",
        "detained_at": "2024-05-28T09:00:00Z",
        "expected_pickup_at": "2024-05-26T18:00:00Z",
        "parcel_type": "贵重",
        "storage_location": "C-01-01",
        "remark": "用户要求拦截"
      },
      {
        "waybill_no": "SF1234567890001",
        "receiver_name": "赵六",
        "receiver_phone": "13800138004",
        "detained_at": "2024-05-24T09:00:00Z",
        "expected_pickup_at": "2024-05-29T18:00:00Z",
        "parcel_type": "普通",
        "storage_location": "A-01-02",
        "remark": ""
      }
    ]
  }'
echo ""

echo -e "\n=== 4. 查看字段追踪链路（关键字段可追溯） ==="
curl -s "$BASE_URL/api/batches/$BATCH_ID/trace"
echo ""

echo -e "\n=== 5. 查看错误明细（包含原始材料位置 row_index） ==="
curl -s "$BASE_URL/api/batches/$BATCH_ID/errors"
echo ""

echo -e "\n=== 6. 下载 JSON 格式报告 ==="
curl -s "$BASE_URL/api/batches/$BATCH_ID/report"
echo ""

echo -e "\n=== 7. 下载 CSV 格式报告 ==="
curl -s "$BASE_URL/api/batches/$BATCH_ID/report?format=csv" -o batch_report.csv
echo "CSV报告已保存到 batch_report.csv"

echo -e "\n=== 测试流程完成 ==="
echo ""
echo "提示：请确保服务已启动 (npm start)"
