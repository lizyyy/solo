const readline = require('readline')
const { Store } = require('./store')
const { splitBalance, fullBalanceAudit, checkBonusAsCashIssue, validateFrozenBalance, checkDuplicateImport } = require('./balance')
const { executeMigration, rollbackMigration, supplementMigration, batchMigrate, checkIdempotent } = require('./migration')
const { storeSummary, reconcileStore, fullReconciliation, crossStoreDiff } = require('./reconcile')
const { buildTimeline, replayTimeline, getCardHistory } = require('./timeline')
const { filterMigrationRecords, filterMembers } = require('./filter')
const { exportReport, generateReport } = require('./report')
const {
  createMemberCard, createStoredValueRecord, createBonusRule,
  createFreezeRecord, createStore, MIGRATION_STATUS
} = require('./models')

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

const prompt = (q) => new Promise(resolve => rl.question(q, resolve))

let store = new Store()
let currentFilters = {
  memberFilters: {},
  migrationFilters: {},
  timelineFilters: {}
}

function fmt(n) { return Number(n).toFixed(2) }

function printSeparator() { console.log('─'.repeat(70)) }

function printTitle(t) {
  console.log('')
  printSeparator()
  console.log(`  ${t}`)
  printSeparator()
}

function printBalanceSplit(member) {
  const sp = splitBalance(member)
  console.log(`  卡号: ${member.card_id}  姓名: ${member.name}  门店: ${member.store_id}  来源: ${member.source}`)
  console.log(`  ┌─────────┬──────────┐`)
  console.log(`  │ 储值余额 │ ${fmt(sp.stored_value).padStart(10)} │`)
  console.log(`  │ 赠金余额 │ ${fmt(sp.bonus).padStart(10)} │`)
  console.log(`  │ 冻结金额 │ ${fmt(sp.frozen).padStart(10)} │`)
  console.log(`  ├─────────┼──────────┤`)
  console.log(`  │ 合计     │ ${fmt(sp.total).padStart(10)} │`)
  console.log(`  └─────────┴──────────┘`)
}

function printMigrationRecord(mig) {
  const bs = mig.before_snapshot?.split || {}
  const as_ = mig.after_snapshot?.split || {}
  console.log(`  迁移ID: ${mig.migration_id}`)
  console.log(`  卡号: ${mig.card_id}  ${mig.from_store} → ${mig.to_store}  状态: ${mig.status}`)
  console.log(`  储值: ${fmt(bs.stored_value || 0)} → ${fmt(as_.stored_value || 0)}`)
  console.log(`  赠金: ${fmt(bs.bonus || 0)} → ${fmt(as_.bonus || 0)}`)
  console.log(`  冻结: ${fmt(bs.frozen || 0)} → ${fmt(as_.frozen || 0)}`)
  console.log(`  来源: ${mig.source}  操作人: ${mig.operator}  时间: ${mig.created_at}`)
  if (mig.after_snapshot?.frozen_migrated) {
    console.log(`  💡 冻结金额 ${mig.after_snapshot.frozen_amount} 已随余额迁出至新账`)
  }
}

function printAuditResult(audit) {
  console.log(`  总会员数: ${audit.summary.totalMembers}`)
  console.log(`  赠金问题: ${audit.summary.bonusIssueCount} 条`)
  console.log(`  冻结问题: ${audit.summary.frozenIssueCount} 条`)
  console.log(`  重复导入: ${audit.summary.duplicateIssueCount} 条`)

  if (audit.bonusIssues.length > 0) {
    console.log('')
    console.log('  ⚠️  赠金当现金问题（赠金可能被当成现金使用）：')
    for (const issue of audit.bonusIssues) {
      console.log(`    卡号 ${issue.card_id}：储值 ${issue.stored_value}，赠金 ${issue.bonus} — ${issue.detail}`)
    }
  }

  if (audit.frozenIssues.length > 0) {
    console.log('')
    console.log('  ❄️  冻结余额校验问题：')
    for (const issue of audit.frozenIssues) {
      console.log(`    卡号 ${issue.card_id}：卡面 ${issue.declaredFrozen}，记录合计 ${issue.actualFrozen}，差额 ${issue.diff} — ${issue.detail}`)
    }
  }

  if (audit.duplicateIssues.length > 0) {
    console.log('')
    console.log('  🔄 重复导入：')
    for (const issue of audit.duplicateIssues) {
      console.log(`    卡号 ${issue.card_id}：${issue.detail}`)
    }
  }

  if (audit.bonusIssues.length === 0 && audit.frozenIssues.length === 0 && audit.duplicateIssues.length === 0) {
    console.log('  ✅ 未发现问题')
  }
}

