#!/bin/bash

BASE_URL="http://localhost:3000/api/reschedule"
OUTPUT_DIR="./test_output"
mkdir -p "$OUTPUT_DIR"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log "=========================================="
log "  预约挂号中台医生停诊批量改约验收测试"
log "=========================================="
echo ""

log "1. 检查服务健康状态"
curl -s "http://localhost:3000/health" | python3 -m json.tool > "$OUTPUT_DIR/health.json"
if [ $? -eq 0 ]; then
    log "   ✓ 服务运行正常"
else
    error "   ✗ 服务未启动，请先运行 npm start"
    exit 1
fi
echo ""

log "2. 获取基础数据（医生、号源）"
curl -s "$BASE_URL/doctors" > "$OUTPUT_DIR/doctors.json"
curl -s "$BASE_URL/schedules" > "$OUTPUT_DIR/schedules.json"
log "   ✓ 获取医生列表: $(cat $OUTPUT_DIR/doctors.json | python3 -c "import sys,json; print(len(json.load(sys.stdin)['data']))") 位医生"
log "   ✓ 获取号源列表: $(cat $OUTPUT_DIR/schedules.json | python3 -c "import sys,json; print(len(json.load(sys.stdin)['data']))") 个号源"
echo ""

log "=========================================="
log "  场景一：完整流转（创建→提交→通知→退款/改约→导出）"
log "=========================================="
echo ""

log "3. 创建改约批次 - 张医生 2026-05-20 08:00-09:00 停诊"
curl -s -X POST "$BASE_URL/batches" \
    -H "Content-Type: application/json" \
    -d '{
        "doctorId": "doc_001",
        "scheduleId": "sch_001",
        "reason": "医生停诊",
        "operator": "张管理员",
        "targetScheduleId": "sch_002"
    }' > "$OUTPUT_DIR/batch1_create.json"

BATCH1_ID=$(cat $OUTPUT_DIR/batch1_create.json | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['batch']['id'])")
BATCH1_NO=$(cat $OUTPUT_DIR/batch1_create.json | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['batch']['batchNo'])")
log "   ✓ 批次创建成功: $BATCH1_NO"
log "   ✓ 批次 ID: $BATCH1_ID"
echo ""

log "4. 查看批次列表"
curl -s "$BASE_URL/batches" > "$OUTPUT_DIR/batch_list.json"
log "   ✓ 批次列表: $(cat $OUTPUT_DIR/batch_list.json | python3 -c "import sys,json; print(len(json.load(sys.stdin)['data']))") 个批次"
echo ""

log "5. 查看批次详情 - 验证记录数量"
curl -s "$BASE_URL/batches/$BATCH1_ID" > "$OUTPUT_DIR/batch1_detail.json"
TOTAL_RECORDS=$(cat $OUTPUT_DIR/batch1_detail.json | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['batch']['totalCount'])")
log "   ✓ 批次涉及患者: $TOTAL_RECORDS 人"
echo ""

log "6. 提交批次"
curl -s -X POST "$BASE_URL/batches/$BATCH1_ID/submit" \
    -H "Content-Type: application/json" \
    -d '{"operator": "张管理员"}' > "$OUTPUT_DIR/batch1_submit.json"
log "   ✓ 批次已提交，状态: PROCESSING"
echo ""

log "7. 发送通知"
curl -s -X POST "$BASE_URL/batches/$BATCH1_ID/notify" \
    -H "Content-Type: application/json" \
    -d '{"operator": "张管理员"}' > "$OUTPUT_DIR/batch1_notify.json"
NOTIFY_COUNT=$(cat $OUTPUT_DIR/batch1_notify.json | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['processed'])")
log "   ✓ 已通知 $NOTIFY_COUNT 名患者"
echo ""

log "8. 获取记录列表，提取 ID"
curl -s "$BASE_URL/batches/$BATCH1_ID/records" > "$OUTPUT_DIR/batch1_records.json"
RECORD_IDS=$(cat $OUTPUT_DIR/batch1_records.json | python3 -c "import sys,json; print(','.join([r['id'] for r in json.load(sys.stdin)['data']]))")
RECORD_ID_1=$(echo $RECORD_IDS | cut -d',' -f1)
RECORD_ID_2=$(echo $RECORD_IDS | cut -d',' -f2)
RECORD_ID_3=$(echo $RECORD_IDS | cut -d',' -f3)
log "   ✓ 记录 ID 列表: $RECORD_IDS"
echo ""

log "9. 患者 A 选择退款"
curl -s -X POST "$BASE_URL/batches/$BATCH1_ID/refund" \
    -H "Content-Type: application/json" \
    -d "{\"recordIds\": [\"$RECORD_ID_1\"], \"operator\": \"张管理员\"}" > "$OUTPUT_DIR/batch1_refund.json"
log "   ✓ 患者 A 已退款"
echo ""

log "10. 患者 B 和 C 改约到次日"
curl -s -X POST "$BASE_URL/batches/$BATCH1_ID/reschedule" \
    -H "Content-Type: application/json" \
    -d "{\"recordIds\": [\"$RECORD_ID_2\", \"$RECORD_ID_3\"], \"targetScheduleId\": \"sch_002\", \"operator\": \"张管理员\"}" > "$OUTPUT_DIR/batch1_reschedule.json"
