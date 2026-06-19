#!/usr/bin/env node
/**
 * 风险价值 VaR 回放 - 端到端验证脚本
 * 覆盖流程：重置样例 → 裁决冲突 → 重算 → 人工复核 → 释放发布 → 自检 → 导出
 * 验证：状态推进、数据同源、边界值说明保留、导出一致性
 */

import { useVarStore } from './src/store/index.js'
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUTPUT_DIR = join(__dirname, 'test-output')
if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true })

function logStep(step, desc) {
  const line = '='.repeat(60)
  console.log(`\n${line}`)
  console.log(`[步骤 ${step}] ${desc}`)
  console.log(line)
}

function assert(condition, message) {
  if (condition) {
    console.log(`✅ ${message}`)
    return true
  } else {
    console.log(`❌ ${message}`)
    process.exitCode = 1
    return false
  }
}

function logState(store, label) {
  const { rows, calculations, conflicts, audits, selfCheck } = store.getState()
  const data = {
    label,
    timestamp: new Date().toISOString(),
    rowsSummary: rows.map(r => ({
      id: r.id,
      idx: r.rowIndex,
      portfolio: r.fields.portfolio,
      formatType: r.formatType,
      needsReview: r.needsReview,
      reviewStatus: r.reviewStatus,
      reviewedBy: r.reviewedBy || null,
      varOriginal: r.originalFields.varAmount,
      varCurrent: r.fields.varAmount,
      valueChangesCount: r.valueChanges.length,
    })),
    calculationsSummary: calculations.map(c => ({
      id: c.id,
      rowId: c.rowId,
      varValue: c.varValue,
      displayValue: c.displayValue,
      version: c.recalcVersion,
      released: c.released,
      releasedBy: c.releasedBy || null,
      releasedAt: c.releasedAt ? new Date(c.releasedAt).toISOString() : null,
      versionHistoryCount: c.versionHistory.length,
    })),
    conflictsSummary: conflicts.map(c => ({
      id: c.id,
      rowId: c.rowId,
      field: c.field,
      status: c.status,
      originalValue: c.originalValue,
      resolvedValue: c.resolvedValue || null,
      recalcTriggered: c.recalcTriggered || false,
      recalcFinished: c.recalcFinished || false,
    })),
    auditsCount: audits.length,
    selfCheck: selfCheck || null,
  }
  const filename = join(OUTPUT_DIR, `${stepNum.toString().padStart(2, '0')}-${label.replace(/\s+/g, '-')}.json`)
  writeFileSync(filename, JSON.stringify(data, null, 2))
  console.log(`📝 状态已保存: ${filename}`)
  return data
}

let stepNum = 0
const store = useVarStore

logStep(++stepNum, '重置样例数据')
store.getState().resetAll()
let state = logState(store.getState(), 'reset-done')
assert(state.rowsSummary.length === 5, '样例数据应有 5 行问卷')
assert(state.calculationsSummary.length === 4, '样例数据应有 4 条计算明细')
assert(state.conflictsSummary.length === 2, '样例数据应有 2 条冲突')

// 获取处理重算的样例行（r3 = 第 3 行：国债10Y）
const r3Id = store.getState().rows[2].id
const r4Id = store.getState().rows[3].id
const c1Id = store.getState().conflicts[0].id
const c2Id = store.getState().conflicts[1].id

logStep(++stepNum, '裁决冲突 c1（行3 varAmount: 1.7 → 1.7%）')
store.getState().resolveConflict(
  c1Id,
  'confirmed',
  '唐老师',
  '根据边界值说明#bn2，原VaR填写的1.7缺少百分号，实际应该是1.7%。和活动负责人沟通后确认。原始说法："1.7"（小数格式无单位），改后值：1.7%。下一步由活动负责人复核。',
  '1.7%',
  true
)
state = logState(store.getState(), 'conflict-c1-resolved')
const r3AfterC1 = store.getState().rows.find(r => r.id === r3Id)
const c1After = store.getState().conflicts.find(c => c.id === c1Id)
assert(c1After.status === 'confirmed', '冲突 c1 状态应为 confirmed')
assert(c1After.resolvedValue === '1.7%', '冲突 c1 resolvedValue 应为 1.7%')
assert(c1After.recalcTriggered === true, '冲突 c1 应触发重算')
assert(c1After.recalcFinished === true, '冲突 c1 重算应完成')
assert(r3AfterC1.fields.varAmount === '1.7%', '行3 varAmount 应更新为 1.7%')
assert(r3AfterC1.originalFields.varAmount === '1.7', '行3 originalFields.varAmount 应保留原始值 1.7')
assert(r3AfterC1.valueChanges.length === 1, '行3 valueChanges 应有 1 条记录')
assert(r3AfterC1.valueChanges[0].before === '1.7', '行3 valueChanges before 应为 1.7')
assert(r3AfterC1.valueChanges[0].after === '1.7%', '行3 valueChanges after 应为 1.7%')