function printReconciliation(results) {
  for (const recon of results) {
    console.log(`  门店 ${recon.store_id}：`)
    console.log(`    会员数: ${recon.current_members}  储值: ${fmt(recon.current_balance.stored_value)}  赠金: ${fmt(recon.current_balance.bonus)}  冻结: ${fmt(recon.current_balance.frozen)}`)
    console.log(`    迁入: ${recon.migrated_in.count} 笔  迁出: ${recon.migrated_out.count} 笔  撤回: ${recon.rolled_back} 笔`)
    if (recon.hasAnomaly) {
      console.log(`    ⚠️  差异：${recon.anomalyDetail}`)
    } else {
      console.log('    ✅ 无差异')
    }
  }
}

async function mainMenu() {
  while (true) {
    console.log('')
    printSeparator()
    console.log('  🔀 跨店储值余额迁移工具')
    printSeparator()
    console.log('  1. 查看会员余额（拆分显示储值/赠金/冻结）')
    console.log('  2. 余额审计（赠金/冻结/重复拆开看）')
    console.log('  3. 执行迁移（单卡/批量）')
    console.log('  4. 撤回迁移')
    console.log('  5. 补录修正')
    console.log('  6. 迁移记录查询（支持筛选）')
    console.log('  7. 门店对账')
    console.log('  8. 时间轴 / 历史回放')
    console.log('  9. 导出报告（Markdown / JSON）')
    console.log('  10. 加载示例数据')
    console.log('  11. 设置当前筛选范围')
    console.log('  0. 退出')
    printSeparator()
    const choice = await prompt('  请选择操作 > ')
    switch (choice.trim()) {
      case '1': await viewMembers(); break
      case '2': await auditBalances(); break
      case '3': await doMigration(); break
      case '4': await doRollback(); break
      case '5': await doSupplement(); break
      case '6': await viewMigrations(); break
      case '7': await doReconciliation(); break
      case '8': await viewTimeline(); break
      case '9': await doExport(); break
      case '10': await loadSampleData(); break
      case '11': await setFilters(); break
      case '0': rl.close(); return
      default: console.log('  未知选项，请重新选择')
    }
  }
}

async function viewMembers() {
  printTitle('📋 会员余额拆分')
  const members = filterMembers(store, currentFilters.memberFilters)
  if (members.length === 0) {
    console.log('  暂无会员数据，请先加载或导入数据')
    return
  }
  for (const m of members) {
    printBalanceSplit(m)
    console.log('')
  }
  console.log(`  共 ${members.length} 条记录`)
}

async function auditBalances() {
  printTitle('🔍 余额审计')
  const members = filterMembers(store, currentFilters.memberFilters)
  if (members.length === 0) {
    console.log('  暂无会员数据')
    return
  }
  const freezeRecords = store.get('freezeRecords')
  const audit = fullBalanceAudit(members, freezeRecords)
  printAuditResult(audit)
}