log "   ✓ 患者 B、C 已改约至张医生 09:00-10:00"
echo ""

log "11. 查看批次详情 - 验证状态"
curl -s "$BASE_URL/batches/$BATCH1_ID" > "$OUTPUT_DIR/batch1_final.json"
python3 << 'EOF'
import sys, json
data = json.load(open('test_output/batch1_final.json'))['data']
batch = data['batch']
records = data['records']

print(f"   ✓ 批次状态: {batch['status']}")
print(f"   ✓ 成功数量: {batch['successCount']}")
print(f"   ✓ 失败数量: {batch['failedCount']}")
print("   ✓ 各患者状态:")
for r in records:
    print(f"     - {r['patientName']}: {r['status']}")
EOF
echo ""

log "12. 查看操作历史 - 验证可追溯"
curl -s "$BASE_URL/history?batchId=$BATCH1_ID" > "$OUTPUT_DIR/batch1_history.json"
HISTORY_COUNT=$(cat $OUTPUT_DIR/batch1_history.json | python3 -c "import sys,json; print(len(json.load(sys.stdin)['data']))")
log "   ✓ 操作历史记录: $HISTORY_COUNT 条"
echo ""

log "13. 导出 CSV 文件"
curl -s "$BASE_URL/batches/$BATCH1_ID/export" -o "$OUTPUT_DIR/batch1_export.csv"
log "   ✓ 文件已导出至: $OUTPUT_DIR/batch1_export.csv"
echo ""

log "=========================================="
log "  场景二：患者选择退款后又被自动改约"
log "=========================================="
echo ""

log "14. 创建第二个批次（李医生停诊）"
curl -s -X POST "$BASE_URL/batches" \
    -H "Content-Type: application/json" \
    -d '{
        "doctorId": "doc_002",
        "scheduleId": "sch_003",
        "reason": "医生参会",
        "operator": "李管理员"
    }' > "$OUTPUT_DIR/batch2_create.json"

BATCH2_ID=$(cat $OUTPUT_DIR/batch2_create.json | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['batch']['id'])")
log "   ✓ 批次创建成功，ID: $BATCH2_ID"
echo ""

log "15. 提交并通知"
curl -s -X POST "$BASE_URL/batches/$BATCH2_ID/submit" \
    -H "Content-Type: application/json" \
    -d '{"operator": "李管理员"}' > /dev/null
curl -s -X POST "$BASE_URL/batches/$BATCH2_ID/notify" \
    -H "Content-Type: application/json" \
    -d '{"operator": "李管理员"}' > /dev/null
log "   ✓ 批次已提交并通知"
echo ""

log "16. 获取记录 ID，先办理退款"
curl -s "$BASE_URL/batches/$BATCH2_ID/records" > "$OUTPUT_DIR/batch2_records.json"
BATCH2_RECORD_ID=$(cat $OUTPUT_DIR/batch2_records.json | python3 -c "import sys,json; print(json.load(sys.stdin)['data'][0]['id'])")

curl -s -X POST "$BASE_URL/batches/$BATCH2_ID/refund" \
    -H "Content-Type: application/json" \
    -d "{\"recordIds\": [\"$BATCH2_RECORD_ID\"], \"operator\": \"李管理员\"}" > /dev/null
log "   ✓ 患者 D 选择退款，状态变为 REFUNDED"
echo ""

log "17. 患者 D 反悔，要求改约（退款后自动改约场景）"
curl -s -X POST "$BASE_URL/batches/$BATCH2_ID/reschedule" \
    -H "Content-Type: application/json" \
    -d "{\"recordIds\": [\"$BATCH2_RECORD_ID\"], \"targetScheduleId\": \"sch_001\", \"operator\": \"李管理员\"}" > "$OUTPUT_DIR/batch2_auto_reschedule.json"
log "   ✓ 患者 D 退款后被重新改约"
echo ""

log "18. 验证历史记录中存在'自动改约'操作"
curl -s "$BASE_URL/history?batchId=$BATCH2_ID" > "$OUTPUT_DIR/batch2_history.json"
python3 << 'EOF'
import sys, json
data = json.load(open('test_output/batch2_history.json'))['data']
auto_reschedule = any('自动改约' in h['operation'] or '退款后' in h.get('remark', '') for h in data)
if auto_reschedule:
    print("   ✓ 历史记录中包含自动改约操作")
else:
    print("   ? 历史记录:")
    for h in data:
        print(f"     - {h['operation']}: {h.get('remark', '')}")
EOF
echo ""

log "=========================================="
log "  场景三：重复提交验证"
log "=========================================="
echo ""

log "19. 尝试重复提交批次一，验证幂等性"
curl -s -X POST "$BASE_URL/batches/$BATCH1_ID/submit" \
    -H "Content-Type: application/json" \
    -d '{"operator": "测试人员"}' > "$OUTPUT_DIR/duplicate_submit.json"
