import {
  step1ImportTunerMessages,
  step2ReviewGroupSignup,
  step3UpdateSettlement,
  unifiedStore,
  confirmRecord,
  confirmTempSubstitute,
  getRecordAuditTrail,
  verifyExportConsistency,
  recalculateAfterSupplement,
  mergeGroupSignupToRecords,
  parseGroupSignup,
  isWorkflowDone,
  RecordStatus,
  ReviewFlag
} from './index'

const tunerMessages = [
  '小明,2026-06-01,14:00,李老师,陪练,45',
  '小红,2026-06-01,15:00,王老师,陪练,45',
  '小花,2026-06-02,10:00,张老师,陪练,60'
]

const groupSignups = [
  '小明,2026-06-01,15:00,李老师,现场到',
  '小红,2026-06-01,15:00,王老师,现场到',
  '小刚,2026-06-01,16:00,赵老师,临时替补,现场到',
  '小花,2026-06-02,10:00,张老师,现场到'
]

function section(title: string) {
  console.log(`\n${'═'.repeat(70)}`)
  console.log(`  ${title}`)
  console.log('═'.repeat(70))
}

function subSection(title: string) {
  console.log(`\n  ── ${title} ──`)
}

function check(label: string, condition: boolean, detail?: string) {
  const mark = condition ? '✓' : '✗'
  const color = condition ? '\x1b[32m' : '\x1b[31m'
  const reset = '\x1b[0m'
  console.log(`  ${color}${mark}${reset} ${label}${detail ? ' — ' + detail : ''}`)
}

function printRecord(label: string, r: any) {
  console.log(`\n  ${label}:`)
  console.log(`    姓名: ${r.studentName}  日期: ${r.courseDate}  时间: ${r.courseTime}  老师: ${r.teacherName}`)
  console.log(`    状态: ${r.status}  复核标记: ${r.reviewFlag}`)
  console.log(`    分账时间: ${r.settledAt || '(未分账)'}  分账金额: ${r.settlementAmount || '(未计算)'}`)
  console.log(`    调音师行号: ${r.tunerOriginalLineNumber ?? '-'}  原文: ${r.tunerRawContent ?? '(无)'}`)
  console.log(`    群接龙行号: ${r.groupOriginalLineNumber ?? '-'}  原文: ${r.groupRawContent ?? '(无)'}`)
  if (r.groupCourseTime && r.groupCourseTime !== r.courseTime) {
    console.log(`    口径不一致: 调音师${r.courseTime} vs 群接龙${r.groupCourseTime}`)
  }
}