async function doMigration() {
  printTitle('🔀 执行迁移')
  console.log('  1. 单卡迁移')
  console.log('  2. 批量迁移（按来源门店）')
  const sub = await prompt('  选择 > ')
  if (sub.trim() === '1') {
    const cardId = await prompt('  卡号 > ')
    const member = store.find('members', m => m.card_id === cardId)
    if (!member) {
      console.log(`  ❌ 找不到卡号 ${cardId}`)
      return
    }
    printBalanceSplit(member)
    const toStoreId = await prompt('  迁入门店ID > ')
    const operator = await prompt('  操作人（留空为system）> ')
    const source = await prompt('  数据来源（system/manual，留空为system）> ')

    const frozenRecords = store.filter('freezeRecords', f => f.card_id === cardId && f.status === 'frozen')
    if (frozenRecords.length > 0) {
      const frozenTotal = frozenRecords.reduce((s, f) => s + f.amount, 0)
      console.log(`  ❄️  该卡有冻结金额 ${frozenTotal}，将随余额一并迁出至新账`)
      const confirm = await prompt('  确认继续？(y/n) > ')
      if (confirm.trim().toLowerCase() !== 'y') {
        console.log('  已取消')
        return
      }
    }

    const idempCheck = checkIdempotent(store, cardId, 'single')
    if (!idempCheck.isIdempotent) {
      console.log(`  ⚠️  ${idempCheck.detail}`)
      console.log('  如果确认需要重新迁移，请使用新的批次')
      const force = await prompt('  仍然继续（将使用新批次）？(y/n) > ')
      if (force.trim().toLowerCase() !== 'y') {
        console.log('  已取消')
        return
      }
    }

    const result = executeMigration(store, {
      cardId,
      fromStore: member.store_id,
      toStore: toStoreId,
      batchId: `single_${Date.now()}`,
      operator: operator || 'system',
      source: source || 'system'
    })

    if (result.success) {
      store.save()
      console.log('  ✅ 迁移成功！')
      console.log('')
      console.log('  迁移前快照：')
      console.log(`    门店: ${result.before.store_id}  储值: ${fmt(result.before.split.stored_value)}  赠金: ${fmt(result.before.split.bonus)}  冻结: ${fmt(result.before.split.frozen)}`)
      console.log('  迁移后快照：')
      console.log(`    门店: ${result.after.store_id}  储值: ${fmt(result.after.split.stored_value)}  赠金: ${fmt(result.after.split.bonus)}  冻结: ${fmt(result.after.split.frozen)}`)
      if (result.frozenTotal > 0) {
        console.log(`  💡 冻结金额 ${fmt(result.frozenTotal)} 已随余额迁出至新账`)
      }
    } else {
      console.log(`  ❌ 迁移失败：${result.detail}`)
    }
  } else if (sub.trim() === '2') {
    const fromStoreId = await prompt('  来源门店ID > ')
    const toStoreId = await prompt('  目标门店ID > ')
    const operator = await prompt('  操作人（留空为system）> ')
    const note = await prompt('  批次备注 > ')

    const members = store.filter('members', m => m.store_id === fromStoreId)
    if (members.length === 0) {
      console.log(`  门店 ${fromStoreId} 无会员`)
      return
    }

    console.log(`  将迁移 ${members.length} 张卡从 ${fromStoreId} 到 ${toStoreId}`)
    const frozenMembers = members.filter(m => (m.balance?.frozen || 0) > 0)
    if (frozenMembers.length > 0) {
      console.log(`  ❄️  其中 ${frozenMembers.length} 张卡有冻结金额，将随余额一并迁出至新账`)
    }
    const confirm = await prompt('  确认执行？(y/n) > ')
    if (confirm.trim().toLowerCase() !== 'y') {
      console.log('  已取消')
      return
    }

    const result = batchMigrate(store, {
      cardIds: members.map(m => m.card_id),
      fromStore: fromStoreId,
      toStore: toStoreId,
      operator: operator || 'system',
      note
    })

    store.save()
    console.log(`  ✅ 批次 ${result.batch.batch_id} 完成`)
    console.log(`  成功: ${result.results.length}  失败: ${result.errors.length}`)
    if (result.errors.length > 0) {
      console.log('  失败明细：')
      for (const e of result.errors) {
        console.log(`    卡号 ${e.card_id}：${e.detail}`)
      }
    }
  }
}

async function doRollback() {
  printTitle('⏪ 撤回迁移')
  const migrationId = await prompt('  迁移记录ID > ')
  const operator = await prompt('  操作人（留空为system）> ')

  const mig = store.find('migrationRecords', r => r.migration_id === migrationId)
  if (mig) {
    console.log('  即将撤回的迁移：')
    printMigrationRecord(mig)
    const confirm = await prompt('  确认撤回？(y/n) > ')
    if (confirm.trim().toLowerCase() !== 'y') {
      console.log('  已取消')
      return
    }
  }

  const result = rollbackMigration(store, { migrationId, operator: operator || 'system' })
  if (result.success) {
    store.save()
    console.log('  ✅ 撤回成功！')
    console.log(`  门店已从 ${result.migration.to_store} 恢复为 ${result.migration.before_snapshot.store_id}`)
  } else {
    console.log(`  ❌ 撤回失败：${result.detail}`)
  }
}

