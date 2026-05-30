const {
  createMigrationRecord,
  createMigrationBatch,
  createTimelineEvent,
  MIGRATION_STATUS
} = require('./models')
const { splitBalance } = require('./balance')

function checkIdempotent(store, cardId, batchId) {
  const sameBatch = store.find('migrationRecords', r =>
    r.card_id === cardId && r.batch_id === batchId && r.status !== MIGRATION_STATUS.ROLLED_BACK
  )
  if (sameBatch) {
    return {
      isIdempotent: false,
      existing: sameBatch,
      detail: `卡号${cardId}在批次${batchId}中已有${sameBatch.status}状态的迁移记录(${sameBatch.migration_id})，重复迁移被拦截`
    }
  }
  const anyActive = store.find('migrationRecords', r =>
    r.card_id === cardId && r.status !== MIGRATION_STATUS.ROLLED_BACK
  )
  if (anyActive) {
    return {
      isIdempotent: false,
      existing: anyActive,
      detail: `卡号${cardId}在批次${anyActive.batch_id}中已有${anyActive.status}状态的迁移记录(${anyActive.migration_id})，重复迁移被拦截`
    }
  }
  return { isIdempotent: true }
}

function createBatch(store, { operator, note }) {
  const batch = createMigrationBatch({ operator, note })
  store.add('migrationBatches', batch)
  return batch
}

function executeMigration(store, { cardId, fromStore, toStore, batchId, operator, source }) {
  const member = store.find('members', m => m.card_id === cardId)
  if (!member) {
    return { success: false, detail: `找不到卡号${cardId}的会员记录` }
  }

  const idempCheck = checkIdempotent(store, cardId, batchId)
  if (!idempCheck.isIdempotent) {
    return { success: false, detail: idempCheck.detail, existing: idempCheck.existing }
  }

  const freezeRecords = store.filter('freezeRecords', f => f.card_id === cardId && f.status === 'frozen')
  const totalFrozen = freezeRecords.reduce((s, f) => s + (Number(f.amount) || 0), 0)

  const beforeSnapshot = {
    balance: { ...member.balance },
    store_id: member.store_id,
    split: splitBalance(member),
    frozen_detail: freezeRecords.map(f => ({ freeze_id: f.freeze_id, amount: f.amount, reason: f.reason }))
  }

  const afterSnapshot = {
    balance: { ...member.balance },
    store_id: toStore,
    split: splitBalance(member),
    frozen_migrated: true,
    frozen_amount: totalFrozen,
    note: '冻结金额随余额一并迁出至新账'
  }

  const migration = createMigrationRecord({
    card_id: cardId,
    from_store: fromStore || member.store_id,
    to_store: toStore,
    before_snapshot: beforeSnapshot,
    after_snapshot: afterSnapshot,
    batch_id: batchId,
    operator: operator || 'system',
    source: source || 'system'
  })
  migration.status = MIGRATION_STATUS.MIGRATED
  migration.migrated_at = new Date().toISOString()

  store.add('migrationRecords', migration)

  store.update('members', m => m.card_id === cardId, { store_id: toStore })

  const evt = createTimelineEvent({
    migration_id: migration.migration_id,
    card_id: cardId,
    action: 'migrate',
    detail: `余额从门店${fromStore || member.store_id}迁至${toStore}，储值${beforeSnapshot.split.stored_value}，赠金${beforeSnapshot.split.bonus}，冻结${beforeSnapshot.split.frozen}`,
    operator: operator || 'system'
  })
  store.add('timelineEvents', evt)

  return {
    success: true,
    migration,
    before: beforeSnapshot,
    after: afterSnapshot,
    frozenTotal: totalFrozen,
    frozenRecords: freezeRecords
  }
}

function rollbackMigration(store, { migrationId, operator }) {
  const migration = store.find('migrationRecords', r => r.migration_id === migrationId)
  if (!migration) {
    return { success: false, detail: `找不到迁移记录${migrationId}` }
  }
  if (migration.status === MIGRATION_STATUS.ROLLED_BACK) {
    return { success: false, detail: `迁移记录${migrationId}已撤回，不可重复操作` }
  }

  const member = store.find('members', m => m.card_id === migration.card_id)

  const rollbackBefore = member
    ? { balance: { ...member.balance }, store_id: member.store_id, split: splitBalance(member) }
    : null

  store.update('migrationRecords', r => r.migration_id === migrationId, {
    status: MIGRATION_STATUS.ROLLED_BACK,
    rolled_back_at: new Date().toISOString()
  })

  if (member) {
    store.update('members', m => m.card_id === migration.card_id, {
      store_id: migration.before_snapshot.store_id
    })
  }

  const rollbackAfter = member
    ? { balance: { ...member.balance }, store_id: migration.before_snapshot.store_id }
    : null

  const evt = createTimelineEvent({
    migration_id: migrationId,
    card_id: migration.card_id,
    action: 'rollback',
    detail: `撤回迁移：门店从${migration.to_store}恢复为${migration.before_snapshot.store_id}`,
    operator: operator || 'system'
  })
  store.add('timelineEvents', evt)

  return {
    success: true,
    migration,
    before: rollbackBefore,
    after: rollbackAfter
  }
}

function supplementMigration(store, { migrationId, supplementData, operator }) {
  const migration = store.find('migrationRecords', r => r.migration_id === migrationId)
  if (!migration) {
    return { success: false, detail: `找不到迁移记录${migrationId}` }
  }

  const beforeSnapshot = { ...migration.after_snapshot }
  const afterSnapshot = {
    ...migration.after_snapshot,
    ...supplementData,
    supplement_note: supplementData.note || '补录修正'
  }

  store.update('migrationRecords', r => r.migration_id === migrationId, {
    after_snapshot: afterSnapshot,
    status: MIGRATION_STATUS.SUPPLEMENTED,
    supplemented_at: new Date().toISOString()
  })

  const evt = createTimelineEvent({
    migration_id: migrationId,
    card_id: migration.card_id,
    action: 'supplement',
    detail: `补录修正：${supplementData.note || '无备注'}，修正前储值${beforeSnapshot.split?.stored_value}，修正后储值${afterSnapshot.split?.stored_value}`,
    operator: operator || 'system'
  })
  store.add('timelineEvents', evt)

  return {
    success: true,
    migration,
    before: beforeSnapshot,
    after: afterSnapshot
  }
}

function batchMigrate(store, { cardIds, fromStore, toStore, operator, note, source }) {
  const batch = createBatch(store, { operator, note })
  const results = []
  const errors = []

  for (const cardId of cardIds) {
    const result = executeMigration(store, {
      cardId,
      fromStore,
      toStore,
      batchId: batch.batch_id,
      operator,
      source
    })
    if (result.success) {
      results.push(result)
    } else {
      errors.push({ card_id: cardId, detail: result.detail })
    }
  }

  const allSuccess = errors.length === 0
  store.update('migrationBatches', b => b.batch_id === batch.batch_id, {
    status: allSuccess ? MIGRATION_STATUS.MIGRATED : 'partial'
  })

  return { batch, results, errors, allSuccess }
}

module.exports = {
  checkIdempotent,
  createBatch,
  executeMigration,
  rollbackMigration,
  supplementMigration,
  batchMigrate
}
