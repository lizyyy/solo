#!/bin/bash
set -e

BASE_URL="http://localhost:8000"

echo "========================================"
echo "民宿保洁排班异常回执状态机 - 完整测试流程"
echo "========================================"

echo ""
echo "[步骤 1] 检查服务健康状态"
curl -s "$BASE_URL/health" | python3 -m json.tool

echo ""
echo "========================================"
echo "[步骤 2] 创建批次 - 订单日历"
echo "========================================"
BATCH_RESPONSE=$(curl -s -X POST "$BASE_URL/api/batch/" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "2026年5月保洁异常回执-订单日历",
    "source_type": "order_calendar",
    "operator": "店长_张三",
    "store_code": "STORE_001",
    "remark": "5月20日-25日订单日历导出数据"
  }')
echo "$BATCH_RESPONSE" | python3 -m json.tool
BATCH_ID=$(echo "$BATCH_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
BATCH_NO=$(echo "$BATCH_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['batch_no'])")
echo "批次ID: $BATCH_ID, 批次号: $BATCH_NO"

echo ""
echo "========================================"
echo "[步骤 3] 导入回执数据 (模拟订单日历数据)"
echo "========================================"
IMPORT_RESPONSE=$(curl -s -X POST "$BASE_URL/api/batch/$BATCH_ID/import" \
  -H "Content-Type: multipart/form-data" \
  -F 'items=[
    {
      "receipt_no": "R001_20260520",
      "room_no": "101",
      "guest_name": "王小明",
      "check_in_date": "2026-05-20T14:00:00",
      "check_out_date": "2026-05-22T12:00:00",
      "scheduled_clean_date": "2026-05-22T13:00:00",
      "exception_type": "late_checkin",
      "exception_desc": "客人晚到，临时换布草冲突",
      "source_row_no": 2,
      "source_raw_data": {"col_a": "101", "col_b": "王小明"}
    },
    {
      "receipt_no": "R002_20260520",
      "room_no": "102",
      "guest_name": "李小红",
      "check_in_date": "2026-05-20T15:00:00",
      "check_out_date": "2026-05-21T11:00:00",
      "scheduled_clean_date": "2026-05-21T12:00:00",
      "exception_type": "early_checkout",
      "exception_desc": "临时提前退房，保洁未排",
      "source_row_no": 3,
      "source_raw_data": {"col_a": "102", "col_b": "李小红"}
    },
    {
      "receipt_no": "R003_20260520",
      "room_no": "201",
      "guest_name": "张大卫",
      "check_in_date": "2026-05-19T14:00:00",
      "check_out_date": "2026-05-23T12:00:00",
      "scheduled_clean_date": "2026-05-20T10:00:00",
      "exception_type": "maintenance",
      "exception_desc": "空调维修，需要重新安排保洁",
      "source_row_no": 4,
      "source_raw_data": {"col_a": "201", "col_b": "张大卫"}
    }
  ]' \
  -F "source_file=订单日历_20260520.xlsx" \
  -F "operator=数据员_李四")
echo "$IMPORT_RESPONSE" | python3 -m json.tool

echo ""
echo "========================================"
echo "[步骤 4] 查看批次详情"
echo "========================================"
curl -s "$BASE_URL/api/batch/$BATCH_ID" | python3 -m json.tool

echo ""
echo "========================================"
echo "[步骤 5] 查看回执列表"
echo "========================================"
RECEIPTS=$(curl -s "$BASE_URL/api/receipt/?batch_id=$BATCH_ID")
echo "$RECEIPTS" | python3 -m json.tool
RECEIPT1_ID=$(echo "$RECEIPTS" | python3 -c "import sys,json; print(json.load(sys.stdin)[0]['id'])")
RECEIPT2_ID=$(echo "$RECEIPTS" | python3 -c "import sys,json; print(json.load(sys.stdin)[1]['id'])")
RECEIPT3_ID=$(echo "$RECEIPTS" | python3 -c "import sys,json; print(json.load(sys.stdin)[2]['id'])")

echo ""
echo "========================================"
echo "[步骤 6] 复核回执1 - 确认异常"
echo "========================================"
curl -s -X POST "$BASE_URL/api/receipt/$RECEIPT1_ID/review" \
  -H "Content-Type: application/json" \
  -d '{
    "review_result": "confirmed",
    "review_reason": "核实订单日历，确实存在晚到换布草冲突",
    "reviewed_by": "复核员_王五"
  }' | python3 -m json.tool

