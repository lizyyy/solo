#!/usr/bin/env bash
# ============================================================
# README 新人路径完整可复现验证脚本
# 用途：按 README 三步流程执行，并对每一步做断言
# 用法：bash scripts/verify-readme-path.sh
# ============================================================
set -e
cd "$(dirname "$0")/.."

LOG_DIR="data/verification-logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/$(date +%Y%m%d_%H%M%S)_run.log"
STATE_FILE="data/app-state.json"
ASSERT_OK=0
ASSERT_FAIL=0

log()   { echo "[$(date +%H:%M:%S)] $*" | tee -a "$LOG_FILE"; }
ok()    { log "✅ 断言通过: $*"; ASSERT_OK=$((ASSERT_OK+1)); }
fail()  { log "❌ 断言失败: $*"; ASSERT_FAIL=$((ASSERT_FAIL+1)); }
run()   {
  local label="$1"; shift
  local step_log="$LOG_DIR/step_${label}.log"
  log "===== STEP: $label ====="
  log "CMD: $*"
  echo "--- begin output ---" >> "$LOG_FILE"
  if "$@" >> "$LOG_FILE" 2>&1; then
    ec=0
  else
    ec=$?
  fi
  echo "--- end output (exit=$ec) ---" >> "$LOG_FILE"
  cp "$LOG_FILE" "$step_log" 2>/dev/null || true
  return $ec
}

contains() { grep -q "$1" "$LOG_FILE"; }

# ============ 0. 重置 ============
log "开始验证 README 新人路径"
log "日志文件: $LOG_FILE"
log ""
rm -f "$STATE_FILE" final-report.html final-report.txt

# ============ 1. 错误写法复现（证明确实有问题） ============
log "▌预演：复现 README 旧写法的问题（不加 --）"
set +e
run "wrong_ta_review_no_doubledash" npx ts-node src/cli/index.ts ta-review SAMPLE-001
set -e
if contains "required option '-v, --verified"; then
  ok "不加 -- 时，输出确实是 'required option -v --verified not specified'（新人看到的\"终端评估\"）"
else
  fail "不加 -- 时未复现参数丢失问题"
fi
log ""

# ============ 2. Step 1: import ============
run "1_import" npx ts-node src/cli/index.ts import \
  -m ./data/manualCounterExamples.json -q ./data/questionnaireRows.json
contains "检测到 3 个负数样本" && ok "import: 检测到3个负数样本" || fail "import: 未检测到3个负数样本"
contains "创建/更新 3 个边界样本" && ok "import: 创建3个边界样本" || fail "import: 未创建边界样本"
contains "SAMPLE-001" && ok "import: 包含 SAMPLE-001" || fail "import: 缺少 SAMPLE-001"
contains "待学生助教复核" && ok "import: 初始状态为待学生助教" || fail "import: 初始状态不对"
log ""

# ============ 3. 故意触发错误：样本不存在 ============
set +e
run "err_sample_not_found" npx ts-node src/cli/index.ts ta-review SAMPLE-999 -v true -n "测试"
set -e
contains "样本「SAMPLE-999」不存在" && ok "样本不存在错误: 包含明确提示" || fail "样本不存在错误: 无提示"
contains "当前总样本数" && ok "样本不存在错误: 包含当前总样本数" || fail "样本不存在错误: 不含总样本数"
log ""

# ============ 4. 故意触发错误：状态不允许（直接唐老师） ============
set +e
run "err_status_not_allow" npx ts-node src/cli/index.ts coach-review SAMPLE-001 -v true -n "测试"
set -e
contains "不允许唐老师复核" && ok "状态不允许错误: 明确说明不允许唐老师" || fail "状态不允许错误: 未说明"
contains "待学生助教复核" && ok "状态不允许错误: 说明当前是待助教" || fail "状态不允许错误: 未说明当前状态"
log ""

