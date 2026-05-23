#!/bin/bash
set -e

BASE_URL="http://localhost:8000"

echo "========================================"
echo "边界情况专项测试"
echo "========================================"

echo ""
echo "[测试 1] 创建批次 - 保洁群消息来源"
BATCH_RESPONSE=$(curl -s -X POST "$BASE_URL/api/batch/" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "边界测试批次",
    "source_type": "cleaning_group",
    "operator": "测试员",
    "store_code": "TEST_001"
  }')
BATCH_ID=$(echo "$BATCH_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "批次ID: $BATCH_ID 创建成功"

echo ""
echo "[测试 2] 部分失败导入 - 混合成功和失败数据"
echo "导入3条，其中1条重复（先导入成功，再重复导入）"

# 先导入2条
curl -s -X POST "$BASE_URL/api/batch/$BATCH_ID/import" \
  -H "Content-Type: multipart/form-data" \
  -F 'items=[
    {"receipt_no": "TEST_R001", "room_no": "301", "source_row_no": 1},
    {"receipt_no": "TEST_R002", "room_no": "302", "source_row_no": 2}
  ]' \
  -F "source_file=测试文件.xlsx" \
  -F "operator=测试员" | python3 -m json.tool

# 再导入3条，包含1条重复
echo ""
echo "再次导入，包含重复的 TEST_R001..."
curl -s -X POST "$BASE_URL/api/batch/$BATCH_ID/import" \
  -H "Content-Type: multipart/form-data" \
  -F 'items=[
    {"receipt_no": "TEST_R001", "room_no": "301", "source_row_no": 10},
    {"receipt_no": "TEST_R003", "room_no": "303", "source_row_no": 11},
    {"receipt_no": "TEST_R004", "room_no": "304", "source_row_no": 12}
  ]' \
  -F "source_file=测试文件_重复.xlsx" \
  -F "operator=测试员" | python3 -m json.tool

echo ""
echo "[测试 3] 查看批次状态 - 应该是 partial_failed"
curl -s "$BASE_URL/api/batch/$BATCH_ID" | python3 -c "import sys,json; d=json.load(sys.stdin); print('状态:', d['status'], '回执数:', d['receipt_count'])"

echo ""
echo "[测试 4] 撤回批次"
curl -s -X POST "$BASE_URL/api/batch/$BATCH_ID/withdraw" \
  -H "Content-Type: application/json" \
  -d '{"operator": "测试员", "reason": "数据需要重新整理"}' | python3 -c "import sys,json; print('撤回后状态:', json.load(sys.stdin)['status'])"

echo ""
echo "[测试 5] 撤回后重新提交"
curl -s -X POST "$BASE_URL/api/batch/$BATCH_ID/resubmit" \
  -H "Content-Type: multipart/form-data" \
  -F "operator=测试员" | python3 -c "import sys,json; print('重提后状态:', json.load(sys.stdin)['status'])"

echo ""
echo "[测试 6] 查看完整操作日志"
curl -s "$BASE_URL/api/history/batch/$BATCH_ID/logs" | python3 -c "
import sys,json
logs = json.load(sys.stdin)
print('操作记录数:', len(logs))
for l in logs:
    print(f'  - {l[\"operation_type\"]} 由 {l[\"operator\"]} 在 {l[\"operation_time\"][:19]}')
    if l.get('diff_summary'):
        print(f'    变更: {list(l[\"diff_summary\"].keys())}')
"

echo ""
echo "[测试 7] 对比某条操作的前后差异"
LOG_ID=$(curl -s "$BASE_URL/api/history/batch/$BATCH_ID/logs" | python3 -c "import sys,json; print(json.load(sys.stdin)[0]['id'])")
echo "查看日志ID $LOG_ID 的状态对比..."
curl -s "$BASE_URL/api/history/logs/$LOG_ID/compare" | python3 -c "
import sys,json
d = json.load(sys.stdin)
print('操作类型:', d['operation_type'])
print('变更前状态:', d['before_state'])
print('变更后状态:', d['after_state'])
print('差异摘要:', d['diff_summary'])
"

echo ""
echo "[测试 8] 冻结后再冻结 - 应该报错"
echo "先冻结..."
curl -s -X POST "$BASE_URL/api/batch/$BATCH_ID/freeze" \
  -H "Content-Type: application/json" \
  -d '{"frozen_by": "测试员", "frozen_reason": "测试冻结"}' | python3 -c "import sys,json; print('冻结状态:', json.load(sys.stdin)['is_frozen'])"

echo "再次冻结，应该报错..."
curl -s -X POST "$BASE_URL/api/batch/$BATCH_ID/freeze" \
  -H "Content-Type: application/json" \
  -d '{"frozen_by": "测试员", "frozen_reason": "重复冻结测试"}' | python3 -m json.tool

echo ""
echo "========================================"
echo "边界测试完成！"
echo "========================================"