async function doSupplement() {
  printTitle('📝 补录修正')
  const migrationId = await prompt('  迁移记录ID > ')
  const mig = store.find('migrationRecords', r => r.migration_id === migrationId)
  if (!mig) {
    console.log(`  ❌ 找不到迁移记录 ${migrationId}`)
    return
  }
  console.log('  当前迁移记录：')
  printMigrationRecord(mig)

  console.log('  请输入修正后的余额（留空表示不修改）：')
  const storedValue = await prompt('  储值 > ')
  const bonus = await prompt('  赠金 > ')
  const frozen = await prompt('  冻结 > ')
  const note = await prompt('  修正原因 > ')
  const operator = await prompt('  操作人 > ')

  const supplementData = { note }
  const newSplit = { ...mig.after_snapshot.split }
  if (storedValue.trim()) newSplit.stored_value = Number(storedValue)
  if (bonus.trim()) newSplit.bonus = Number(bonus)
  if (frozen.trim()) newSplit.frozen = Number(frozen)
  supplementData.split = newSplit

  const result = supplementMigration(store, {
    migrationId,
    supplementData,
    operator: operator || 'system'
  })

  if (result.success) {
    store.save()
    console.log('  ✅ 补录修正成功！')
    console.log('  修正前：')
    console.log(`    储值: ${fmt(result.before.split?.stored_value || 0)}  赠金: ${fmt(result.before.split?.bonus || 0)}  冻结: ${fmt(result.before.split?.frozen || 0)}`)
    console.log('  修正后：')
    console.log(`    储值: ${fmt(result.after.split?.stored_value || 0)}  赠金: ${fmt(result.after.split?.bonus || 0)}  冻结: ${fmt(result.after.split?.frozen || 0)}`)
  } else {
    console.log(`  ❌ 补录失败：${result.detail}`)
  }
}

async function viewMigrations() {
  printTitle('📋 迁移记录查询')
  console.log('  筛选条件（留空跳过）：')
  const cardId = await prompt('  卡号 > ')
  const fromStore = await prompt('  来源门店 > ')
  const toStore = await prompt('  目标门店 > ')
  const status = await prompt('  状态(migrated/rolled_back/supplemented) > ')

  const filters = { ...currentFilters.migrationFilters }
  if (cardId.trim()) filters.card_id = cardId.trim()
  if (fromStore.trim()) filters.from_store = fromStore.trim()
  if (toStore.trim()) filters.to_store = toStore.trim()
  if (status.trim()) filters.status = status.trim()

  const records = filterMigrationRecords(store, filters)
  if (records.length === 0) {
    console.log('  无匹配记录')
    return
  }

  for (const mig of records) {
    printMigrationRecord(mig)
    console.log('')
  }
  console.log(`  共 ${records.length} 条记录`)

  currentFilters.migrationFilters = filters
  console.log('  💡 筛选条件已更新，导出报告将使用此范围')
}

async function doReconciliation() {
  printTitle('📊 门店对账')
  console.log('  1. 全部门店对账')
  console.log('  2. 单门店对账')
  console.log('  3. 跨门店差异')
  const sub = await prompt('  选择 > ')

  if (sub.trim() === '1') {
    const results = fullReconciliation(store)
    printReconciliation(results)
  } else if (sub.trim() === '2') {
    const storeId = await prompt('  门店ID > ')
    const result = reconcileStore(store, storeId)
    printReconciliation([result])
  } else if (sub.trim() === '3') {
    const fromId = await prompt('  来源门店ID > ')
    const toId = await prompt('  目标门店ID > ')
    const diff = crossStoreDiff(store, fromId, toId)
    console.log(`  迁移笔数: ${diff.migrated.count}`)
    console.log(`  迁移金额: 储值 ${fmt(diff.migrated.amount.stored_value)}  赠金 ${fmt(diff.migrated.amount.bonus)}  冻结 ${fmt(diff.migrated.amount.frozen)}  合计 ${fmt(diff.migrated.amount.total)}`)
  }
}