# ============ 5. Step 2: 助教补录 SAMPLE-001 ============
run "2_ta_review_001" npx ts-node src/cli/index.ts ta-review SAMPLE-001 \
  -v true \
  -n "README验证-已核实：窗口1在10:20-10:40临时关闭，实际等待15分钟，问卷已补录" \
  -q ./data/questionnaireRows.json
contains "已加载补充问卷原始行" && ok "助教复核: 已加载问卷" || fail "助教复核: 未加载问卷"
contains "待竞赛教练唐老师复核" && ok "助教复核: 状态变为待唐老师" || fail "助教复核: 状态未变"
contains "缺项数: 0" && ok "助教复核: 缺项数降为0" || fail "助教复核: 缺项数未降"
log ""

# ============ 6. Step 2: 助教补录 SAMPLE-002 ============
run "2_ta_review_002" npx ts-node src/cli/index.ts ta-review SAMPLE-002 \
  -v true \
  -n "README验证-已核实：下午2点窗口2排队溢出，实际到达25人、等待25分钟" \
  -q ./data/questionnaireRows.json
contains "待竞赛教练唐老师复核" && ok "助教复核SAMPLE-002: 状态变为待唐老师" || fail "助教复核SAMPLE-002: 未变状态"
log ""

# ============ 7. Step 3: 唐老师复核 SAMPLE-001 ============
run "3_coach_review_001" npx ts-node src/cli/index.ts coach-review SAMPLE-001 \
  -v true \
  -n "README验证-唐老师确认：临时关窗影响核实，建议该时段预留1个机动窗口"
contains "唐老师已确认" && ok "唐老师复核001: 状态变为已确认" || fail "唐老师复核001: 状态未变"
contains "最终等待时间: 15分钟" && ok "唐老师复核001: 最终等待15分钟" || fail "唐老师复核001: 无最终等待时间"
contains "最终到达人数: 15人" && ok "唐老师复核001: 最终到达15人" || fail "唐老师复核001: 无最终到达人数"
contains "竞赛教练唐老师（用于窗口排班优化）" && ok "唐老师复核001: 后续联系人正确" || fail "唐老师复核001: 后续联系人不对"
log ""

# ============ 8. Step 3: 唐老师复核 SAMPLE-002 ============
run "3_coach_review_002" npx ts-node src/cli/index.ts coach-review SAMPLE-002 \
  -v true \
  -n "README验证-唐老师确认：排队溢出属实，建议下午2点时段增至3窗口"
contains "唐老师已确认" && ok "唐老师复核002: 状态变为已确认" || fail "唐老师复核002: 状态未变"
log ""

# ============ 9. 刷新数据 & 重算（reset 之后 import 证明持久性，这里 list 看历史留存） ============
run "4_list_after_review" npx ts-node src/cli/index.ts list
contains "唐老师已确认" && ok "list刷新后: 能看到已确认样本" || fail "list刷新后: 看不到已确认样本"
log ""

# ============ 10. 历史记录 ============
run "5_history" npx ts-node src/cli/index.ts history SAMPLE-001
contains "旧表系统" && ok "历史001: 包含旧表系统创建" || fail "历史001: 无旧表系统"
contains "学生助教" && ok "历史001: 包含学生助教操作" || fail "历史001: 无助教操作"
contains "竞赛教练唐老师" && ok "历史001: 包含唐老师操作" || fail "历史001: 无唐老师操作"
log ""

# ============ 11. 报告（文本+导出） ============
run "6_report_terminal" npx ts-node src/cli/index.ts report
contains "原始负数" && ok "报告: 包含原始负数对比" || fail "报告: 无原始负数对比"
contains "最终处理结果" && ok "报告: 包含最终处理结果" || fail "报告: 无最终处理结果"
contains "复核历史记录" && ok "报告: 包含复核历史" || fail "报告: 无复核历史"
contains "README验证-唐老师确认" && ok "报告: 包含唐老师备注原文（同源）" || fail "报告: 无唐老师备注"
contains "同一份持久化状态" && ok "报告: 声明同源" || fail "报告: 无同源声明"
log ""

