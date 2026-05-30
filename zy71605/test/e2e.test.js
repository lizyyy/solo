const path = require('path')
const fs = require('fs')
const { Store } = require('../src/store')
const { splitBalance, checkBonusAsCashIssue, checkDuplicateImport, validateFrozenBalance, fullBalanceAudit } = require('../src/balance')
const { executeMigration, rollbackMigration, supplementMigration, batchMigrate, checkIdempotent } = require('../src/migration')
const { storeSummary, reconcileStore, fullReconciliation, crossStoreDiff } = require('../src/reconcile')
const { buildTimeline, replayTimeline, getCardHistory } = require('../src/timeline')
const { filterMigrationRecords, filterMembers } = require('../src/filter')
const { exportReport, generateReport } = require('../src/report')
const {
  createMemberCard, createStoredValueRecord, createBonusRule,
  createFreezeRecord, createStore, MIGRATION_STATUS
} = require('../src/models')

const tmpDir = path.join(__dirname, '_tmp_test_data')
let store
let passed = 0
let failed = 0

function assert(cond, msg) {
  if (cond) {
    passed++
  } else {
    failed++
    console.log(`  ❌ FAIL: ${msg}`)
  }
}

function setup() {
  if (fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true })
  }
  fs.mkdirSync(tmpDir, { recursive: true })
  store = new Store(tmpDir)

  store.add('stores', createStore({ store_id: 'S001', name: '中关村店', region: '北京' }))
  store.add('stores', createStore({ store_id: 'S002', name: '朝阳店', region: '北京' }))
  store.add('stores', createStore({ store_id: 'S003', name: '目标店', region: '总部' }))

  store.add('members', createMemberCard({ card_id: 'C001', name: '张三', store_id: 'S001', stored_value: 500, bonus: 50, frozen: 0, source: 'system' }))
  store.add('members', createMemberCard({ card_id: 'C002', name: '李四', store_id: 'S001', stored_value: 0, bonus: 200, frozen: 0, source: 'system' }))
  store.add('members', createMemberCard({ card_id: 'C003', name: '王五', store_id: 'S001', stored_value: 300, bonus: 30, frozen: 100, source: 'system' }))
  store.add('members', createMemberCard({ card_id: 'C004', name: '赵六', store_id: 'S002', stored_value: 800, bonus: 80, frozen: 0, source: 'system' }))
  store.add('members', createMemberCard({ card_id: 'C005', name: '孙七', store_id: 'S002', stored_value: 200, bonus: 500, frozen: 50, source: 'manual' }))

  store.add('freezeRecords', createFreezeRecord({ card_id: 'C003', amount: 100, reason: '疑似盗刷', status: 'frozen', source: 'system' }))
  store.add('freezeRecords', createFreezeRecord({ card_id: 'C005', amount: 50, reason: '客诉冻结', status: 'frozen', source: 'manual' }))

  store.add('bonusRules', createBonusRule({ name: '充500送50', threshold: 500, bonus_ratio: 0.1, store_id: 'S001', source: 'system' }))

  store.save()
}

function testBalanceSplit() {
  console.log('\n📋 测试余额拆分')
  const member = store.find('members', m => m.card_id === 'C001')
  const split = splitBalance(member)
  assert(split.stored_value === 500, 'C001 储值应为500')
  assert(split.bonus === 50, 'C001 赠金应为50')
  assert(split.frozen === 0, 'C001 冻结应为0')
  assert(split.total === 550, 'C001 合计应为550')

  const member3 = store.find('members', m => m.card_id === 'C003')
  const split3 = splitBalance(member3)
  assert(split3.stored_value === 300, 'C003 储值应为300')
  assert(split3.bonus === 30, 'C003 赠金应为30')
  assert(split3.frozen === 100, 'C003 冻结应为100')
  assert(split3.total === 430, 'C003 合计应为430')
}

function testBonusAsCash() {
  console.log('\n📋 测试赠金当现金问题检测')
  const member2 = store.find('members', m => m.card_id === 'C002')
  const check2 = checkBonusAsCashIssue(member2)
  assert(check2.hasIssue === true, 'C002 储值0赠金200应检测为问题')
  assert(check2.detail.includes('储值为0'), '应提示储值为0')

  const member5 = store.find('members', m => m.card_id === 'C005')
  const check5 = checkBonusAsCashIssue(member5)
  assert(check5.hasIssue === true, 'C005 赠金500>储值200应检测为问题')
  assert(check5.detail.includes('赠金'), '应提示赠金问题')
}

function testDuplicateImport() {
  console.log('\n📋 测试重复导入检测')
  store.add('members', createMemberCard({ card_id: 'C001', name: '张三', store_id: 'S001', stored_value: 500, bonus: 50, frozen: 0, source: 'manual' }))
  const members = store.get('members')
  const dupes = checkDuplicateImport(members)
  assert(dupes.length === 1, '应检测到1个重复卡号')
  assert(dupes[0].card_id === 'C001', '重复卡号应为C001')
}