async function viewTimeline() {
  printTitle('🕐 时间轴 / 历史回放')
  console.log('  1. 查看时间轴')
  console.log('  2. 按卡号查看历史')
  console.log('  3. 历史回放')
  const sub = await prompt('  选择 > ')

  if (sub.trim() === '1') {
    const events = buildTimeline(store, currentFilters.timelineFilters)
    if (events.length === 0) {
      console.log('  暂无时间轴事件')
      return
    }
    for (const evt of events) {
      const actionLabel = { migrate: '🔀 迁移', rollback: '⏪ 撤回', supplement: '📝 补录' }[evt.action] || evt.action
      console.log(`  ${evt.created_at}  ${actionLabel}  卡号${evt.card_id}  ${evt.detail}  [${evt.operator}]`)
    }
    currentFilters.timelineFilters = currentFilters.timelineFilters || {}
    console.log(`  共 ${events.length} 条事件`)
  } else if (sub.trim() === '2') {
    const cardId = await prompt('  卡号 > ')
    const history = getCardHistory(store, cardId)
    console.log(`  卡号 ${cardId} 共 ${history.event_count} 条事件，${history.migration_count} 条迁移`)
    for (const item of history.timeline) {
      console.log(`  ${item.time}  ${item.action}  ${item.detail}  [${item.operator}]`)
    }
    if (history.migrations.length > 0) {
      console.log('')
      console.log('  迁移记录：')
      for (const mig of history.migrations) {
        console.log(`  ${mig.migration_id}: ${mig.from_store}→${mig.to_store} (${mig.status})`)
        if (mig.before) console.log(`    前: 储值${mig.before.stored_value} 赠金${mig.before.bonus} 冻结${mig.before.frozen}`)
        if (mig.after) console.log(`    后: 储值${mig.after.stored_value} 赠金${mig.after.bonus} 冻结${mig.after.frozen}`)
      }
    }
  } else if (sub.trim() === '3') {
    const replay = replayTimeline(store, currentFilters.timelineFilters)
    console.log(`  共 ${replay.events.length} 条事件，涉及 ${replay.finalStates.length} 张卡`)
    for (const step of replay.states) {
      const evt = step.event
      const actionLabel = { migrate: '🔀', rollback: '⏪', supplement: '📝' }[evt.action] || evt.action
      console.log(`  ${evt.created_at}  ${actionLabel} 卡号${evt.card_id}`)
      console.log(`    ${evt.detail}`)
      if (step.prevState) {
        console.log(`    状态变化: ${step.prevState.status} → ${step.currentState.status}`)
      }
    }
  }
}

async function doExport() {
  printTitle('📤 导出报告')
  const format = await prompt('  格式 (json/markdown/both) > ')
  const outputPath = await prompt('  输出路径前缀（留空为 ./migration_report）> ')

  const base = outputPath.trim() || './migration_report'

  console.log('  💡 导出将使用当前筛选范围，确保与屏幕显示一致')

  if (format.trim() === 'json' || format.trim() === 'both') {
    const { path: p } = exportReport(store, base, 'json', currentFilters)
    console.log(`  ✅ JSON 报告已导出: ${p}`)
  }
  if (format.trim() === 'markdown' || format.trim() === 'both') {
    const { path: p } = exportReport(store, base, 'markdown', currentFilters)
    console.log(`  ✅ Markdown 报告已导出: ${p}`)
  }
}

