#!/bin/bash
# ================================================================
# 离心机转速安全区 - 单条样例记录（SEN-2026-005 碳化钨）全链路端到端验证
# 目标：导入→补照片→改备注→改系数→复核→回滚→历史→导出
#       所有环节都指向同一条 SEN-2026-005，禁止出现"ID"、"未知物料"
# ================================================================
set -e
BASE="http://localhost:3001/api"
T="SEN-2026-005"
MPHOTO="/tmp/sample-photo-sen005.jpg"
RED='\033[0;31m';GRN='\033[0;32m';YEL='\033[1;33m';NC='\033[0m'
P=0;F=0

pass() { ((P++)); echo -e "  ${GRN}[PASS]${NC} $1"; }
fail() { ((F++)); echo -e "  ${RED}[FAIL]${NC} $1"; }
sec()  { echo -e "\n${YEL}▓ $1 ▓${NC}"; }
hr()   { echo "---------------------------------------------------------------"; }

# 生成一张假的样例照片（最小合法 JPEG）
create_test_image() {
  python3 - <<'PY' >"$MPHOTO"
import struct, sys, zlib, base64
# 1x1 纯灰 JPEG: FF D8 / SOF0 / SOS / 最小数据 / FF D9
# 直接写入字节序列避免 base64 错误
header = bytes.fromhex(
  'ffd8ffe000104a46494600010100000100010000ffdb00430008060607060508070707'
  '0909080a0c140d0c0b0b0c1912130f141d1a1f1e1d1a1c1c20242e2720222c231c1c28'
  '37292c30313434341f27393d38323c2e333432ffc0000b080001000101011100ffc400'
  '1400010000000000000000000000000000000000ffc400141001000000000000000000'
  '0000000000000000ffda0008010100003f00d2cf20ffd9'
)
sys.stdout.buffer.write(header)
PY
}

# 断言两个 JSON 字段值相等
assert_json_eq() {
  local actual="$1" expected="$2" msg="$3"
  [ "$actual" = "$expected" ] && pass "$msg ($actual)" || fail "$msg: 期望='$expected' 实际='$actual'"
}

# ================================================================
sec "环节 0：环境重置 + 健康检查"
# ================================================================
HR=$(curl -sf "$BASE/safety-zones/stats" 2>/dev/null)
[ -n "$HR" ] && pass "API 健康检查通过" || fail "API 无响应"; hr
create_test_image

# ================================================================
sec "环节 1：导入样例 CSV —— 建立 SEN-2026-005 碳化钨主记录"
# ================================================================
B1="BATCH-E2E-$(date +%s)-001"
R1=$(curl -s -X POST "$BASE/sensors/import" \
  -F "batchId=$B1" \
  -F "file=@sample-batch-1.csv;type=text/csv" 2>/dev/null)
echo "$R1" | python3 -c "
import sys,json
d=json.load(sys.stdin)['data']
assert d['totalInFile']==8, f'file={d[\"totalInFile\"]}'
assert d['imported']==8, f'imported={d[\"imported\"]}'
" && pass "批量导入 batch-1：8条成功入库" || fail "导入失败: $R1"

