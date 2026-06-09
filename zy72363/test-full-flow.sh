#!/bin/bash
# 离心机转速安全区 - 全链路验证脚本
# 验证流程：导入1 → 重复导入（去重）→ 改备注 → 改系数 → 回滚

BASE="http://localhost:3001/api"
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'
PASS=0
FAIL=0

pass() { echo -e "  ✅ ${GREEN}$1${NC}"; ((PASS++)); }
fail() { echo -e "  ❌ ${RED}$1${NC}"; ((FAIL++)); }
section() { echo -e "\n========== $1 =========="; }

# ---- Step 0: 健康检查 ----
section "Step 0: 健康检查"
HEALTH=$(curl -s "$BASE/safety-zones/stats" 2>/dev/null)
echo "$HEALTH" | grep -q "success.*true"
if [ $? -eq 0 ]; then pass "API 健康"; else fail "API 不响应"; fi

# ---- Step 1: 首次导入 batch-1 (8条) ----
section "Step 1: 首次导入 sample-batch-1.csv (8条传感器)"
BATCH1_ID="BATCH-TEST-$(date +%s)-001"
IMPORT1=$(curl -s -X POST "$BASE/sensors/import" \
  -F "batchId=$BATCH1_ID" \
  -F "file=@sample-batch-1.csv;type=text/csv" 2>/dev/null)
echo "$IMPORT1"
IMP1_FILE=$(echo "$IMPORT1" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['totalInFile'])" 2>/dev/null)
IMP1_OK=$(echo "$IMPORT1" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['imported'])" 2>/dev/null)
IMP1_DUP=$(echo "$IMPORT1" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['duplicates'])" 2>/dev/null)

[ "$IMP1_FILE" = "8" ] && pass "文件总数=8" || fail "文件总数=$IMP1_FILE 期望8"
[ "$IMP1_OK" = "8" ] && pass "成功导入=8" || fail "成功导入=$IMP1_OK 期望8"
[ "$IMP1_DUP" = "0" ] && pass "重复数=0" || fail "重复数=$IMP1_DUP 期望0"

# 查询总条数
SENSORS_AFTER1=$(curl -s "$BASE/sensors?pageSize=100" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['total'])" 2>/dev/null)
[ "$SENSORS_AFTER1" = "8" ] && pass "导入后传感器总数=8" || fail "总数=$SENSORS_AFTER1 期望8"

ZONES_AFTER1=$(curl -s "$BASE/safety-zones?pageSize=100" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['total'])" 2>/dev/null)
[ "$ZONES_AFTER1" = "8" ] && pass "导入后安全区总数=8" || fail "安全区=$ZONES_AFTER1 期望8"

# ---- Step 2: 重复导入 batch-2 (4条, 含2条重复) ----
section "Step 2: 重复导入 sample-batch-2-repeat.csv (4条, 其中2条重复)"
BATCH2_ID="BATCH-TEST-$(date +%s)-002"
IMPORT2=$(curl -s -X POST "$BASE/sensors/import" \
  -F "batchId=$BATCH2_ID" \
  -F "file=@sample-batch-2-repeat.csv;type=text/csv" 2>/dev/null)
echo "$IMPORT2"
IMP2_FILE=$(echo "$IMPORT2" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['totalInFile'])" 2>/dev/null)
IMP2_OK=$(echo "$IMPORT2" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['imported'])" 2>/dev/null)
IMP2_DUP=$(echo "$IMPORT2" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['duplicates'])" 2>/dev/null)

[ "$IMP2_FILE" = "4" ] && pass "文件总数=4" || fail "文件总数=$IMP2_FILE 期望4"
[ "$IMP2_OK" = "2" ] && pass "成功导入=2（新增的009和010）" || fail "成功导入=$IMP2_OK 期望2"
[ "$IMP2_DUP" = "2" ] && pass "重复数=2（001和002被去重）" || fail "重复数=$IMP2_DUP 期望2"

# 关键验证：总数不翻倍 = 8 + 2 = 10
SENSORS_AFTER2=$(curl -s "$BASE/sensors?pageSize=100" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['total'])" 2>/dev/null)
[ "$SENSORS_AFTER2" = "10" ] && pass "重复导入后总数=10（不翻倍！8+2=10）" || fail "总数=$SENSORS_AFTER2 期望10（关键：不翻倍）"

ZONES_AFTER2=$(curl -s "$BASE/safety-zones?pageSize=100" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['total'])" 2>/dev/null)
[ "$ZONES_AFTER2" = "10" ] && pass "安全区总数=10（同步，不翻倍）" || fail "安全区=$ZONES_AFTER2 期望10"