async function setFilters() {
  printTitle('🔧 设置筛选范围')
  console.log('  当前筛选范围：')
  console.log(`  会员筛选: ${JSON.stringify(currentFilters.memberFilters)}`)
  console.log(`  迁移筛选: ${JSON.stringify(currentFilters.migrationFilters)}`)
  console.log(`  时间轴筛选: ${JSON.stringify(currentFilters.timelineFilters)}`)
  console.log('')
  console.log('  1. 设置会员筛选')
  console.log('  2. 设置迁移筛选')
  console.log('  3. 设置时间轴筛选')
  console.log('  4. 清除所有筛选')
  const sub = await prompt('  选择 > ')

  if (sub.trim() === '1') {
    const storeId = await prompt('  门店ID（留空跳过）> ')
    const source = await prompt('  来源 system/manual（留空跳过）> ')
    const hasFrozen = await prompt('  仅显示有冻结的？(y/n) > ')
    const hasBonus = await prompt('  仅显示有赠金的？(y/n) > ')
    currentFilters.memberFilters = {}
    if (storeId.trim()) currentFilters.memberFilters.store_id = storeId.trim()
    if (source.trim()) currentFilters.memberFilters.source = source.trim()
    if (hasFrozen.trim().toLowerCase() === 'y') currentFilters.memberFilters.has_frozen = true
    if (hasBonus.trim().toLowerCase() === 'y') currentFilters.memberFilters.has_bonus = true
    console.log('  ✅ 会员筛选已更新')
  } else if (sub.trim() === '2') {
    const fromStore = await prompt('  来源门店（留空跳过）> ')
    const toStore = await prompt('  目标门店（留空跳过）> ')
    const status = await prompt('  状态（留空跳过）> ')
    const source = await prompt('  来源 system/manual（留空跳过）> ')
    currentFilters.migrationFilters = {}
    if (fromStore.trim()) currentFilters.migrationFilters.from_store = fromStore.trim()
    if (toStore.trim()) currentFilters.migrationFilters.to_store = toStore.trim()
    if (status.trim()) currentFilters.migrationFilters.status = status.trim()
    if (source.trim()) currentFilters.migrationFilters.source = source.trim()
    console.log('  ✅ 迁移筛选已更新')
  } else if (sub.trim() === '3') {
    const cardId = await prompt('  卡号（留空跳过）> ')
    const action = await prompt('  动作 migrate/rollback/supplement（留空跳过）> ')
    const from = await prompt('  起始时间 ISO格式（留空跳过）> ')
    const to = await prompt('  截止时间 ISO格式（留空跳过）> ')
    currentFilters.timelineFilters = {}
    if (cardId.trim()) currentFilters.timelineFilters.card_id = cardId.trim()
    if (action.trim()) currentFilters.timelineFilters.action = action.trim()
    if (from.trim()) currentFilters.timelineFilters.from = from.trim()
    if (to.trim()) currentFilters.timelineFilters.to = to.trim()
    console.log('  ✅ 时间轴筛选已更新')
  } else if (sub.trim() === '4') {
    currentFilters = { memberFilters: {}, migrationFilters: {}, timelineFilters: {} }
    console.log('  ✅ 所有筛选已清除')
  }
}

async function loadSampleData() {
  printTitle('📦 加载示例数据')
  console.log('  1. 加载内置示例数据')
  console.log('  2. 从 JSON 文件导入')
  const sub = await prompt('  选择 > ')

  if (sub.trim() === '1') {
    loadBuiltInSampleData()
    console.log('  ✅ 示例数据已加载')
  } else if (sub.trim() === '2') {
    const filePath = await prompt('  文件路径 > ')
    try {
      const fs = require('fs')
      const data = JSON.parse(fs.readFileSync(filePath.trim(), 'utf-8'))
      importJsonData(data)
      console.log('  ✅ 数据已导入')
    } catch (e) {
      console.log(`  ❌ 导入失败: ${e.message}`)
    }
  }
}