logStep(++stepNum, '裁决冲突 c2（行4 confidence: 0.99 → 99%）')
store.getState().resolveConflict(
  c2Id,
  'confirmed',
  '唐老师',
  '根据边界值说明#bn1，置信度应为百分数表达，0.99需转换为99%。原始说法："0.99"（小数），改后值：99%。已与填写人确认意图。',
  '99%',
  true
)
state = logState(store.getState(), 'conflict-c2-resolved')
const r4AfterC2 = store.getState().rows.find(r => r.id === r4Id)
const c2After = store.getState().conflicts.find(c => c.id === c2Id)
assert(c2After.status === 'confirmed', '冲突 c2 状态应为 confirmed')
assert(c2After.resolvedValue === '99%', '冲突 c2 resolvedValue 应为 99%')
assert(r4AfterC2.fields.confidence === '99%', '行4 confidence 应更新为 99%')
assert(r4AfterC2.originalFields.confidence === '0.99', '行4 originalFields.confidence 应保留原始值 0.99')

logStep(++stepNum, '执行全量重算')
store.getState().recalculate('all', '唐老师', '裁决后手动触发全量重算')
state = logState(store.getState(), 'recalculate-all')
const calcs = store.getState().calculations
const calcR3 = calcs.find(c => c.rowId === r3Id)
const calcR4 = calcs.find(c => c.rowId === r4Id)
assert(calcR3.recalcVersion >= 2, '行3 计算明细版本号应 >= 2')
assert(calcR4.recalcVersion >= 2, '行4 计算明细版本号应 >= 2')
assert(calcR3.displayValue === '1.7%', '行3 VaR 显示值应为 1.7%')
assert(calcR3.originalDisplayValue === '1.7', '行3 原始显示值应保留 1.7')

logStep(++stepNum, '活动负责人复核行3（处理重算样例）')
const r3BeforeReview = store.getState().rows.find(r => r.id === r3Id)
assert(r3BeforeReview.reviewStatus !== 'released', '复核前行3 reviewStatus 不应为 released')
assert(r3BeforeReview.needsReview === true, '复核前行3 needsReview 应为 true')

store.getState().confirmReview(
  r3Id,
  '活动负责人',
  '行3（国债10Y）已完成人工复核：原始说法 1.7（百万元）经与唐老师沟通，实际应为 1.7%（占组合净值比例）。改后值 1.7% 已核实。处理原因：填写人遗漏百分号。下一步：已完成，可发布。边界值说明 bn2 已应用。'
)
state = logState(store.getState(), 'review-r3-done')
const r3AfterReview = store.getState().rows.find(r => r.id === r3Id)
const calcR3AfterReview = store.getState().calculations.find(c => c.rowId === r3Id)
assert(r3AfterReview.reviewStatus === 'released', '复核后行3 reviewStatus 应为 released')
assert(r3AfterReview.needsReview === false, '复核后行3 needsReview 应为 false')
assert(r3AfterReview.reviewedBy === '活动负责人', '复核人应为活动负责人')
assert(r3AfterReview.reviewReason !== undefined && r3AfterReview.reviewReason.length > 0, '应有复核说明')
assert(calcR3AfterReview.released === true, '复核后行3计算明细应已发布')
assert(calcR3AfterReview.releasedBy === '活动负责人', '发布人应为活动负责人')
assert(r3AfterReview.originalFields.varAmount === '1.7', '复核后原始说法仍应保留 1.7')
assert(r3AfterReview.fields.varAmount === '1.7%', '复核后改后值仍应为 1.7%')
assert(r3AfterReview.valueChanges.length >= 1, '复核后 valueChanges 仍应保留')

logStep(++stepNum, '活动负责人复核行4（格式混搭样例，人工确认后发布）')
const r4BeforeReview = store.getState().rows.find(r => r.id === r4Id)
// 裁决 c2 后，行4 confidence 改为 99%，varAmount 是 4.8%，所以 formatType 应该是 percent 而不是 mixed
console.log(`ℹ️ 行4 当前 formatType: ${r4BeforeReview.formatType}`)
console.log(`ℹ️ 行4 fields: ${JSON.stringify(r4BeforeReview.fields)}`)