# 找到 SEN-2026-005 的 sensor_id
SID=$(curl -sf "$BASE/sensors?pageSize=100" | python3 -c "
import sys,json
d=json.load(sys.stdin)['data']['list']
for s in d:
  if s['sensor_code']=='$T':
    print(s['id']); break
")
ZID=$(curl -sf "$BASE/safety-zones?pageSize=100" | python3 -c "
import sys,json
d=json.load(sys.stdin)['data']['list']
for z in d:
  if z.get('sensor_code')=='$T':
    print(z['id']); break
")
[ -n "$SID" ] && pass "SEN-2026-005 sensor_id 已找到: ${SID:0:16}..." || fail "找不到 SEN-2026-005"
[ -n "$ZID" ] && pass "SEN-2026-005 safety_zone_id 已找到: ${ZID:0:16}..." || fail "找不到安全区记录"

# 核对平铺字段（正是本次修复的关键！）
SZ_FLAT=$(curl -sf "$BASE/safety-zones?pageSize=100" | python3 -c "
import sys,json
d=json.load(sys.stdin)['data']['list']
for z in d:
  if z.get('sensor_code')=='$T':
    print(z.get('sensor_code','NONE')+'|||'+z.get('material_type','NONE')+'|||'+str(z.get('remark','NONE'))+'|||'+z.get('batch_id','NONE'))
    break
")
CODE=$(echo "$SZ_FLAT"|cut -d'|' -f1)
MAT=$(echo "$SZ_FLAT"|cut -d'|' -f4)
REM=$(echo "$SZ_FLAT"|cut -d'|' -f7)
BID=$(echo "$SZ_FLAT"|cut -d'|' -f10)
assert_json_eq "$CODE" "$T"      "★ 复核页 sensor_code 平铺字段≠ID"
assert_json_eq "$MAT"  "碳化钨"   "★ 复核页 material_type 平铺字段≠未知物料"
assert_json_eq "$REM"  "林老师关注重点批次" "导入初始 remark 正确"
[ -n "$BID" ] && [ "$BID" != "NONE" ] && pass "平铺 batch_id 字段有值" || fail "batch_id 缺失"
hr

# ================================================================
sec "环节 2：补录工况照片 —— SEN-2026-005"
# ================================================================
UP=$(curl -s -X POST "$BASE/photos/upload" \
  -F "sensorId=$SID" \
  -F "file=@$MPHOTO;type=image/jpeg" \
  -F "remark=碳化钨温度偏高3℃ 工况照片 2026-06-19 林老师补录" 2>/dev/null)
echo "$UP" | grep -q '"success":true' \
  && pass "SEN-2026-005 工况照片上传成功" || fail "照片上传失败: $UP"

PCNT=$(curl -sf "$BASE/photos/$SID" | python3 -c "import sys,json; print(len(json.load(sys.stdin)['data']))")
assert_json_eq "$PCNT" "1" "照片数量=1"

PREMARK=$(curl -sf "$BASE/photos/$SID" | python3 -c "import sys,json; print(json.load(sys.stdin)['data'][0].get('remark',''))")
assert_json_eq "$PREMARK" "碳化钨温度偏高3℃ 工况照片 2026-06-19 林老师补录" "照片 remark 完整保存"
hr

# ================================================================
sec "环节 3：保存备注 + 修改原因 —— 林老师只改了 1 条 SEN-2026-005"
# ================================================================
OLD_REMARK="林老师关注重点批次"
NEW_REMARK="补看照片确认：碳化钨批次实际温度比铭牌高3℃，有轻微磨损痕迹，建议系数上调"
REMARK_REASON="林老师 2026-06-19 复核工况照片后追加备注（只改了这1条）"

RM=$(curl -s -X PUT "$BASE/sensors/$SID/remark" \
  -H "Content-Type: application/json" \
  -d "{\"remark\":\"$NEW_REMARK\",\"reason\":\"$REMARK_REASON\",\"operator\":\"实验老师林老师\"}" 2>/dev/null)
echo "$RM" | grep -q '"success":true' && pass "备注修改接口成功" || fail "备注修改失败: $RM"

# 验证改后值
CUR_REMARK=$(curl -sf "$BASE/sensors?pageSize=100" | python3 -c "
import sys,json
d=json.load(sys.stdin)['data']['list']
for s in d:
  if s['sensor_code']=='$T': print(s['remark']); break
")
assert_json_eq "$CUR_REMARK" "$NEW_REMARK" "SEN-2026-005 备注文本已更新"

# 验证历史记录 改前→改后→原因→操作人 全部正确
HR=$(curl -sf "$BASE/history?pageSize=50&target_type=sensor" | python3 -c "
import sys,json
d=json.load(sys.stdin)['data']['list']
for r in d:
  if r['target_id']=='$SID' and r['field']=='remark':
    print(r['old_value']+'|||'+r['new_value']+'|||'+str(r.get('reason',''))+'|||'+r['operator'])
    break
")
HO=$(echo "$HR"|cut -d'|' -f1)
HN=$(echo "$HR"|cut -d'|' -f4)
HR_REASON=$(echo "$HR"|cut -d'|' -f7)
HR_OP=$(echo "$HR"|cut -d'|' -f10)
assert_json_eq "$HO" "$OLD_REMARK"    "★ 历史改前文本正确"
assert_json_eq "$HN" "$NEW_REMARK"    "★ 历史改后文本正确"
assert_json_eq "$HR_REASON" "$REMARK_REASON" "★ 修改原因留痕正确"
assert_json_eq "$HR_OP" "实验老师林老师"    "★ 操作人留痕正确"

# 确认只有 1 条 remark 变更（林老师只改了1条）
RCNT=$(curl -sf "$BASE/history?pageSize=50&target_type=sensor" | python3 -c "
import sys,json
d=json.load(sys.stdin)['data']['list']
c=sum(1 for r in d if r['field']=='remark')
print(c)
")
assert_json_eq "$RCNT" "1" "★ 只有 1 条 remark 变更记录 —— 对应『林老师只改了1条』"
hr

# ================================================================
sec "环节 4：修改安全系数不写原因 —— 自动标记待复核"
# ================================================================
OLD_COEF="1.25"
NEW_COEF_NO_REASON="1.45"
CF=$(curl -s -X PUT "$BASE/sensors/$SID/coefficient" \
  -H "Content-Type: application/json" \
  -d "{\"coefficient\":$NEW_COEF_NO_REASON,\"reason\":\"\",\"operator\":\"设备工程师临时调整\"}" 2>/dev/null)
echo "$CF" | grep -q '"success":true' && pass "无原因改系数接口成功" || fail "改系数失败: $CF"

# 复核列表 + 平铺字段核对（禁止 ID / 未知物料）
RV=$(curl -sf "$BASE/safety-zones?pageSize=100&review_status=pending" | python3 -c "
import sys,json
d=json.load(sys.stdin)['data']['list']
for z in d:
  if z.get('sensor_code')=='$T':
    print(z.get('sensor_code','MISS')+'|||'+z.get('material_type','MISS')+'|||'+str(z.get('coefficient',''))+'|||'+z.get('coefficient_source','')+'|||'+z.get('review_status',''))
    break
else:
    print('NOT_FOUND')
")
R_CODE=$(echo "$RV"|cut -d'|' -f1)
R_MAT=$(echo "$RV"|cut -d'|' -f4)
R_COEF=$(echo "$RV"|cut -d'|' -f7)
R_SRC=$(echo "$RV"|cut -d'|' -f10)
R_ST=$(echo "$RV"|cut -d'|' -f13)
[ "$R_CODE" != "NOT_FOUND" ] && pass "待复核列表中找到 SEN-2026-005" || fail "未出现在待复核列表"
assert_json_eq "$R_CODE" "$T"        "★ 待复核列表显示 sensor_code=$T（非ID）"
assert_json_eq "$R_MAT"  "碳化钨"     "★ 待复核列表显示 material_type=碳化钨（非未知物料）"
assert_json_eq "$R_COEF" "$NEW_COEF_NO_REASON" "待复核列表系数=1.45"
assert_json_eq "$R_SRC"  "manual"     "待复核列表来源=manual"
assert_json_eq "$R_ST"   "pending"    "待复核列表状态=pending"

# 统计检查
PEND=$(curl -sf "$BASE/safety-zones/stats" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['pendingReview'])")
assert_json_eq "$PEND" "1" "★ stats 待复核数量=1（只有 SEN-005）"
hr

# ================================================================
sec "环节 5：复核操作（通过）—— 核对改前改后 + 复核意见留存"
# ================================================================
RV_OPINION="经复核，确认照片与林老师备注一致，温度偏高属实，通过系数上调至 1.45"
RV1=$(curl -s -X POST "$BASE/safety-zones/$ZID/review" \
  -H "Content-Type: application/json" \
  -d "{\"action\":\"approve\",\"comment\":\"$RV_OPINION\",\"reviewer\":\"设备张工\"}" 2>/dev/null)
echo "$RV1" | grep -q '"success":true' && pass "复核通过接口成功" || fail "复核失败: $RV1"

# 状态+意见核对
RV2=$(curl -sf "$BASE/safety-zones/$ZID" | python3 -c "
import sys,json; z=json.load(sys.stdin)['data']
print(z.get('review_status','')+'|||'+z.get('review_comment','')+'|||'+z.get('reviewer','')+'|||'+z.get('sensor_code',''))
")
RV2_ST=$(echo "$RV2"|cut -d'|' -f1)
RV2_CM=$(echo "$RV2"|cut -d'|' -f4)
RV2_RV=$(echo "$RV2"|cut -d'|' -f7)
RV2_SC=$(echo "$RV2"|cut -d'|' -f10)
assert_json_eq "$RV2_ST" "approved"         "复核后状态=approved"
assert_json_eq "$RV2_CM" "$RV_OPINION"      "复核意见完整保存"
assert_json_eq "$RV2_RV" "设备张工"          "复核人记录正确"
assert_json_eq "$RV2_SC" "$T"                "详情 sensor_code=$T（非ID）"

# 历史记录新增 review_status 变更
RV_HIST=$(curl -sf "$BASE/history?pageSize=50&target_type=safety_zone" | python3 -c "
import sys,json
d=json.load(sys.stdin)['data']['list']
for r in d:
  if r['target_id']=='$ZID' and r['field']=='review_status':
    print(r['old_value']+'→'+r['new_value']+'|||'+r['operator'])
    break
else:
    print('MISSING')
")
assert_json_eq "$RV_HIST" "pending→approved|||设备张工" "★ 复核变更记录 pending→approved + 操作人"
hr

# ================================================================
sec "环节 6：回滚 —— 关联明细 + 报告 + 统计状态 全部恢复"
# ================================================================
# 找到 coefficient 变更历史记录 id
CH_ID=$(curl -sf "$BASE/history?pageSize=50&target_type=sensor" | python3 -c "
import sys,json
d=json.load(sys.stdin)['data']['list']
for r in d:
  if r['target_id']=='$SID' and r['field']=='coefficient':
    print(r['id']); break
")
[ -n "$CH_ID" ] && pass "找到 coefficient 历史记录 id=${CH_ID:0:16}..." || fail "找不到 coefficient 历史"

RB=$(curl -s -X POST "$BASE/history/$CH_ID/rollback" \
  -H "Content-Type: application/json" \
  -d '{"operator":"设备负责人","reason":"误操作：调整幅度过大，需重新评估后再改"}' 2>/dev/null)
echo "$RB" | grep -q '"success":true' && pass "回滚接口成功" || fail "回滚失败: $RB"

# ★ 联动核对：sensor_data + safety_zone + stats 三张表/接口同时恢复
RBS=$(curl -sf "$BASE/sensors?pageSize=100" | python3 -c "
import sys,json
d=json.load(sys.stdin)['data']['list']
for s in d:
  if s['sensor_code']=='$T':
    print(str(s['coefficient'])+'|||'+str(s['coefficient_manual'])); break
")
RBZ=$(curl -sf "$BASE/safety-zones/$ZID" | python3 -c "
import sys,json; z=json.load(sys.stdin)['data']
print(str(z.get('coefficient',''))+'|||'+z.get('coefficient_source','')+'|||'+z.get('review_status','')+'|||'+str(z.get('version',0)))
")
RBP=$(curl -sf "$BASE/safety-zones/stats" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['pendingReview'])")

RB_S_COEF=$(echo "$RBS"|cut -d'|' -f1)
RB_S_MAN=$(echo "$RBS"|cut -d'|' -f4)
RB_Z_COEF=$(echo "$RBZ"|cut -d'|' -f1)
RB_Z_SRC=$(echo "$RBZ"|cut -d'|' -f4)
RB_Z_ST=$(echo "$RBZ"|cut -d'|' -f7)
RB_Z_V=$(echo "$RBZ"|cut -d'|' -f10)

assert_json_eq "$RB_S_COEF" "$OLD_COEF" "★ sensor_data.coefficient 恢复=$OLD_COEF"
assert_json_eq "$RB_S_MAN"  "0"        "★ sensor_data.coefficient_manual 恢复=0"
assert_json_eq "$RB_Z_COEF" "$OLD_COEF" "★ safety_zone.coefficient 联动恢复=$OLD_COEF"
assert_json_eq "$RB_Z_SRC"  "auto"      "★ safety_zone.coefficient_source 联动恢复=auto"
assert_json_eq "$RBP"       "0"         "★ stats.pendingReview 恢复=0（报告同步）"
[ "$RB_Z_V" != "1" ] && pass "★ safety_zone.version 自增=$RB_Z_V（回滚留痕）" || fail "version 未自增"
hr

# ================================================================
sec "环节 7：历史记录 —— 改前/改后/原因/操作人 全部可追溯"
# ================================================================
ALL=$(curl -sf "$BASE/history?pageSize=100" | python3 -c "
import sys,json
d=json.load(sys.stdin)['data']['list']
# 只看 SEN-2026-005 相关
sids={'$SID','$ZID'}
cnt=0; msg=[]
for r in d:
    if r['target_id'] in sids:
        cnt+=1
        msg.append(f\"{r['target_type'][:3]}.{r['field']}: {r['old_value']}→{r['new_value']} by {r['operator']}\")
print(cnt)
for m in msg: print('ITEM|'+m)
")
ALLCNT=$(echo "$ALL"|head -1)
echo "  SEN-2026-005 相关变更总览:"
echo "$ALL" | grep '^ITEM|' | while IFS='|' read -r _ line; do echo "    · $line"; done
[ "$ALLCNT" -ge 7 ] && pass "★ 历史记录 ≥7 条（remark+系数+review+rollback+关联同步）" || fail "历史记录偏少：$ALLCNT 条"
hr

# ================================================================
sec "环节 8：导出报告（Shell 脚本）—— 内容含 SEN-2026-005"
# ================================================================
SH=$(curl -sf "$BASE/history/export?format=shell&target_type=sensor" 2>/dev/null)
echo "$SH" | grep -q "SEN-2026-005" && pass "★ Shell 导出报告含关键词 SEN-2026-005" || fail "导出不含目标记录"
echo "$SH" | grep -q "碳化钨"           && pass "★ Shell 导出报告含物料类型 碳化钨" || fail "导出不含物料"
echo "$SH" | grep -q "$REMARK_REASON"   && pass "★ Shell 导出含林老师备注修改原因" || fail "导出不含备注原因"
echo "$SH" | grep -q "curl"             && pass "导出内容含可执行 curl 命令"     || fail "导出不是shell"
hr

# ================================================================
# 最终汇总
# ================================================================
TOTAL=$((P+F))
echo ""
echo "================================================================"
echo -e "    📌  全链路（SEN-2026-005 碳化钨）单条样例记录验证报告"
echo "================================================================"
echo -e "    环节覆盖：导入→补照片→改备注→改系数→复核→回滚→历史→导出"
echo -e "    断言通过：${GRN}$P${NC} / $TOTAL  ${RED}$F${NC} 项失败"
echo "================================================================"
[ $F -eq 0 ] && echo -e "    ${GRN}✅ 全部通过 —— 待复核项均显示正确编号与物料，禁止出现 ID/未知物料${NC}" \
              || echo -e "    ${RED}❌ 有失败项，需核查${NC}"
echo "================================================================"
rm -f "$MPHOTO"
exit $F