function testFrozenValidation() {
  console.log('\n📋 测试冻结余额校验')
  const member3 = store.find('members', m => m.card_id === 'C003')
  const freezeRecords = store.get('freezeRecords')
  const check3 = validateFrozenBalance(member3, freezeRecords)
  assert(check3.valid === true, 'C003 冻结金额与记录一致')
  assert(check3.actualFrozen === 100, 'C003 实际冻结合计应为100')

  const member1 = store.find('members', m => m.card_id === 'C001')
  const check1 = validateFrozenBalance(member1, freezeRecords)
  assert(check1.valid === true, 'C001 无冻结金额应通过校验')
}

function testFullAudit() {
  console.log('\n📋 测试完整审计')
  const members = store.get('members')
  const freezeRecords = store.get('freezeRecords')
  const audit = fullBalanceAudit(members, freezeRecords)
  assert(audit.summary.totalMembers > 0, '总会员数应大于0')
  assert(audit.bonusIssues.length > 0, '应检测到赠金问题')
  assert(audit.duplicateIssues.length > 0, '应检测到重复导入')
}

function testMigrationIdempotent() {
  console.log('\n📋 测试迁移幂等')
  const result1 = executeMigration(store, {
    cardId: 'C001',
    fromStore: 'S001',
    toStore: 'S003',
    batchId: 'batch_test_1',
    operator: 'tester'
  })
  assert(result1.success === true, '首次迁移应成功')
  assert(result1.migration.status === MIGRATION_STATUS.MIGRATED, '状态应为migrated')

  const result2 = executeMigration(store, {
    cardId: 'C001',
    fromStore: 'S001',
    toStore: 'S003',
    batchId: 'batch_test_1',
    operator: 'tester'
  })
  assert(result2.success === false, '同批次重复迁移应失败')
  assert(result2.detail.includes('重复'), '应提示重复')

  const result3 = executeMigration(store, {
    cardId: 'C001',
    fromStore: 'S001',
    toStore: 'S003',
    batchId: 'batch_test_2',
    operator: 'tester'
  })
  assert(result3.success === false, '同卡号已有非撤回迁移应失败')
}

function testMigrationWithFrozen() {
  console.log('\n📋 测试冻结余额迁移')
  const result = executeMigration(store, {
    cardId: 'C003',
    fromStore: 'S001',
    toStore: 'S003',
    batchId: 'batch_frozen_1',
    operator: 'tester'
  })
  assert(result.success === true, '冻结余额迁移应成功')
  assert(result.frozenTotal === 100, '冻结金额应为100')
  assert(result.after.frozen_migrated === true, '应标记冻结已迁出')
  assert(result.after.frozen_amount === 100, '迁出冻结金额应为100')

  const member = store.find('members', m => m.card_id === 'C003')
  assert(member.store_id === 'S003', '迁移后门店应为S003')
}

function testRollback() {
  console.log('\n📋 测试撤回迁移')
  executeMigration(store, {
    cardId: 'C004',
    fromStore: 'S002',
    toStore: 'S003',
    batchId: 'batch_rb_1',
    operator: 'tester'
  })

  const member = store.find('members', m => m.card_id === 'C004')
  assert(member.store_id === 'S003', '迁移后门店应为S003')

  const mig = store.find('migrationRecords', r => r.card_id === 'C004')
  const rollback = rollbackMigration(store, { migrationId: mig.migration_id, operator: 'tester' })
  assert(rollback.success === true, '撤回应成功')

  const memberAfter = store.find('members', m => m.card_id === 'C004')
  assert(memberAfter.store_id === 'S002', '撤回后门店应恢复为S002')

  const rollback2 = rollbackMigration(store, { migrationId: mig.migration_id, operator: 'tester' })
  assert(rollback2.success === false, '重复撤回应失败')
}

function testSupplement() {
  console.log('\n📋 测试补录修正')
  executeMigration(store, {
    cardId: 'C005',
    fromStore: 'S002',
    toStore: 'S003',
    batchId: 'batch_supp_1',
    operator: 'tester'
  })

  const mig = store.find('migrationRecords', r => r.card_id === 'C005')
  const result = supplementMigration(store, {
    migrationId: mig.migration_id,
    supplementData: {
      split: { stored_value: 200, bonus: 500, frozen: 50 },
      note: '确认赠金金额无误'
    },
    operator: 'tester'
  })
  assert(result.success === true, '补录应成功')
  assert(result.after.split.bonus === 500, '补录后赠金应为500')
  assert(result.after.supplement_note === '确认赠金金额无误', '补录备注应正确')

  const updated = store.find('migrationRecords', r => r.card_id === 'C005')
  assert(updated.status === MIGRATION_STATUS.SUPPLEMENTED, '状态应为supplemented')
}

