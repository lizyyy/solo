#!/bin/bash

BASE_URL="http://localhost:3000"

echo "=== 快递驿站滞留件处理 API 测试流程 ==="
echo ""

echo "=== 1. 健康检查 ==="
curl -s "$BASE_URL/api/health"
echo ""

echo -e "\n=== 2. 创建批次（故意打乱运单号顺序，验证row_index保持原始位置） ==="
RESPONSE=$(curl -s -X POST "$BASE_URL/api/batches" \
  -H "Content-Type: application/json" \
  -d @- <<'PAYLOAD'
{
    "station_id": "STATION_TEST",
    "batch_no": "TEST_001",
    "items": [
      {
        "waybill_no": "ZZZZ00000000004",
        "receiver_name": "李四",
        "receiver_phone": "13900139002",
        "detained_at": "2026-05-20T10:00:00Z",
        "expected_pickup_at": "2026-05-25T18:00:00Z",
        "parcel_type": "普通",
        "storage_location": "A-02",
        "remark": ""
      },
      {
        "waybill_no": "AAAA00000000001",
        "receiver_name": "",
        "receiver_phone": "13800138001",
        "detained_at": "2026-05-22T09:00:00Z",
        "expected_pickup_at": "2026-05-28T18:00:00Z",
        "parcel_type": "生鲜",
        "storage_location": "B-01",
        "remark": ""
      },
      {
        "waybill_no": "ZZZZ00000000003",
        "receiver_name": "王五",
        "receiver_phone": "13800138003",
        "detained_at": "2026-05-26T09:00:00Z",
        "expected_pickup_at": "2026-05-24T18:00:00Z",
        "parcel_type": "贵重",
        "storage_location": "C-01",
        "remark": "用户要求拦截"
      },
      {
        "waybill_no": "ZZZZ00000000002",
        "receiver_name": "赵六",
        "receiver_phone": "13800138004",
        "detained_at": "2026-05-21T09:00:00Z",
        "expected_pickup_at": "2026-05-27T18:00:00Z",
        "parcel_type": "普通",
        "storage_location": "A-03",
        "remark": ""
      }
    ]
}
PAYLOAD
)

echo "$RESPONSE" | python3 -m json.tool
echo ""

BATCH_ID=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['batch_id'])")
echo "批次ID: $BATCH_ID"

echo -e "\n=== 3. 验证row_index是否与原始提交顺序一致 ==="
echo "原始提交顺序:"
echo "  行1: ZZZZ00000000004 (李四)"
echo "  行2: AAAA00000000001 (空姓名 - 应有错误)"
echo "  行3: ZZZZ00000000003 (王五 - 时间矛盾 + 拦截)"
echo "  行4: ZZZZ00000000002 (赵六)"
echo ""

echo -e "\n=== 4. 查看错误明细（验证row_index指向原始位置） ==="
curl -s "$BASE_URL/api/batches/$BATCH_ID/errors" | python3 -m json.tool
echo ""

echo -e "\n=== 5. 查看字段追踪链路（验证可追溯） ==="
curl -s "$BASE_URL/api/batches/$BATCH_ID/trace" | python3 -m json.tool
echo ""

echo -e "\n=== 6. 测试重复提交（应返回历史结果，duplicate: true） ==="
curl -s -X POST "$BASE_URL/api/batches" \
  -H "Content-Type: application/json" \
  -d @- <<'PAYLOAD'
{
    "station_id": "STATION_TEST",
    "batch_no": "TEST_001_DUPLICATE",
    "items": [
      {
        "waybill_no": "ZZZZ00000000004",
        "receiver_name": "李四",
        "receiver_phone": "13900139002",
        "detained_at": "2026-05-20T10:00:00Z",
        "expected_pickup_at": "2026-05-25T18:00:00Z",
        "parcel_type": "普通",
        "storage_location": "A-02",
        "remark": ""
      },
      {
        "waybill_no": "AAAA00000000001",
        "receiver_name": "",
        "receiver_phone": "13800138001",
        "detained_at": "2026-05-22T09:00:00Z",
        "expected_pickup_at": "2026-05-28T18:00:00Z",
        "parcel_type": "生鲜",
        "storage_location": "B-01",
        "remark": ""
      },
      {
        "waybill_no": "ZZZZ00000000003",
        "receiver_name": "王五",
        "receiver_phone": "13800138003",
        "detained_at": "2026-05-26T09:00:00Z",
        "expected_pickup_at": "2026-05-24T18:00:00Z",
        "parcel_type": "贵重",
        "storage_location": "C-01",
        "remark": "用户要求拦截"
      },
      {
        "waybill_no": "ZZZZ00000000002",
        "receiver_name": "赵六",
        "receiver_phone": "13800138004",
        "detained_at": "2026-05-21T09:00:00Z",
        "expected_pickup_at": "2026-05-27T18:00:00Z",
        "parcel_type": "普通",
        "storage_location": "A-03",
        "remark": ""
      }
    ]
}
PAYLOAD
 | python3 -m json.tool
echo ""

echo -e "\n=== 7. 下载 JSON 格式报告 ==="
curl -s "$BASE_URL/api/batches/$BATCH_ID/report" | python3 -m json.tool
echo ""

echo -e "\n=== 8. 下载 CSV 格式报告 ==="
curl -s "$BASE_URL/api/batches/$BATCH_ID/report?format=csv" -o batch_report.csv
echo "CSV报告已保存到 batch_report.csv"
echo ""

echo "=== 测试完成 ==="