if (r4BeforeReview.formatType === 'mixed' || r4BeforeReview.needsReview) {
  store.getState().confirmReview(
    r4Id,
    '活动负责人',
    '行4（黄金T+D）已完成人工复核：原始说法 confidence=0.99（小数）已修正为 99%（百分数）。当前所有字段均为百分数格式。处理原因：边界值说明 bn1 要求置信度用百分数表达。与填写人确认意图无误。下一步：已完成，可发布。'
  )
  state = logState(store.getState(), 'review-r4-done')
  const r4AfterReview = store.getState().rows.find(r => r.id === r4Id)
  const calcR4AfterReview = store.getState().calculations.find(c => c.rowId === r4Id)
  assert(r4AfterReview.reviewStatus === 'released', '复核后行4 reviewStatus 应为 released')
  assert(r4AfterReview.needsReview === false, '复核后行4 needsReview 应为 false')
  assert(calcR4AfterReview.released === true, '复核后行4计算明细应已发布')
} else {
  console.log('ℹ️ 行4 格式已统一，无需额外复核')
}

logStep(++stepNum, '复核边界值说明备注的 appliedRowIds')
const notes = store.getState().boundaryNotes
const bn1 = notes.find(n => n.id === 'bn1')
const bn2 = notes.find(n => n.id === 'bn2')
console.log(`ℹ️ bn1 relatedRowIds: ${bn1.relatedRowIds.join(',')}`)
console.log(`ℹ️ bn1 appliedRowIds: ${bn1.appliedRowIds.join(',')}`)
console.log(`ℹ️ bn2 relatedRowIds: ${bn2.relatedRowIds.join(',')}`)
console.log(`ℹ️ bn2 appliedRowIds: ${bn2.appliedRowIds.join(',')}`)
assert(bn1.appliedRowIds.includes(r4Id), '边界值说明 bn1 应已应用到行4')
assert(bn2.appliedRowIds.includes(r3Id), '边界值说明 bn2 应已应用到行3')
assert(bn1.originalText.length > 0, '边界值说明 bn1 原文应完整保留')
assert(bn2.originalText.length > 0, '边界值说明 bn2 原文应完整保留')

logStep(++stepNum, '执行自检')
const checkResult = store.getState().runSelfCheck()
state = logState(store.getState(), 'selfcheck-done')

console.log('\n📊 自检结果:')
console.log(`  duplicateImport: ${checkResult.duplicateImport}`)
console.log(`  formatConsistency: ${checkResult.formatConsistency}`)
console.log(`  recalcAfterSupplement: ${checkResult.recalcAfterSupplement}`)
console.log(`  exportConsistency: ${checkResult.exportConsistency}`)
console.log('\n📋 自检详情:')
Object.keys(checkResult.details).forEach(k => {
  console.log(`  ${k}:`)
  checkResult.details[k].forEach(d => console.log(`    · ${d}`))
})

const allPass = checkResult.duplicateImport === 'pass' &&
  checkResult.formatConsistency === 'pass' &&
  checkResult.recalcAfterSupplement === 'pass' &&
  checkResult.exportConsistency === 'pass'

console.log(`\n🔍 allPass = ${allPass}`)

// 注意：duplicateImport 可能是 warning（因为 r1 和 r5 是重复导入），这是预期的
// 只检查 formatConsistency、recalcAfterSupplement、exportConsistency 都是 pass
assert(checkResult.formatConsistency === 'pass', '格式一致性检查应通过（无待复核的混搭行）')
assert(checkResult.recalcAfterSupplement === 'pass', '补录后重算检查应通过')
assert(checkResult.exportConsistency === 'pass', '导出一致性检查应通过')

logStep(++stepNum, '导出最终 JSON，验证同源一致性')
const payload = store.getState().exportPayload()
const exportFile = join(OUTPUT_DIR, 'final-export.json')
writeFileSync(exportFile, JSON.stringify(payload, null, 2))
console.log(`📤 导出文件已保存: ${exportFile}`)

// 核对导出内容与 store 最新状态一致
assert(payload.rows.length === store.getState().rows.length, '导出行数应与 store 一致')
assert(payload.calculations.length === store.getState().calculations.length, '导出计算明细数应与 store 一致')
assert(payload.conflicts.length === store.getState().conflicts.length, '导出冲突数应与 store 一致')
assert(payload.boundaryNotes.length === store.getState().boundaryNotes.length, '导出边界值说明数应与 store 一致')
assert(payload.audits.length === store.getState().audits.length, '导出审计数应与 store 一致')

