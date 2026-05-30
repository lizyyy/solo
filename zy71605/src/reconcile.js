const { splitBalance } = require('./balance')
const { MIGRATION_STATUS } = require('./models')

function storeSummary(store) {
  const members = store.get('members')
  const storeMap = new Map()

  for (const m of members) {
    const sid = m.store_id
    if (!storeMap.has(sid)) {
      storeMap.set(sid, {
        store_id: sid,
        member_count: 0,
        total_stored_value: 0,
        total_bonus: 0,
        total_frozen: 0,
        total_balance: 0
      })
    }
    const s = storeMap.get(sid)
    s.member_count++
    const split = splitBalance(m)
    s.total_stored_value += split.stored_value
    s.total_bonus += split.bonus
    s.total_frozen += split.frozen
    s.total_balance += split.total
  }

  return Array.from(storeMap.values())
}

function reconcileStore(store, storeId) {
  const members = store.filter('members', m => m.store_id === storeId)
  const migrations = store.filter('migrationRecords', r =>
    r.from_store === storeId || r.to_store === storeId
  )

  const inMigrations = migrations.filter(r => r.to_store === storeId && r.status === MIGRATION_STATUS.MIGRATED)
  const outMigrations = migrations.filter(r => r.from_store === storeId && r.status === MIGRATION_STATUS.MIGRATED)
  const rolledBack = migrations.filter(r => r.status === MIGRATION_STATUS.ROLLED_BACK)

  let inAmount = { stored_value: 0, bonus: 0, frozen: 0 }
  for (const mig of inMigrations) {
    const sp = mig.before_snapshot?.split || { stored_value: 0, bonus: 0, frozen: 0 }
    inAmount.stored_value += sp.stored_value
    inAmount.bonus += sp.bonus
    inAmount.frozen += sp.frozen
  }

  let outAmount = { stored_value: 0, bonus: 0, frozen: 0 }
  for (const mig of outMigrations) {
    const sp = mig.before_snapshot?.split || { stored_value: 0, bonus: 0, frozen: 0 }
    outAmount.stored_value += sp.stored_value
    outAmount.bonus += sp.bonus
    outAmount.frozen += sp.frozen
  }

  let currentBalance = { stored_value: 0, bonus: 0, frozen: 0 }
  for (const m of members) {
    const sp = splitBalance(m)
    currentBalance.stored_value += sp.stored_value
    currentBalance.bonus += sp.bonus
    currentBalance.frozen += sp.frozen
  }

  const diff = {
    stored_value: currentBalance.stored_value - inAmount.stored_value + outAmount.stored_value,
    bonus: currentBalance.bonus - inAmount.bonus + outAmount.bonus,
    frozen: currentBalance.frozen - inAmount.frozen + outAmount.frozen
  }

  const hasAnomaly = Math.abs(diff.stored_value) > 0.01 ||
    Math.abs(diff.bonus) > 0.01 ||
    Math.abs(diff.frozen) > 0.01

  return {
    store_id: storeId,
    current_members: members.length,
    current_balance: currentBalance,
    migrated_in: { count: inMigrations.length, amount: inAmount },
    migrated_out: { count: outMigrations.length, amount: outAmount },
    rolled_back: rolledBack.length,
    diff,
    hasAnomaly,
    anomalyDetail: hasAnomaly
      ? `储值差额${diff.stored_value.toFixed(2)}，赠金差额${diff.bonus.toFixed(2)}，冻结差额${diff.frozen.toFixed(2)}`
      : ''
  }
}

function fullReconciliation(store) {
  const summaries = storeSummary(store)
  const results = []
  for (const s of summaries) {
    results.push(reconcileStore(store, s.store_id))
  }
  return results
}

function crossStoreDiff(store, fromStoreId, toStoreId) {
  const fromRecon = reconcileStore(store, fromStoreId)
  const toRecon = reconcileStore(store, toStoreId)

  const migrations = store.filter('migrationRecords', r =>
    r.from_store === fromStoreId && r.to_store === toStoreId &&
    r.status === MIGRATION_STATUS.MIGRATED
  )

  let migratedAmount = { stored_value: 0, bonus: 0, frozen: 0, total: 0 }
  for (const mig of migrations) {
    const sp = mig.before_snapshot?.split || { stored_value: 0, bonus: 0, frozen: 0 }
    migratedAmount.stored_value += sp.stored_value
    migratedAmount.bonus += sp.bonus
    migratedAmount.frozen += sp.frozen
    migratedAmount.total += sp.total
  }

  return {
    from_store: fromRecon,
    to_store: toRecon,
    migrated: { count: migrations.length, amount: migratedAmount },
    migrations
  }
}

module.exports = {
  storeSummary,
  reconcileStore,
  fullReconciliation,
  crossStoreDiff
}