function runFullValidation() {
  unifiedStore.reset()
  
  console.log('\n\x1b[1m琴行陪练套餐消课 —— 分账状态锁定验证（端到端完整复现）\x1b[0m')
  console.log('测试目标：')
  console.log('  1. 小明(14:00调音师/15:00群接龙)口径不一致进入待复核')
  console.log('  2. 小刚(仅群接龙说一句)进入待复核，不自动归正常')
  console.log('  3. 复核通过后分账，4条记录状态全部变为settled')
  console.log('  4. 分账后再执行重算、补录，settled状态保持不变，不会退回matched')
  console.log('  5. 页面、接口、历史、报告、导出五处状态一致')

  let allPassed = true
  let records: any[] = []

  section('Step 1: 打开任务，导入调音师留言')
  console.log('  导入数据：')
  tunerMessages.forEach(line => console.log(`    ${line}`))

  const { records: s1Records, workflow: s1Workflow } = step1ImportTunerMessages(tunerMessages, '调音师小王')
  records = s1Records

  console.log(`\n  导入结果：共 ${records.length} 条记录`)
  records.forEach(r => {
    console.log(`    ${r.studentName} ${r.courseDate} ${r.courseTime} — 状态:${r.status} 来源:${r.importSource}`)
  })
  check('3条调音师记录全部导入成功', records.length === 3, `${records.length}/3`)
  check('全部标记为 imported', records.every(r => r.status === RecordStatus.IMPORTED), '')

  section('Step 2: 补录排练群接龙（含口径不一致和临时替补）')
  console.log('  补录数据：')
  groupSignups.forEach(line => console.log(`    ${line}`))

  const { records: s2Records, workflow: s2Workflow } = step2ReviewGroupSignup(groupSignups, '版权运营小鹿', s1Workflow)
  records = s2Records

  console.log(`\n  合并结果：共 ${records.length} 条记录`)

  subSection('逐条核对')
  const xiaoming = records.find(r => r.studentName === '小明' && r.courseDate === '2026-06-01')!
  const xiaohong = records.find(r => r.studentName === '小红')!
  const xiaohua = records.find(r => r.studentName === '小花')!
  const xiaogang = records.find(r => r.studentName === '小刚')!

  printRecord('小明（口径不一致）', xiaoming)
  check('小明进入待复核', xiaoming.status === RecordStatus.NEEDS_REVIEW, xiaoming.status)
  check('小明标记口径不一致', xiaoming.reviewFlag === ReviewFlag.MISMATCH, xiaoming.reviewFlag)
  check('小明保留调音师行号', xiaoming.tunerOriginalLineNumber === 1, `${xiaoming.tunerOriginalLineNumber}`)
  check('小明保留群接龙行号', xiaoming.groupOriginalLineNumber === 1, `${xiaoming.groupOriginalLineNumber}`)
  check('小明调音师原文可追溯', xiaoming.tunerRawContent?.includes('14:00'), xiaoming.tunerRawContent)
  check('小明群接龙原文可追溯', xiaoming.groupRawContent?.includes('15:00'), xiaoming.groupRawContent)

  printRecord('小红（完全匹配）', xiaohong)
  check('小红自动匹配', xiaohong.status === RecordStatus.MATCHED, xiaohong.status)

  printRecord('小花（完全匹配）', xiaohua)
  check('小花自动匹配', xiaohua.status === RecordStatus.MATCHED, xiaohua.status)

  printRecord('小刚（临时替补仅群里说一句）', xiaogang)
  check('小刚进入待复核', xiaogang.status === RecordStatus.NEEDS_REVIEW, xiaogang.status)
  check('小刚标记临时替补', xiaogang.reviewFlag === ReviewFlag.TEMP_SUB_ONLY_IN_GROUP, xiaogang.reviewFlag)
  check('小刚没有调音师记录', !xiaogang.tunerMessageId, xiaogang.tunerMessageId || '错误-有调音师记录')
  check('小刚保留群接龙行号', xiaogang.groupOriginalLineNumber === 3, `${xiaogang.groupOriginalLineNumber}`)

  subSection('自检报告')
  const pageResult1 = unifiedStore.getForPageDisplay()
  console.log(`  总记录: ${pageResult1.summary.total}`)
  console.log(`  待复核: ${pageResult1.summary.byStatus[RecordStatus.NEEDS_REVIEW]}`)
  console.log(`  自检问题: ${pageResult1.selfCheck.issues.length} 条`)
  pageResult1.selfCheck.issues.forEach(i => {
    console.log(`    [${i.severity}] ${i.type}: ${i.message}`)
  })

  check('报告显示2条待复核', pageResult1.summary.byStatus[RecordStatus.NEEDS_REVIEW] === 2, `${pageResult1.summary.byStatus[RecordStatus.NEEDS_REVIEW]}/2`)
  check('自检至少有1条mismatch', pageResult1.selfCheck.issues.some(i => i.type === 'mismatch'), '')
  check('自检至少有1条temp_substitute', pageResult1.selfCheck.issues.some(i => i.type === 'temp_substitute'), '')

  section('Step 3: 保存、刷新、票务同事复核')
  
  subSection('保存（setRecords）')
  const saveData = unifiedStore.getRecords()
  unifiedStore.setRecords(saveData)
  console.log('  已保存')

  subSection('刷新（重新读取）')
  const refreshed = unifiedStore.getRecords()
  console.log(`  刷新后记录数: ${refreshed.length}`)
  check('刷新后数据一致', refreshed.length === 4 && refreshed.every(r => r.status), '')

  subSection('票务同事复核')
  let current = [...refreshed]
  
  console.log('  复核小明（口径不一致）：通过')
  const xiaomingReviewed = confirmRecord(
    current.find(r => r.id === xiaoming.id)!,
    '票务同事小张',
    true,
    '核实后以群接龙15:00为准'
  )
  
  console.log('  复核小刚（临时替补）：通过')
  const xiaogangReviewed = confirmTempSubstitute(
    current.find(r => r.id === xiaogang.id)!,
    '票务同事小张',
    true,
    '核实确为临时替补'
  )
  
  current = current.map(r => {
    if (r.id === xiaoming.id) return xiaomingReviewed
    if (r.id === xiaogang.id) return xiaogangReviewed
    return r
  })
  unifiedStore.setRecords(current)
  records = current

  printRecord('小明（复核后）', current.find(r => r.id === xiaoming.id)!)
  printRecord('小刚（复核后）', current.find(r => r.id === xiaogang.id)!)
  
  check('小明复核后为 confirmed', xiaomingReviewed.status === RecordStatus.CONFIRMED, xiaomingReviewed.status)
  check('小明复核标记清除', xiaomingReviewed.reviewFlag === ReviewFlag.NONE, xiaomingReviewed.reviewFlag)
  check('小刚复核后为 confirmed', xiaogangReviewed.status === RecordStatus.CONFIRMED, xiaogangReviewed.status)
  check('小刚复核标记清除', xiaogangReviewed.reviewFlag === ReviewFlag.NONE, xiaogangReviewed.reviewFlag)

  section('Step 4: 分账明细更新（step3）')
  const { records: s3Records, workflow: s3Workflow } = step3UpdateSettlement('票务同事小张', s2Workflow)
  records = s3Records

  subSection('分账后逐人核对')
  const xiaoming3 = records.find(r => r.studentName === '小明')!
  const xiaohong3 = records.find(r => r.studentName === '小红')!
  const xiaohua3 = records.find(r => r.studentName === '小花')!
  const xiaogang3 = records.find(r => r.studentName === '小刚')!

  printRecord('小明', xiaoming3)
  printRecord('小红', xiaohong3)
  printRecord('小花', xiaohua3)
  printRecord('小刚', xiaogang3)

  check('小明已分账', xiaoming3.status === RecordStatus.SETTLED, xiaoming3.status)
  check('小红已分账', xiaohong3.status === RecordStatus.SETTLED, xiaohong3.status)
  check('小花已分账', xiaohua3.status === RecordStatus.SETTLED, xiaohua3.status)
  check('小刚已分账', xiaogang3.status === RecordStatus.SETTLED, xiaogang3.status)

  check('小明有分账时间', !!xiaoming3.settledAt, xiaoming3.settledAt)
  check('小红有分账时间', !!xiaohong3.settledAt, xiaohong3.settledAt)
  check('小花有分账时间', !!xiaohua3.settledAt, xiaohua3.settledAt)
  check('小刚有分账时间', !!xiaogang3.settledAt, xiaogang3.settledAt)

  check('小明有分账金额', xiaoming3.settlementAmount === 90, `${xiaoming3.settlementAmount}`)
  check('小红有分账金额', xiaohong3.settlementAmount === 90, `${xiaohong3.settlementAmount}`)
  check('小花有分账金额', xiaohua3.settlementAmount === 120, `${xiaohua3.settlementAmount}`)
  check('小刚有分账金额', xiaogang3.settlementAmount === 90, `${xiaogang3.settlementAmount}`)

  subSection('工作流收口检查')
  console.log(`  工作流完成: ${isWorkflowDone(s3Workflow)}`)
  s3Workflow.steps.forEach(s => {
    console.log(`    ${s.name}: ${s.status}${s.completedAt ? ' — ' + s.completedAt : ''}`)
  })
  check('工作流三步全部完成', isWorkflowDone(s3Workflow), '')

  subSection('报告汇总')
  const pageResult2 = unifiedStore.getForPageDisplay()
  console.log(`  总记录: ${pageResult2.summary.total}`)
  console.log(`  已分账: ${pageResult2.summary.byStatus[RecordStatus.SETTLED]}`)
  console.log(`  总分账金额: ${pageResult2.summary.totalSettlementAmount}`)
  console.log(`  自检通过: ${pageResult2.selfCheck.passed}`)
  console.log(`  自检问题: ${pageResult2.selfCheck.issues.length} 条`)
  
  check('报告显示已分账4条', pageResult2.summary.byStatus[RecordStatus.SETTLED] === 4, `${pageResult2.summary.byStatus[RecordStatus.SETTLED]}/4`)
  check('总分账金额390', pageResult2.summary.totalSettlementAmount === 390, `${pageResult2.summary.totalSettlementAmount}/390`)
  
  if (pageResult2.summary.byStatus[RecordStatus.SETTLED] === 4 && pageResult2.selfCheck.passed) {
    check('报告不再矛盾（4条已分账且自检通过）', true, '通过')
  } else {
    check('报告不再矛盾', false, `已分账${pageResult2.summary.byStatus[RecordStatus.SETTLED]}条，自检通过${pageResult2.selfCheck.passed}`)
    allPassed = false
  }

  section('Step 5: 关键验证 —— 分账后再重算，状态保持settled，不退回matched')
  
  subSection('重算前状态')
  const beforeRecalc = unifiedStore.getRecords()
  beforeRecalc.forEach(r => {
    console.log(`    ${r.studentName}: ${r.status} (settledAt=${r.settledAt ? '有' : '无'}, amount=${r.settlementAmount})`)
  })

  subSection('执行 recalculateAfterSupplement 重算')
  const recalculated = recalculateAfterSupplement([...beforeRecalc])
  
  subSection('重算后状态')
  recalculated.forEach(r => {
    console.log(`    ${r.studentName}: ${r.status} (settledAt=${r.settledAt ? '有' : '无'}, amount=${r.settlementAmount})`)
  })

  check('小明重算后仍为settled', recalculated.find(r => r.studentName === '小明')?.status === RecordStatus.SETTLED, 
    `${recalculated.find(r => r.studentName === '小明')?.status}`)
  check('小红重算后仍为settled', recalculated.find(r => r.studentName === '小红')?.status === RecordStatus.SETTLED,
    `${recalculated.find(r => r.studentName === '小红')?.status}`)
  check('小花重算后仍为settled', recalculated.find(r => r.studentName === '小花')?.status === RecordStatus.SETTLED,
    `${recalculated.find(r => r.studentName === '小花')?.status}`)
  check('小刚重算后仍为settled', recalculated.find(r => r.studentName === '小刚')?.status === RecordStatus.SETTLED,
    `${recalculated.find(r => r.studentName === '小刚')?.status}`)
  
  check('小明分账时间未丢失', recalculated.find(r => r.studentName === '小明')?.settledAt === xiaoming3.settledAt, '')
  check('小明分账金额未丢失', recalculated.find(r => r.studentName === '小明')?.settlementAmount === 90, '')

  subSection('再次模拟补录群接龙，验证已分账记录不被修改')
  console.log('  尝试直接合并相同的群接龙数据（不重新导入批次）...')
  
  const { records: parsedGroupRecords } = parseGroupSignup(groupSignups, 'test-batch-reimport', '测试补录')
  const afterMerge = mergeGroupSignupToRecords([...recalculated], parsedGroupRecords)
  unifiedStore.setRecords(afterMerge)
  
  console.log('  补录后状态：')
  afterMerge.filter(r => r.status === RecordStatus.SETTLED).forEach(r => {
    console.log(`    ${r.studentName}: ${r.status}`)
  })
  
  check('补录后总记录还是4条（不新增）', afterMerge.length === 4, `${afterMerge.length}/4`)
  check('补录后4条仍为settled', afterMerge.filter(r => r.status === RecordStatus.SETTLED).length === 4, 
    `${afterMerge.filter(r => r.status === RecordStatus.SETTLED).length}/4`)

  section('Step 6: 五处数据一致性验证（页面/接口/历史/报告/导出）')
  
  subSection('页面展示')
  const page = unifiedStore.getForPageDisplay()
  console.log(`  记录数: ${page.records.length}`)
  console.log(`  已分账: ${page.summary.byStatus[RecordStatus.SETTLED]}`)
  console.log(`  状态分布: ${JSON.stringify(page.summary.byStatus)}`)

  subSection('接口返回')
  const api = unifiedStore.getForApiResponse()
  console.log(`  记录数: ${api.records.length}`)
  console.log(`  已分账: ${api.summary.byStatus[RecordStatus.SETTLED]}`)
  console.log(`  状态分布: ${JSON.stringify(api.summary.byStatus)}`)

  subSection('导出明细')
  const exp = unifiedStore.getForExport()
  console.log(`  记录数: ${exp.length}`)
  exp.forEach(r => {
    console.log(`    ${r.studentName}: 状态=${r.status}, 分账金额=${r.settlementAmount}, 分账时间=${r.settledAt || '-'}`)
  })

  subSection('变更历史（以小明为例）')
  const xiaomingFinal = unifiedStore.getRecords().find(r => r.studentName === '小明')!
  const trail = getRecordAuditTrail(xiaomingFinal)
  console.log(`  小明的完整变更历史（${trail.length} 条）:`)
  trail.forEach((t, i) => {
    console.log(`    ${i + 1}. ${t.timestamp} — ${t.action}${t.operator ? ' — ' + t.operator : ''}${t.reason ? ' — ' + t.reason : ''}`)
  })

  subSection('一致性检查')
  const pageStatuses = page.records.map(r => r.status).sort()
  const apiStatuses = api.records.map(r => r.status).sort()
  const expStatuses = exp.map(r => r.status).sort()
  
  check('页面与接口状态一致', JSON.stringify(pageStatuses) === JSON.stringify(apiStatuses), '')
  check('页面与导出状态一致', JSON.stringify(pageStatuses) === JSON.stringify(expStatuses), '')
  
  const consistencyIssues = verifyExportConsistency(page.records, exp)
  check('导出与系统数据完全一致', consistencyIssues.length === 0, consistencyIssues.length + '个不一致')

  subSection('从导出追回原始材料')
  const xiaomingExp = exp.find(r => r.studentName === '小明' && r.courseDate === '2026-06-01')!
  console.log(`  从导出追回小明的原始材料:`)
  console.log(`    调音师行号: ${xiaomingExp.tunerOriginalLineNumber}, 原文: ${xiaomingExp.tunerRawContent}`)
  console.log(`    群接龙行号: ${xiaomingExp.groupOriginalLineNumber}, 原文: ${xiaomingExp.groupRawContent}`)
  console.log(`    口径不一致: 调音师${xiaomingExp.courseTime} vs 群接龙${xiaomingExp.groupCourseTime}`)
  console.log(`    分账时间: ${xiaomingExp.settledAt}`)
  console.log(`    分账金额: ${xiaomingExp.settlementAmount}`)
  console.log(`    改动次数: ${xiaomingExp.manualEditsCount}`)
  
  check('导出可追回调音师原文', !!xiaomingExp.tunerRawContent, xiaomingExp.tunerRawContent)
  check('导出可追回群接龙原文', !!xiaomingExp.groupRawContent, xiaomingExp.groupRawContent)
  check('导出可追回分账时间', !!xiaomingExp.settledAt, xiaomingExp.settledAt)
  check('导出可追回分账金额', xiaomingExp.settlementAmount === 90, `${xiaomingExp.settlementAmount}`)
  check('导出可追回完整改动历史', xiaomingExp.manualEditsCount >= 3, `${xiaomingExp.manualEditsCount} 次改动`)

  section('Step 7: 临时替补（小刚）特别检查')
  const xiaogangFinal = unifiedStore.getRecords().find(r => r.studentName === '小刚')!
  const xiaogangPage = page.records.find(r => r.studentName === '小刚')!
  const xiaogangApi = api.records.find(r => r.studentName === '小刚')!
  const xiaogangExport = exp.find(r => r.studentName === '小刚')!
  
  console.log(`  页面: 状态=${xiaogangPage.status}, 复核=${xiaogangPage.reviewFlag}`)
  console.log(`  接口: 状态=${xiaogangApi.status}, 复核=${xiaogangApi.reviewFlag}`)
  console.log(`  导出: 状态=${xiaogangExport.status}, 复核=${xiaogangExport.reviewFlag}`)
  console.log(`  系统: 状态=${xiaogangFinal.status}, 复核=${xiaogangFinal.reviewFlag}`)
  
  check('小刚在页面正常显示（不消失）', !!xiaogangPage, '')
  check('小刚在接口正常返回（不消失）', !!xiaogangApi, '')
  check('小刚在导出正常显示（不消失）', !!xiaogangExport, '')
  check('小刚四处状态一致', 
    xiaogangPage.status === xiaogangApi.status && 
    xiaogangPage.status === xiaogangExport.status &&
    xiaogangPage.status === xiaogangFinal.status,
    xiaogangPage.status)

  section('最终验证总结')
  const finalPage = unifiedStore.getForPageDisplay()
  const finalSettled = finalPage.records.filter(r => r.status === RecordStatus.SETTLED).length
  
  console.log(`\n  最终状态分布:`)
  Object.entries(finalPage.summary.byStatus).forEach(([k, v]) => {
    if (v > 0) console.log(`    ${k}: ${v}`)
  })
  
  check('最终4条全部settled', finalSettled === 4, `${finalSettled}/4`)
  check('工作流全部收口', isWorkflowDone(s3Workflow), '')
  check('分账后重算不退回', recalculated.every(r => r.status === RecordStatus.SETTLED), '')
  check('五处数据一致', 
    JSON.stringify(pageStatuses) === JSON.stringify(apiStatuses) && 
    JSON.stringify(pageStatuses) === JSON.stringify(expStatuses), '')
  
  const allChecks = [
    records.length === 4,
    finalSettled === 4,
    isWorkflowDone(s3Workflow),
    recalculated.every(r => r.status === RecordStatus.SETTLED),
    JSON.stringify(pageStatuses) === JSON.stringify(apiStatuses),
    JSON.stringify(pageStatuses) === JSON.stringify(expStatuses),
    consistencyIssues.length === 0
  ]
  
  allPassed = allChecks.every(Boolean)

  console.log(`\n${allPassed ? '\x1b[32m✅ 全部验证通过\x1b[0m' : '\x1b[31m❌ 存在验证失败\x1b[0m'}`)
  console.log(`\n可复现的运行记录已保存，可执行: node dist/validation.js 重新复现`)
  
  return allPassed ? 0 : 1
}

process.exit(runFullValidation())