function loadBuiltInSampleData() {
  const stores = [
    createStore({ store_id: 'S001', name: '中关村店', region: '北京' }),
    createStore({ store_id: 'S002', name: '朝阳大悦城店', region: '北京' }),
    createStore({ store_id: 'S003', name: '徐家汇店', region: '上海' }),
    createStore({ store_id: 'S004', name: '新系统目标店', region: '总部' })
  ]

  const members = [
    createMemberCard({ card_id: 'C001', name: '张三', phone: '13800001111', store_id: 'S001', stored_value: 500, bonus: 50, frozen: 0, source: 'system' }),
    createMemberCard({ card_id: 'C002', name: '李四', phone: '13800002222', store_id: 'S001', stored_value: 0, bonus: 200, frozen: 0, source: 'system' }),
    createMemberCard({ card_id: 'C003', name: '王五', phone: '13800003333', store_id: 'S001', stored_value: 300, bonus: 30, frozen: 100, source: 'system' }),
    createMemberCard({ card_id: 'C004', name: '赵六', phone: '13800004444', store_id: 'S002', stored_value: 800, bonus: 80, frozen: 0, source: 'system' }),
    createMemberCard({ card_id: 'C005', name: '孙七', phone: '13800005555', store_id: 'S002', stored_value: 200, bonus: 500, frozen: 50, source: 'manual' }),
    createMemberCard({ card_id: 'C006', name: '周八', phone: '13800006666', store_id: 'S003', stored_value: 1000, bonus: 100, frozen: 0, source: 'system' }),
    createMemberCard({ card_id: 'C007', name: '吴九', phone: '13800007777', store_id: 'S003', stored_value: 0, bonus: 0, frozen: 200, source: 'manual' }),
    createMemberCard({ card_id: 'C002', name: '李四', phone: '13800002222', store_id: 'S001', stored_value: 0, bonus: 200, frozen: 0, source: 'manual' })
  ]

  const bonusRules = [
    createBonusRule({ name: '充500送50', threshold: 500, bonus_ratio: 0.1, store_id: 'S001', source: 'system' }),
    createBonusRule({ name: '充1000送100', threshold: 1000, bonus_ratio: 0.1, store_id: '*', source: 'system' })
  ]

  const freezeRecords = [
    createFreezeRecord({ card_id: 'C003', amount: 100, reason: '疑似盗刷冻结', status: 'frozen', source: 'system' }),
    createFreezeRecord({ card_id: 'C005', amount: 50, reason: '客诉冻结', status: 'frozen', source: 'manual' }),
    createFreezeRecord({ card_id: 'C007', amount: 200, reason: '司法冻结', status: 'frozen', source: 'system' })
  ]

  const storedValueRecords = [
    createStoredValueRecord({ card_id: 'C001', amount: 500, type: 'deposit', source: 'system', note: '首充500' }),
    createStoredValueRecord({ card_id: 'C001', amount: 50, type: 'bonus', source: 'system', note: '充500送50' }),
    createStoredValueRecord({ card_id: 'C003', amount: 400, type: 'deposit', source: 'system' }),
    createStoredValueRecord({ card_id: 'C003', amount: 30, type: 'bonus', source: 'system' }),
    createStoredValueRecord({ card_id: 'C004', amount: 800, type: 'deposit', source: 'system' }),
    createStoredValueRecord({ card_id: 'C004', amount: 80, type: 'bonus', source: 'system' }),
    createStoredValueRecord({ card_id: 'C006', amount: 1000, type: 'deposit', source: 'system' }),
    createStoredValueRecord({ card_id: 'C006', amount: 100, type: 'bonus', source: 'system' })
  ]

  for (const s of stores) store.add('stores', s)
  for (const m of members) store.add('members', m)
  for (const b of bonusRules) store.add('bonusRules', b)
  for (const f of freezeRecords) store.add('freezeRecords', f)
  for (const sv of storedValueRecords) store.add('storedValueRecords', sv)

  store.save()
}

function importJsonData(data) {
  if (data.members) {
    for (const m of data.members) store.add('members', m)
  }
  if (data.stores) {
    for (const s of data.stores) store.add('stores', s)
  }
  if (data.freezeRecords) {
    for (const f of data.freezeRecords) store.add('freezeRecords', f)
  }
  if (data.bonusRules) {
    for (const b of data.bonusRules) store.add('bonusRules', b)
  }
  if (data.storedValueRecords) {
    for (const sv of data.storedValueRecords) store.add('storedValueRecords', sv)
  }
  if (data.migrationRecords) {
    for (const m of data.migrationRecords) store.add('migrationRecords', m)
  }
  store.save()
}

async function main() {
  store.load()
  await mainMenu()
}

main().catch(console.error)

module.exports = {
  viewMembers,
  auditBalances,
  doMigration,
  doRollback,
  doSupplement,
  viewMigrations,
  doReconciliation,
  viewTimeline,
  doExport,
  setFilters,
  loadSampleData
}
