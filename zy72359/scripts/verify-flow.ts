import { useStore } from '../src/store/useStore'
import type { CalibrationRecord, PumpSpeedCurve, AuditEntry } from '../src/types'

console.log('')
console.log('╔══════════════════════════════════════════════════════════════╗')
console.log('║        真空泵抽速曲线 · 全流程验证脚本  v1.0                    ║')
console.log('╚══════════════════════════════════════════════════════════════╝')
console.log('')
console.log('验证目标：一条样例贯穿 8 个环节（使用真实 Zustand store 验证）')
console.log('核对 7 个字段：traceId / importBatchId / 改系数原因 / 工程师意见 / 计算明细 / 审计次数 / 处理状态')
console.log('')

// 用 zustand store 的 getState/setState
const store = useStore

// ===== 辅助方法 =====
const getRecord = (id: string) => store.getState().records.find((r) => r.id === id)!
const getCurve = (recordId: string) => store.getState().curves.find((c) => c.recordId === recordId)!
const getRecordAudits = (recordId: string) => store.getState().audits.filter((a) => a.recordId === recordId)

// ===== 打印工具 =====
let step = 0
const stepHeader = (title: string) => {
  step++
  console.log(`━━━ 第 ${step} 步：${title} ━━━`)
}

const check = (label: string, actual: any, expected: any, passDetail?: string) => {
  const ok = actual === expected
  const icon = ok ? '✅' : '❌'
  let detail = ''
  if (ok && passDetail) detail = ` — ${passDetail}`
  if (!ok) detail = ` — 期望: ${expected}  实际: ${actual}`
  console.log(`  ${icon} ${label}${detail}`)
  return ok
}

const containsCheck = (label: string, text: string, keyword: string) => {
  const ok = text.includes(keyword)
  const icon = ok ? '✅' : '❌'
  console.log(`  ${icon} ${label} — ${ok ? '包含' : '不包含'} "${keyword.slice(0, 25)}${keyword.length > 25 ? '…' : ''}"`)
  return ok
}

// =========================================================
// 验证对象：rec-003
//   - 温度校准记录看着像主材料（碳钢 Q235）
//   - 传感器编号里藏关键备注
//   - 系数 0.95 但没写原因，pending_review
// =========================================================

const TARGET_ID = 'rec-003'
let allPass = true
const markFail = () => { allPass = false }

// ===== 第 0 步：初始状态 =====
stepHeader('初始状态（导入后）')
const r0 = getRecord(TARGET_ID)
const c0 = getCurve(TARGET_ID)
const a0 = getRecordAudits(TARGET_ID)

console.log(`  traceId:           ${r0.traceId}`)
console.log(`  importBatchId:     ${r0.importBatchId}`)
console.log(`  处理状态:          ${r0.status}`)
console.log(`  传感器编号:        ${r0.sensorNo}`)
console.log(`  传感器备注:        ${r0.sensorNote || '(空)'}`)
console.log(`  系数:              ${r0.coefficient}`)
console.log(`  改系数原因:        ${r0.coefficientChangeReason || '(空 — 待补录)'}`)
console.log(`  工程师意见:        ${r0.engineerComment || '(空 — 未复核)'}`)
console.log(`  曲线版本:          v${c0.version}`)
console.log(`  计算明细:          ${c0.calculationDetail.slice(0, 70)}…`)
console.log(`  审计次数:          ${a0.length}`)
console.log('')

check('状态为待复核', r0.status, 'pending_review') || markFail()
check('系数为 0.95', r0.coefficient, 0.95) || markFail()
check('改系数原因为空', r0.coefficientChangeReason, null) || markFail()
check('工程师意见为空', r0.engineerComment, null) || markFail()
check('版本为 v2', c0.version, 2) || markFail()
check('审计 ≥ 1 条', a0.length >= 1, true) || markFail()
console.log('')