echo ""
echo "========================================"
echo "[步骤 7] 复核回执2 - 存疑"
echo "========================================"
curl -s -X POST "$BASE_URL/api/receipt/$RECEIPT2_ID/review" \
  -H "Content-Type: application/json" \
  -d '{
    "review_result": "disputed",
    "review_reason": "与保洁群消息核对，实际已安排保洁，需要进一步核实",
    "reviewed_by": "复核员_王五"
  }' | python3 -m json.tool

echo ""
echo "========================================"
echo "[步骤 8] 人工改判回执2 - 店长介入"
echo "========================================"
curl -s -X POST "$BASE_URL/api/receipt/$RECEIPT2_ID/overrule" \
  -H "Content-Type: application/json" \
  -d '{
    "overrule_reason": "已查看保洁群截图，保洁确实去了但记录漏登。予以修正",
    "overruled_by": "店长_张三",
    "new_status": "resolved"
  }' | python3 -m json.tool

echo ""
echo "========================================"
echo "[步骤 9] 复核回执3 - 确认异常"
echo "========================================"
curl -s -X POST "$BASE_URL/api/receipt/$RECEIPT3_ID/review" \
  -H "Content-Type: application/json" \
  -d '{
    "review_result": "confirmed",
    "review_reason": "维修单确实存在，保洁延后安排",
    "reviewed_by": "复核员_王五"
  }' | python3 -m json.tool

echo ""
echo "========================================"
echo "[步骤 10] 查看操作历史 - 回执2的变更记录"
echo "========================================"
curl -s "$BASE_URL/api/history/receipt/$RECEIPT2_ID/logs" | python3 -m json.tool

echo ""
echo "========================================"
echo "[步骤 11] 查看差异记录"
echo "========================================"
curl -s "$BASE_URL/api/history/receipt/$RECEIPT2_ID/diffs" | python3 -m json.tool

echo ""
echo "========================================"
echo "[步骤 12] 模拟重复导入 - 验证边界情况"
echo "========================================"
echo "尝试导入重复的回执编号..."
curl -s -X POST "$BASE_URL/api/batch/$BATCH_ID/import" \
  -H "Content-Type: multipart/form-data" \
  -F 'items=[
    {
      "receipt_no": "R001_20260520",
      "room_no": "101",
      "guest_name": "王小明",
      "source_row_no": 5
    }
  ]' \
  -F "source_file=重复导入测试.xlsx" \
  -F "operator=测试员" | python3 -m json.tool

echo ""
echo "========================================"
echo "[步骤 13] 冻结结算"
echo "========================================"
curl -s -X POST "$BASE_URL/api/batch/$BATCH_ID/freeze" \
  -H "Content-Type: application/json" \
  -d '{
    "frozen_by": "财务_赵六",
    "frozen_reason": "5月20日异常回执核对完成，冻结结算"
  }' | python3 -m json.tool

echo ""
echo "========================================"
echo "[步骤 14] 验证冻结后无法修改 - 尝试改判"
echo "========================================"
echo "尝试冻结后改判..."
curl -s -X POST "$BASE_URL/api/receipt/$RECEIPT1_ID/overrule" \
  -H "Content-Type: application/json" \
  -d '{
    "overrule_reason": "测试冻结后修改",
    "overruled_by": "测试员",
    "new_status": "cancelled"
  }' | python3 -m json.tool

echo ""
echo "========================================"
echo "[步骤 15] 导出汇总 - 店长关注的重点"
echo "========================================"
curl -s "$BASE_URL/api/export/batch/$BATCH_ID/summary?exported_by=店长_张三" | python3 -m json.tool

echo ""
echo "========================================"
echo "[步骤 16] 导出明细"
echo "========================================"
curl -s "$BASE_URL/api/export/batch/$BATCH_ID/details" | python3 -m json.tool

echo ""
echo "========================================"
echo "[步骤 17] 查看失败清单"
echo "========================================"
curl -s "$BASE_URL/api/export/batch/$BATCH_ID/failed-list" | python3 -m json.tool

echo ""
echo "========================================"
echo "[步骤 18] 批次归档"
echo "========================================"
curl -s -X POST "$BASE_URL/api/batch/$BATCH_ID/archive" \
  -H "Content-Type: multipart/form-data" \
  -F "operator=档案员" | python3 -m json.tool

echo ""
echo "========================================"
echo "测试流程完成！"
echo "========================================"
echo ""
echo "请检查以下关键点："
echo "1. 失败清单是否正确记录了存疑项"
echo "2. 人工改判理由是否在导出汇总中可见"
echo "3. 冻结前后的状态是否有差异记录"
echo "4. 原始证据（source_file, source_row_no）是否保留"
echo ""