# ---- Step 3: 林老师修改一条备注（SEN-2026-003 钛合金）----
section "Step 3: 实验老师林老师只改了一条备注（SEN-2026-003 钛合金）"
SENSOR3_ID=$(curl -s "$BASE/sensors?pageSize=100" | python3 -c "
import sys,json
d=json.load(sys.stdin)
for s in d['data']['list']:
    if s['sensor_code']=='SEN-2026-003':
        print(s['id'])" 2>/dev/null)
echo "  SEN-2026-003 ID: $SENSOR3_ID"

OLD_REMARK="照片待补"
NEW_REMARK="照片补看完成：温度偏高2℃，物料有轻微结块，建议降速5%"
REMARK_REASON="林老师补看工况照片发现钛合金批次温度异常"
REMARK_UPDATE=$(curl -s -X PUT "$BASE/sensors/$SENSOR3_ID/remark" \
  -H "Content-Type: application/json" \
  -d "{\"remark\":\"$NEW_REMARK\",\"reason\":\"$REMARK_REASON\",\"operator\":\"林老师\"}" 2>/dev/null)
echo "$REMARK_UPDATE" | grep -q "success.*true" && pass "备注修改接口成功" || fail "备注修改失败"

# 验证改后值
UPDATED_REMARK=$(curl -s "$BASE/sensors?pageSize=100" | python3 -c "
import sys,json
d=json.load(sys.stdin)
for s in d['data']['list']:
    if s['sensor_code']=='SEN-2026-003':
        print(s['remark'])" 2>/dev/null)
[ "$UPDATED_REMARK" = "$NEW_REMARK" ] && pass "数据库中备注已更新为新值" || fail "备注值不对: $UPDATED_REMARK"

# 验证历史记录中有改前改后
HISTORY=$(curl -s "$BASE/history?pageSize=50" | python3 -c "
import sys,json
d=json.load(sys.stdin)
for r in d['data']['list']:
    if r['field']=='remark' and r['target_id']=='$SENSOR3_ID':
        print(r['old_value']+'|||'+r['new_value']+'|||'+str(r['reason'])+'|||'+r['operator'])
        break" 2>/dev/null)
HIST_OLD=$(echo "$HISTORY" | cut -d'|' -f1)
HIST_NEW=$(echo "$HISTORY" | cut -d'|' -f4)
HIST_REASON=$(echo "$HISTORY" | cut -d'|' -f7)
HIST_OP=$(echo "$HISTORY" | cut -d'|' -f10)

[ "$HIST_OLD" = "$OLD_REMARK" ] && pass "历史改前文本='$OLD_REMARK'" || fail "改前不对: $HIST_OLD"
[ "$HIST_NEW" = "$NEW_REMARK" ] && pass "历史改后文本='$NEW_REMARK'" || fail "改后不对: $HIST_NEW"
[ "$HIST_REASON" = "$REMARK_REASON" ] && pass "修改原因记录正确" || fail "原因不对: $HIST_REASON"
[ "$HIST_OP" = "林老师" ] && pass "操作人=林老师" || fail "操作人不对: $HIST_OP"

# ---- Step 4: 设备工程师改系数，故意不写原因 → 标记待复核 ----
section "Step 4: 设备工程师改 SEN-2026-005 系数 (不写原因→待复核)"
SENSOR5_ID=$(curl -s "$BASE/sensors?pageSize=100" | python3 -c "
import sys,json
d=json.load(sys.stdin)
for s in d['data']['list']:
    if s['sensor_code']=='SEN-2026-005':
        print(s['id'])" 2>/dev/null)

OLD_COEF="1.25"
NEW_COEF="1.40"
# 第一次修改：不写原因
COEF_UPDATE=$(curl -s -X PUT "$BASE/sensors/$SENSOR5_ID/coefficient" \
  -H "Content-Type: application/json" \
  -d "{\"coefficient\":$NEW_COEF,\"reason\":\"\",\"operator\":\"设备工程师\"}" 2>/dev/null)
echo "$COEF_UPDATE" | grep -q "success.*true" && pass "系数修改接口成功（无原因）" || fail "系数修改失败"

# 验证安全区为待复核
PENDING_COUNT=$(curl -s "$BASE/safety-zones/stats" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['pendingReview'])" 2>/dev/null)
[ "$PENDING_COUNT" = "1" ] && pass "待复核数量=1（系数无原因被标记）" || fail "待复核=$PENDING_COUNT 期望1"

UPDATED_COEF=$(curl -s "$BASE/sensors?pageSize=100" | python3 -c "
import sys,json
d=json.load(sys.stdin)
for s in d['data']['list']:
    if s['sensor_code']=='SEN-2026-005':
        print(str(s['coefficient'])+'|||'+str(s['coefficient_manual']))" 2>/dev/null)
COEF_VAL=$(echo "$UPDATED_COEF" | cut -d'|' -f1)
COEF_MANUAL=$(echo "$UPDATED_COEF" | cut -d'|' -f4)
[ "$COEF_VAL" = "1.4" ] && pass "传感器系数已更新为1.40" || fail "系数=$COEF_VAL 期望1.4"
[ "$COEF_MANUAL" = "1" ] && pass "coefficient_manual=1（标记为人工修改）" || fail "manual=$COEF_MANUAL 期望1"

# ---- Step 5: 回滚系数修改 ----
section "Step 5: 回滚系数修改（验证联动恢复）"
# 找到系数变更的历史记录
COEF_HIST_ID=$(curl -s "$BASE/history?pageSize=50&targetType=sensor" | python3 -c "
import sys,json
d=json.load(sys.stdin)
for r in d['data']['list']:
    if r['field']=='coefficient' and r['target_id']=='$SENSOR5_ID':
        print(r['id'])
        break" 2>/dev/null)
echo "  系数变更历史ID: $COEF_HIST_ID"

ROLLBACK=$(curl -s -X POST "$BASE/history/$COEF_HIST_ID/rollback" \
  -H "Content-Type: application/json" \
  -d '{"operator":"设备负责人","reason":"回滚测试：误操作，系数改太大了"}' 2>/dev/null)
echo "$ROLLBACK" | grep -q "success.*true" && pass "回滚接口成功" || fail "回滚失败"

# 验证：传感器系数已恢复
ROLLED_COEF=$(curl -s "$BASE/sensors?pageSize=100" | python3 -c "
import sys,json
d=json.load(sys.stdin)
for s in d['data']['list']:
    if s['sensor_code']=='SEN-2026-005':
        print(str(s['coefficient'])+'|||'+str(s['coefficient_manual']))" 2>/dev/null)
R_COEF=$(echo "$ROLLED_COEF" | cut -d'|' -f1)
R_MANUAL=$(echo "$ROLLED_COEF" | cut -d'|' -f4)
[ "$R_COEF" = "$OLD_COEF" ] && pass "回滚后传感器系数恢复为 $OLD_COEF" || fail "回滚后系数=$R_COEF 期望$OLD_COEF"
[ "$R_MANUAL" = "0" ] && pass "回滚后 coefficient_manual 恢复为 0" || fail "回滚后manual=$R_MANUAL 期望0"

# 验证：安全区系数也同步恢复
ZONE5_COEF=$(curl -s "$BASE/safety-zones?pageSize=100" | python3 -c "
import sys,json
d=json.load(sys.stdin)
for z in d['data']['list']:
    if z.get('sensor_code')=='SEN-2026-005':
        print(str(z['coefficient'])+'|||'+z['coefficient_source']+'|||'+z['review_status'])
        break
" 2>/dev/null)
Z5_COEF=$(echo "$ZONE5_COEF" | cut -d'|' -f1)
Z5_SOURCE=$(echo "$ZONE5_COEF" | cut -d'|' -f4)
Z5_STATUS=$(echo "$ZONE5_COEF" | cut -d'|' -f7)
[ "$Z5_COEF" = "$OLD_COEF" ] && pass "回滚后安全区系数联动恢复=$OLD_COEF" || fail "安全区系数=$Z5_COEF 期望$OLD_COEF（联动关键！）"
[ "$Z5_SOURCE" = "auto" ] && pass "安全区系数来源恢复=auto" || fail "来源=$Z5_SOURCE"

# 待复核数量应归零
PENDING_AFTER=$(curl -s "$BASE/safety-zones/stats" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['pendingReview'])" 2>/dev/null)
[ "$PENDING_AFTER" = "0" ] && pass "回滚后待复核=0（同步恢复）" || fail "回滚后待复核=$PENDING_AFTER 期望0"

# ---- Step 6: 正确填写原因的系数修改 ----
section "Step 6: 正确填写原因后修改系数 → 直接通过，不标记待复核"
COEF_UPDATE2=$(curl -s -X PUT "$BASE/sensors/$SENSOR5_ID/coefficient" \
  -H "Content-Type: application/json" \
  -d '{"coefficient":1.32,"reason":"工况照片确认碳化钨批次磨损加快，适当提高安全系数","operator":"林老师"}' 2>/dev/null)
echo "$COEF_UPDATE2" | grep -q "success.*true" && pass "带原因的系数修改成功" || fail "修改失败"

PENDING3=$(curl -s "$BASE/safety-zones/stats" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['pendingReview'])" 2>/dev/null)
[ "$PENDING3" = "0" ] && pass "有原因修改→待复核仍为0（直接通过）" || fail "有原因也待复核?=$PENDING3"

# ---- Step 7: 批次下拉列表中能看到2个批次 ----
section "Step 7: 批次列表验证"
BATCHES=$(curl -s "$BASE/sensors/batches?pageSize=10" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['total'])" 2>/dev/null)
[ "$BATCHES" = "2" ] && pass "批次列表总数=2（2次导入）" || fail "批次=$BATCHES 期望2"

# 汇总
echo ""
echo "================================================================"
echo -e "验证结果：${GREEN}通过 $PASS${NC} / ${RED}失败 $FAIL${NC} / 总计 $((PASS+FAIL))"
echo "================================================================"
[ $FAIL -eq 0 ] && echo -e "${GREEN}🎉 全链路验证通过！${NC}" || echo -e "${RED}⚠️  有失败项${NC}"
exit $FAIL