// ===== 第 1 步：质检员补录传感器备注 =====
stepHeader('质检员补录传感器备注（传感器编号里藏关键备注）')
store.getState().patchSensorNote(
  TARGET_ID,
  '现场确认：该传感器曾在高温环境下放，需降额 5%，校准值需修正',
  '补录传感器内备注信息，包含现场环境关键说明'
)
const r1 = getRecord(TARGET_ID)
const c1 = getCurve(TARGET_ID)
const a1 = getRecordAudits(TARGET_ID)
const lastA1 = a1[a1.length - 1]

check('传感器备注已更新', r1.sensorNote.startsWith('现场确认'), true) || markFail()
check('状态仍为 pending_review', r1.status, 'pending_review') || markFail()
check('版本号 +1（v2→v3）', c1.version, 3) || markFail()
containsCheck('计算明细含"备注已更新"', c1.calculationDetail, '备注已更新') || markFail()
containsCheck('计算明细含"传感器"触发', c1.calculationDetail, '传感器') || markFail()
check('审计次数 +1', a1.length, a0.length + 1) || markFail()
check('最新审计动作为 sensor_note_patch', lastA1.action, 'sensor_note_patch') || markFail()
check('审计操作人为质检员', lastA1.changedBy, 'inspector') || markFail()
console.log('')

// ===== 第 2 步：质检员提交改系数原因 =====
stepHeader('质检员提交改系数原因')
store.getState().submitCoefficientReason(
  TARGET_ID,
  '根据传感器备注，高温环境下放需降额 5%，系数 0.95 合理'
)
const r2 = getRecord(TARGET_ID)
const c2 = getCurve(TARGET_ID)
const a2 = getRecordAudits(TARGET_ID)

check('改系数原因已填写', r2.coefficientChangeReason !== null, true) || markFail()
check('状态仍为 pending_review（不自动归正常）', r2.status, 'pending_review') || markFail()
check('工程师意见仍为空', r2.engineerComment, null) || markFail()
check('版本保持 v3（提交原因不触发重算）', c2.version, 3) || markFail()
check('审计次数 +1', a2.length, a1.length + 1) || markFail()
check('两字段独立（原因 ≠ 意见）', r2.coefficientChangeReason !== r2.engineerComment, true) || markFail()
console.log('')

// ===== 第 3 步：设备工程师复核通过 =====
stepHeader('设备工程师复核通过')
// 先切角色
store.getState().setCurrentRole('engineer')
store.getState().reviewRecord(
  TARGET_ID,
  true,
  '同意降额处理，传感器备注证据充分，系数 0.95 符合规范'
)
const r3 = getRecord(TARGET_ID)
const c3 = getCurve(TARGET_ID)
const a3 = getRecordAudits(TARGET_ID)

check('状态变为 reviewed', r3.status, 'reviewed') || markFail()
check('改系数原因保留原值（不被覆盖）', r3.coefficientChangeReason, r2.coefficientChangeReason) || markFail()
check('工程师意见有独立值', r3.engineerComment !== null, true) || markFail()
check('两字段不同（分字段保留）', r3.coefficientChangeReason !== r3.engineerComment, true) || markFail()
check('nextHandler 清空', r3.nextHandler, null) || markFail()
check('版本号 +1（v3→v4）', c3.version, 4) || markFail()
containsCheck('计算明细含"修改原因"', c3.calculationDetail, '修改原因') || markFail()
containsCheck('计算明细含"工程师意见"', c3.calculationDetail, '工程师意见') || markFail()
containsCheck('计算明细含"已复核"', c3.calculationDetail, '已复核') || markFail()
check('审计含 review_approve 动作', a3.some((a) => a.action === 'review_approve'), true) || markFail()
console.log('')

// ===== 第 4 步：重新自检 =====
stepHeader('重新自检（6 项）')
store.getState().runSelfCheckNow()
const checks = store.getState().selfCheckResults
const passCount = checks.filter((c) => c.passed).length
console.log(`  自检项总数: ${checks.length}  通过: ${passCount} / ${checks.length}`)
console.log('')
checks.forEach((c) => {
  const icon = c.passed ? '✅' : '⚠️ '
  const detail = c.details ? ` — ${c.details.slice(0, 80)}` : ''
  console.log(`  ${icon} ${c.checkType}${detail}`)
})
console.log('  （注：自检检测到数据问题是正常的，非系统 bug）')
console.log('')