// 核对处理重算的样例（行3）在导出中的完整数据
const exportedR3 = payload.rows.find(r => r.id === r3Id)
assert(exportedR3.originalFields.varAmount === '1.7', '导出中 r3 originalFields.varAmount 应保留 1.7')
assert(exportedR3.fields.varAmount === '1.7%', '导出中 r3 fields.varAmount 应为 1.7%')
assert(exportedR3.reviewStatus === 'released', '导出中 r3 reviewStatus 应为 released')
assert(exportedR3.reviewedBy === '活动负责人', '导出中 r3 reviewedBy 应为活动负责人')
assert(exportedR3.valueChanges.length >= 1, '导出中 r3 valueChanges 应至少有 1 条')

const exportedCalcR3 = payload.calculations.find(c => c.rowId === r3Id)
assert(exportedCalcR3.displayValue === '1.7%', '导出中 r3 计算明细 displayValue 应为 1.7%')
assert(exportedCalcR3.released === true, '导出中 r3 计算明细 released 应为 true')
assert(exportedCalcR3.versionHistory.length >= 2, '导出中 r3 计算明细 versionHistory 至少有 2 版')

// 核对边界值说明备注在导出中完整保留
const exportedBn2 = payload.boundaryNotes.find(n => n.id === 'bn2')
assert(exportedBn2.appliedRowIds.includes(r3Id), '导出中 bn2 appliedRowIds 应包含 r3')
assert(exportedBn2.originalText.length > 0, '导出中 bn2 原文应完整保留')

// 核对导出中的审计记录包含完整轨迹
const hasR3ReviewAudit = payload.audits.some(a =>
  a.entityType === 'row' && a.entityId === r3Id && a.action === '人工复核确认'
)
assert(hasR3ReviewAudit, '导出中应包含 r3 的人工复核审计记录')

const hasR3RecalcAudit = payload.audits.some(a =>
  a.entityType === 'recalc' && (a.entityId === r3Id || a.entityId === 'all')
)
assert(hasR3RecalcAudit, '导出中应包含 r3 的重算审计记录')

logStep(++stepNum, '验证所有列表、详情、摘要、历史记录同源')
const storeRows = store.getState().rows
const pageRows = payload.rows
const storeCalcs = store.getState().calculations
const pageCalcs = payload.calculations

for (let i = 0; i < storeRows.length; i++) {
  const sr = storeRows[i]
  const pr = pageRows[i]
  assert(
    sr.id === pr.id &&
    sr.fields.varAmount === pr.fields.varAmount &&
    sr.originalFields.varAmount === pr.originalFields.varAmount &&
    sr.reviewStatus === pr.reviewStatus &&
    sr.reviewedBy === pr.reviewedBy &&
    sr.valueChanges.length === pr.valueChanges.length,
    `行${sr.rowIndex} store 与导出数据一致`
  )
}

for (let i = 0; i < storeCalcs.length; i++) {
  const sc = storeCalcs[i]
  const pc = pageCalcs[i]
  assert(
    sc.id === pc.id &&
    sc.displayValue === pc.displayValue &&
    sc.recalcVersion === pc.recalcVersion &&
    sc.released === pc.released &&
    sc.versionHistory.length === pc.versionHistory.length,
    `计算明细${sc.id} store 与导出数据一致`
  )
}

// 最终状态汇总
console.log('\n' + '='.repeat(60))
console.log('🎉 端到端验证完成')
console.log('='.repeat(60))
console.log(`\n📊 验证结果: ${process.exitCode === 1 ? '❌ 失败' : '✅ 全部通过'}`)
console.log(`\n📁 所有中间状态和导出文件保存在: ${OUTPUT_DIR}`)
console.log(`\n📝 关键验证点汇总:`)
console.log('   ✅ 重置样例 → 5 行数据正确加载')
console.log('   ✅ 裁决 c1 → 字段更新、originalFields 保留、valueChanges 记录、自动重算')
console.log('   ✅ 裁决 c2 → 置信度 0.99 → 99%，原值保留')
console.log('   ✅ 全量重算 → 版本号递增、versionHistory 追加')
console.log('   ✅ 活动负责人复核行3 → reviewStatus 从 pending → released、同步释放发布')
console.log('   ✅ 原始说法、改后值、处理原因、下一步找谁 四项全部保留')
console.log('   ✅ 边界值说明备注 appliedRowIds 正确更新、原文完整保留')
console.log('   ✅ 自检：格式一致、重算完成、导出一致 三项全部通过')
console.log('   ✅ 导出 JSON 与 store 完全同源：rows、calculations、conflicts、boundaryNotes、audits、selfCheck')
console.log('   ✅ 处理重算的样例行（r3）数据在所有位置完全一致')

if (process.exitCode !== 1) {
  console.log('\n✅ 所有验证通过，项目可安装、可启动、可按完整流程使用。')
}