run "6_report_export_html" npx ts-node src/cli/index.ts report -o final-report.html -f html
run "6_report_export_txt" npx ts-node src/cli/index.ts report -o final-report.txt -f txt
[ -f final-report.html ] && ok "导出: HTML 文件存在" || fail "导出: HTML不存在"
[ -f final-report.txt ] && ok "导出: TXT 文件存在" || fail "导出: TXT不存在"
grep -q "原始负数" final-report.html && ok "HTML导出: 包含原始负数对比" || fail "HTML导出: 无原始负数"
grep -q "原始负数" final-report.txt && ok "TXT导出: 包含原始负数对比" || fail "TXT导出: 无原始负数"
log ""

# ============ 12. 最终 Node.js 脚本验证 ============
log "▌最终 Node.js 验证：确认同一条记录的所有字段同步"
run "7_node_assert" node -e "
const state = JSON.parse(require('fs').readFileSync('$STATE_FILE','utf8'));
const samples = state.boundarySamples;
console.log('state.version:', state.version);
console.log('boundarySamples count:', samples.length);
console.log('reviewHistory count:', state.reviewHistory.length);

// 定位 SAMPLE-001
const s001 = samples.find(b => b.data.sampleId === 'SAMPLE-001').data;
console.log('\\n=== SAMPLE-001 同一条记录核对 ===');
console.log('  sampleId:', s001.sampleId);
console.log('  status:', s001.status);
console.log('  originalNegativeValues.waitTime:', s001.originalNegativeValues?.waitTime);
console.log('  manualCounterExample.waitTime (修正后):', s001.manualCounterExample?.waitTime);
console.log('  questionnaireRow.actualWaitTime (问卷值):', s001.questionnaireRow?.actualWaitTime);
console.log('  taReviewNotes 包含 README:', s001.taReviewNotes?.includes('README验证'));
console.log('  coachReviewNotes 包含 README:', s001.coachReviewNotes?.includes('README验证'));
console.log('  reviewLog count:', s001.reviewLog?.length);
console.log('  dataResolution.finalWaitTime:', s001.dataResolution?.finalWaitTime);
console.log('  dataResolution.nextContactPerson:', s001.dataResolution?.nextContactPerson);
console.log('  dataResolution.resolvedBy:', s001.dataResolution?.resolvedBy);
console.log('  whyKept.includes(现场说法):', s001.whyKept?.includes('现场说法'));
console.log('  missingMaterials.length:', s001.missingMaterials?.length);

// 断言
const assert = (k, v) => { if (!v) { console.log('❌ FAIL:', k); process.exitCode = 1; } else { console.log('✅ OK:', k); } };
assert('status=coach_verified', s001.status === 'coach_verified');
assert('originalNegativeValues.waitTime=-5', s001.originalNegativeValues?.waitTime === -5);
assert('修正后 manualCounterExample.waitTime=15', s001.manualCounterExample?.waitTime === 15);
assert('问卷 actualWaitTime=15', s001.questionnaireRow?.actualWaitTime === 15);
assert('dataResolution.finalWaitTime=15', s001.dataResolution?.finalWaitTime === 15);
assert('reviewLog >= 3条', s001.reviewLog?.length >= 3);
assert('coach备注写入报告', s001.coachReviewNotes?.includes('README验证'));
assert('missingMaterials为空', (s001.missingMaterials?.length || 0) === 0);
assert('whyKept包含现场说法', s001.whyKept?.includes('现场说法'));
assert('nextContactPerson存在', !!s001.dataResolution?.nextContactPerson);
console.log('');
"
log ""

# ============ 总结 ============
log "============================================================"
log "验证完成"
log "  断言通过: $ASSERT_OK"
log "  断言失败: $ASSERT_FAIL"
log "  完整日志: $LOG_FILE"
log "  状态文件: $STATE_FILE"
log "  导出报告: final-report.html, final-report.txt"
log "============================================================"
[ "$ASSERT_FAIL" -eq 0 ] && log "🎉 全部断言通过！README 新人路径可用" || log "⚠️ 存在失败，请查看日志"

exit $ASSERT_FAIL