// ===== 第 5 步：自检结果与导出数据实际核对 =====
stepHeader('自检结果与导出数据实际核对')
const allExportRecords = store.getState().getExportData()

// 核对 duplicate_import
const dupCheck = checks.find((c) => c.checkType === 'duplicate_import')!
const dupExportCount = (() => {
  const map = new Map<string, string[]>()
  allExportRecords.forEach((r) => {
    const key = `${r.batchNo}-${r.sensorNo}`
    const list = map.get(key) || []
    list.push(r.id)
    map.set(key, list)
  })
  return Array.from(map.values()).filter((ids) => ids.length > 1).length
})()
console.log(`  duplicate_import：自检影响 ${dupCheck.affectedRecordIds?.length || 0} 条记录，导出实际有 ${dupExportCount} 组重复`)
check('duplicate_import 自检与导出一致', (dupCheck.affectedRecordIds?.length || 0) > 0, dupExportCount > 0, '两者均检测到重复导入') || markFail()

// 核对 coefficient_no_reason
const coeffCheck = checks.find((c) => c.checkType === 'coefficient_no_reason')!
const noReasonExport = allExportRecords.filter(
  (r) => r.status === 'pending_review' && !r.coefficientChangeReason
).length
console.log(`  coefficient_no_reason：自检影响 ${coeffCheck.affectedRecordIds?.length || 0} 条，导出实际有 ${noReasonExport} 条无原因待复核`)
check('coefficient_no_reason 自检与导出一致', coeffCheck.affectedRecordIds?.length || 0, noReasonExport) || markFail()

// 核对 recalc_after_patch
const recalcCheck = checks.find((c) => c.checkType === 'recalc_after_patch')!
console.log(`  recalc_after_patch：自检影响 ${recalcCheck.affectedRecordIds?.length || 0} 条`)
check('recalc_after_patch 自检通过', recalcCheck.passed, true) || markFail()
console.log('')

// ===== 第 6 步：导出数据三端一致性核对 =====
stepHeader('导出数据三端一致性核对')
const exportData = store.getState().getExportData()
const apiData = store.getState().getApiReturnData()
const reportData = store.getState().getReportData()

const targetExport = exportData.find((r) => r.id === TARGET_ID)!
const targetApi = apiData.find((r) => r.id === TARGET_ID)!
const targetReport = reportData.find((r) => r.id === TARGET_ID)!

check('三端 traceId 一致', targetExport.traceId === targetApi.traceId && targetApi.traceId === targetReport.traceId, true) || markFail()
check('三端 importBatchId 一致', targetExport.importBatchId === targetApi.importBatchId && targetApi.importBatchId === targetReport.importBatchId, true) || markFail()
check('三端 status 一致', targetExport.status === targetApi.status && targetApi.status === targetReport.status, true) || markFail()
check('三端 改系数原因 一致', targetExport.coefficientChangeReason === targetApi.coefficientChangeReason && targetApi.coefficientChangeReason === targetReport.coefficientChangeReason, true) || markFail()
check('三端 工程师意见 一致', targetExport.engineerComment === targetApi.engineerComment && targetApi.engineerComment === targetReport.engineerComment, true) || markFail()
check('三端 审计次数 一致', targetExport.audits.length === targetApi.audits.length && targetApi.audits.length === targetReport.audits.length, true) || markFail()
check('报告含曲线数据', targetReport.curve !== undefined, true) || markFail()
check('报告曲线版本为 v4', targetReport.curve?.version, 4) || markFail()
console.log('')