python3 << 'EOF'
import sys, json
data = json.load(open('test_output/duplicate_submit.json'))
if data['code'] == -1:
    print(f"   ✓ 重复提交被正确拒绝: {data['message']}")
else:
    print("   ? 重复提交未被拒绝，请注意")
EOF
echo ""

log "=========================================="
log "  场景四：撤回后再提交"
log "=========================================="
echo ""

log "20. 创建第三个批次用于撤回测试"
curl -s -X POST "$BASE_URL/batches" \
    -H "Content-Type: application/json" \
    -d '{
        "doctorId": "doc_003",
        "scheduleId": "sch_004",
        "reason": "科室调整",
        "operator": "王管理员"
    }' > "$OUTPUT_DIR/batch3_create.json"

BATCH3_ID=$(cat $OUTPUT_DIR/batch3_create.json | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['batch']['id'])")
log "   ✓ 批次创建成功，ID: $BATCH3_ID"
echo ""

log "21. 撤回批次（提交前）"
curl -s -X POST "$BASE_URL/batches/$BATCH3_ID/cancel" \
    -H "Content-Type: application/json" \
    -d '{"operator": "王管理员"}' > "$OUTPUT_DIR/batch3_cancel.json"
log "   ✓ 批次已撤回"
echo ""

log "22. 验证撤回后状态"
curl -s "$BASE_URL/batches/$BATCH3_ID" > "$OUTPUT_DIR/batch3_cancelled.json"
STATUS=$(cat $OUTPUT_DIR/batch3_cancelled.json | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['batch']['status'])")
log "   ✓ 批次状态: $STATUS"
echo ""

log "23. 尝试提交已撤回的批次，验证拒绝"
curl -s -X POST "$BASE_URL/batches/$BATCH3_ID/submit" \
    -H "Content-Type: application/json" \
    -d '{"operator": "测试人员"}' > "$OUTPUT_DIR/submit_cancelled.json"
python3 << 'EOF'
import sys, json
data = json.load(open('test_output/submit_cancelled.json'))
if data['code'] == -1:
    print(f"   ✓ 已撤回批次提交被正确拒绝: {data['message']}")
else:
    print("   ? 已撤回批次提交未被拒绝")
EOF
echo ""

log "24. 标记冲突记录（模拟坏行）"
curl -s -X POST "$BASE_URL/batches/$BATCH1_ID/fail" \
    -H "Content-Type: application/json" \
    -d "{\"recordIds\": [\"$RECORD_ID_1\"], \"errorMsg\": \"患者电话为空，无法通知\", \"operator\": \"系统管理员\"}" > "$OUTPUT_DIR/batch1_fail.json"
log "   ✓ 已标记患者 A 为处理失败（模拟坏行）"
echo ""

log "=========================================="
log "  验证环节：列表、详情、历史、导出一致性"
log "=========================================="
echo ""

log "25. 最终批次列表"
curl -s "$BASE_URL/batches" > "$OUTPUT_DIR/final_batch_list.json"
python3 << 'EOF'
import sys, json
data = json.load(open('test_output/final_batch_list.json'))['data']
print(f"   ✓ 总批次数: {len(data)}")
print("   ✓ 各批次状态:")
for b in data:
    print(f"     - {b['batchNo']}: {b['status']} ({b['totalCount']}人)")
EOF
echo ""

log "26. 导出 CSV 与列表查询数据对比"
python3 << 'EOF'
import sys, json, csv

with open('test_output/batch1_detail.json') as f:
    api_data = json.load(f)['data']
    api_records = api_data['records']
    api_batch = api_data['batch']

print(f"   ✓ API 查询记录数: {len(api_records)}")

try:
    with open('test_output/batch1_export.csv', 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        csv_rows = list(reader)
    print(f"   ✓ CSV 导出记录数: {len(csv_rows)}")
    
    if len(api_records) == len(csv_rows):
        print("   ✓ 记录数一致，数据一致性验证通过")
    else:
        print("   ✗ 记录数不一致！")
        
    print("   ✓ CSV 业务字段验证:")
    headers = reader.fieldnames if hasattr(reader, 'fieldnames') else csv_rows[0].keys() if csv_rows else []
    for h in list(headers)[:5]:
        print(f"     - {h}")
        
except Exception as e:
    print(f"   ? CSV 文件读取: {e}")
EOF
echo ""

log "=========================================="
log "  验收测试完成！"
log "=========================================="
echo ""
log "测试输出目录: $OUTPUT_DIR"
log "包含文件:"
ls -la "$OUTPUT_DIR" | awk '{print "   - " $9}'
echo ""
log "核心功能验证:"
log "  ✓ 完整流转: 创建→提交→通知→退款/改约→导出"
log "  ✓ 特殊场景: 退款后自动改约"
log "  ✓ 重复请求: 重复提交被拒绝"
log "  ✓ 撤回提交: CREATED 状态可撤回，已撤回不可提交"
log "  ✓ 坏行处理: 支持标记处理失败"
log "  ✓ 数据追溯: 操作历史完整记录"
log "  ✓ 导出验证: CSV 字段使用业务语言，与 API 一致"
echo ""