function testBatchMigration() {
  console.log('\n📋 测试批量迁移')
  store.add('members', createMemberCard({ card_id: 'C010', name: '测试A', store_id: 'S001', stored_value: 100, bonus: 10, frozen: 0, source: 'system' }))
  store.add('members', createMemberCard({ card_id: 'C011', name: '测试B', store_id: 'S001', stored_value: 200, bonus: 20, frozen: 0, source: 'system' }))

  const result = batchMigrate(store, {
    cardIds: ['C010', 'C011'],
    fromStore: 'S001',
    toStore: 'S003',
    operator: 'tester',
    note: '批量测试'
  })
  assert(result.allSuccess === true, '批量迁移应全部成功')
  assert(result.results.length === 2, '应成功2条')

  const m10 = store.find('members', m => m.card_id === 'C010')
  assert(m10.store_id === 'S003', 'C010应已迁至S003')
  const m11 = store.find('members', m => m.card_id === 'C011')
  assert(m11.store_id === 'S003', 'C011应已迁至S003')
}

function testTimeline() {
  console.log('\n📋 测试时间轴')
  const events = buildTimeline(store, {})
  assert(events.length > 0, '应有时间轴事件')

  const replay = replayTimeline(store, {})
  assert(replay.events.length > 0, '回放事件数应大于0')
  assert(replay.finalStates.length > 0, '最终状态数应大于0')

  const history = getCardHistory(store, 'C003')
  assert(history.event_count > 0, 'C003应有历史事件')
  assert(history.migration_count > 0, 'C003应有迁移记录')
}

function testFilter() {
  console.log('\n📋 测试筛选')
  const filtered = filterMembers(store, { store_id: 'S002' })
  assert(filtered.length > 0, 'S002门店应有会员')

  const migRecords = filterMigrationRecords(store, { status: 'migrated' })
  assert(migRecords.length > 0, '应有已迁移记录')

  const manualMembers = filterMembers(store, { source: 'manual' })
  assert(manualMembers.length > 0, '应有人工录入会员')

  const frozenMembers = filterMembers(store, { has_frozen: true })
  assert(frozenMembers.length > 0, '应有冻结金额会员')
}

function testReconciliation() {
  console.log('\n📋 测试门店对账')
  const summaries = storeSummary(store)
  assert(summaries.length > 0, '应有门店汇总')

  const recon = fullReconciliation(store)
  assert(recon.length > 0, '应有对账结果')

  const s001Recon = reconcileStore(store, 'S001')
  assert(s001Recon.store_id === 'S001', '应对账S001')
}

function testReport() {
  console.log('\n📋 测试报告导出')
  const report = generateReport(store, {})
  assert(report.summary !== undefined, '报告应包含概览')
  assert(report.migrations !== undefined, '报告应包含迁移记录')
  assert(report.reconciliation !== undefined, '报告应包含对账')
  assert(report.timeline !== undefined, '报告应包含时间轴')

  const jsonPath = path.join(tmpDir, 'test_report.json')
  const { path: jp } = exportReport(store, jsonPath, 'json', {})
  assert(fs.existsSync(jp), 'JSON报告文件应存在')

  const mdPath = path.join(tmpDir, 'test_report.md')
  const { path: mp } = exportReport(store, mdPath, 'markdown', {})
  assert(fs.existsSync(mp), 'Markdown报告文件应存在')

  const jsonContent = JSON.parse(fs.readFileSync(jp, 'utf-8'))
  assert(jsonContent.summary !== undefined, 'JSON内容应包含概览')

  const mdContent = fs.readFileSync(mp, 'utf-8')
  assert(mdContent.includes('跨店储值余额迁移报告'), 'Markdown应包含标题')
  assert(mdContent.includes('迁移明细'), 'Markdown应包含迁移明细')
  assert(mdContent.includes('门店对账'), 'Markdown应包含门店对账')
}

function testFilteredReport() {
  console.log('\n📋 测试筛选后报告导出')
  const filters = {
    memberFilters: { store_id: 'S003' },
    migrationFilters: { to_store: 'S003' }
  }
  const report = generateReport(store, filters)
  assert(report.members !== undefined, '筛选报告应包含会员')

  for (const m of report.members) {
    assert(m.store_id === 'S003', `筛选后会员门店应为S003，实际为${m.store_id}`)
  }
}

function cleanup() {
  if (fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true })
  }
}

function run() {
  console.log('🧪 开始端到端测试\n')
  setup()

  try {
    testBalanceSplit()
    testBonusAsCash()
    testDuplicateImport()
    testFrozenValidation()
    testFullAudit()
    testMigrationIdempotent()
    testMigrationWithFrozen()
    testRollback()
    testSupplement()
    testBatchMigration()
    testTimeline()
    testFilter()
    testReconciliation()
    testReport()
    testFilteredReport()

    console.log(`\n${'═'.repeat(40)}`)
    console.log(`  ✅ 通过: ${passed}  ❌ 失败: ${failed}`)
    console.log(`${'═'.repeat(40)}\n`)
  } finally {
    cleanup()
  }

  if (failed > 0) process.exit(1)
}

run()