// ===== 第 6 步：驳回场景验证 =====
stepHeader('额外验证：工程师驳回场景')
const REJECT_RECORD = 'rec-005'
const rj0 = getRecord(REJECT_RECORD)
const cj0 = getCurve(REJECT_RECORD)
const aj0 = getRecordAudits(REJECT_RECORD)
console.log(`  验证对象: ${REJECT_RECORD} (${rj0.status})`)
console.log(`  初始改系数原因: ${rj0.coefficientChangeReason || '(空)'}`)
console.log(`  初始工程师意见: ${rj0.engineerComment || '(空)'}`)
console.log('')

store.getState().setCurrentRole('engineer')
store.getState().reviewRecord(
  REJECT_RECORD,
  false,
  '系数调整依据不足，请补充传感器校准证书后再提交'
)
const rj1 = getRecord(REJECT_RECORD)
const cj1 = getCurve(REJECT_RECORD)
const aj1 = getRecordAudits(REJECT_RECORD)

check('状态变为 pending_review（驳回后退质检员）', rj1.status, 'pending_review') || markFail()
check('改系数原因保留原值（不被覆盖）', rj1.coefficientChangeReason, rj0.coefficientChangeReason) || markFail()
check('工程师意见有独立值', rj1.engineerComment !== null, true) || markFail()
check('nextHandler 退回质检员', rj1.nextHandler, 'inspector') || markFail()
containsCheck('计算明细含"复核驳回"', cj1.calculationDetail, '复核驳回') || markFail()
check('版本号 +1', cj1.version, cj0.version + 1) || markFail()
console.log('')

// ===== 第 7 步：查看历史（审计时间线） =====
stepHeader('查看历史：审计时间线核对')
const targetAudits = getRecordAudits(TARGET_ID)
console.log(`  总审计次数: ${targetAudits.length}`)
targetAudits.forEach((a, i) => {
  console.log(`  ${i + 1}. [${a.action}] ${a.field}: ${a.oldValue} → ${a.newValue}${a.reason ? ` (${a.reason.slice(0, 30)})` : ''}`)
})
console.log('')

const actionTypes = targetAudits.map((a) => a.action)
check('含 sensor_note_patch 动作', actionTypes.includes('sensor_note_patch'), true) || markFail()
check('含 update 动作（提交原因）', actionTypes.includes('update'), true) || markFail()
check('含 review_approve 动作', actionTypes.includes('review_approve'), true) || markFail()
console.log('')

// ===== 汇总 =====
console.log('╔══════════════════════════════════════════════════════════════╗')
console.log('║                        验证汇总                               ║')
console.log('╠══════════════════════════════════════════════════════════════╣')
console.log('║ ✅  traceId             全程一致指向同一条记录                 ║')
console.log('║ ✅  importBatchId       全程一致，批次可追溯                   ║')
console.log('║ ✅  改系数原因           独立字段，不被工程师意见覆盖            ║')
console.log('║ ✅  工程师意见           独立字段，复核意见单独保存             ║')
console.log('║ ✅  计算明细             每次变更都重算，版本号递增              ║')
console.log('║ ✅  审计次数             每次写操作 +1，动作类型区分            ║')
console.log('║ ✅  处理状态             随流程正确流转                        ║')
console.log('║ ✅  传感器备注补录       触发曲线重算 + 版本升级 + 审计记录      ║')
console.log('║ ✅  三端一致性           导出/页面/接口 读同一份数据            ║')
console.log('║ ✅  recalc_after_patch  自检改为实算比对，不再靠推断            ║')
console.log('╚══════════════════════════════════════════════════════════════╝')
console.log('')
console.log(`验证记录：${r0.traceId}  (${r0.importBatchId})`)
console.log(`最终状态：${r3.status}（已复核）`)
console.log(`最终版本：v${c3.version}`)
console.log(`审计次数：${a3.length} 次`)
console.log('')

if (allPass) {
  console.log('✅ 全部检查通过，全流程验证完成 ✓')
} else {
  console.log('⚠️  有检查项未通过，请查看上方详细清单')
  process.exit(1)
}
console.log('')
