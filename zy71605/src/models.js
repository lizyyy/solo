const crypto = require('crypto')

const SOURCES = { SYSTEM: 'system', MANUAL: 'manual' }

const MIGRATION_STATUS = {
  PENDING: 'pending',
  MIGRATED: 'migrated',
  ROLLED_BACK: 'rolled_back',
  SUPPLEMENTED: 'supplemented'
}

const FREEZE_STATUS = { FROZEN: 'frozen', UNFROZEN: 'unfrozen' }

const BALANCE_TYPES = { STORED_VALUE: 'stored_value', BONUS: 'bonus', FROZEN: 'frozen' }

function uid(prefix) {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
}

function createMemberCard({ card_id, name, phone, store_id, stored_value = 0, bonus = 0, frozen = 0, source = SOURCES.SYSTEM }) {
  if (!card_id || !name || !store_id) throw new Error('card_id, name, store_id 为必填')
  return {
    card_id,
    name,
    phone: phone || '',
    store_id,
    balance: {
      stored_value: Number(stored_value),
      bonus: Number(bonus),
      frozen: Number(frozen)
    },
    source,
    created_at: new Date().toISOString()
  }
}

function createStoredValueRecord({ card_id, amount, type, source = SOURCES.SYSTEM, note = '' }) {
  if (!card_id || amount == null || !type) throw new Error('card_id, amount, type 为必填')
  return {
    record_id: uid('svr'),
    card_id,
    amount: Number(amount),
    type,
    source,
    note,
    created_at: new Date().toISOString()
  }
}

function createBonusRule({ name, threshold, bonus_ratio, store_id, source = SOURCES.SYSTEM }) {
  if (!name || threshold == null || bonus_ratio == null) throw new Error('name, threshold, bonus_ratio 为必填')
  return {
    rule_id: uid('br'),
    name,
    threshold: Number(threshold),
    bonus_ratio: Number(bonus_ratio),
    store_id: store_id || '*',
    source,
    created_at: new Date().toISOString()
  }
}

function createFreezeRecord({ card_id, amount, reason, status = FREEZE_STATUS.FROZEN, source = SOURCES.SYSTEM }) {
  if (!card_id || amount == null || !reason) throw new Error('card_id, amount, reason 为必填')
  return {
    freeze_id: uid('fr'),
    card_id,
    amount: Number(amount),
    reason,
    status,
    source,
    created_at: new Date().toISOString()
  }
}

function createStore({ store_id, name, region = '' }) {
  if (!store_id || !name) throw new Error('store_id, name 为必填')
  return {
    store_id,
    name,
    region,
    created_at: new Date().toISOString()
  }
}

function createMigrationRecord({ card_id, from_store, to_store, before_snapshot, after_snapshot, batch_id, operator = 'system', source = SOURCES.SYSTEM }) {
  return {
    migration_id: uid('mig'),
    card_id,
    from_store,
    to_store,
    before_snapshot,
    after_snapshot,
    status: MIGRATION_STATUS.PENDING,
    batch_id,
    operator,
    source,
    created_at: new Date().toISOString()
  }
}

function createMigrationBatch({ operator = 'system', note = '' }) {
  return {
    batch_id: uid('batch'),
    operator,
    note,
    status: MIGRATION_STATUS.PENDING,
    created_at: new Date().toISOString()
  }
}

function createTimelineEvent({ migration_id, card_id, action, detail, operator = 'system' }) {
  return {
    event_id: uid('evt'),
    migration_id,
    card_id,
    action,
    detail,
    operator,
    created_at: new Date().toISOString()
  }
}

module.exports = {
  SOURCES,
  MIGRATION_STATUS,
  FREEZE_STATUS,
  BALANCE_TYPES,
  uid,
  createMemberCard,
  createStoredValueRecord,
  createBonusRule,
  createFreezeRecord,
  createStore,
  createMigrationRecord,
  createMigrationBatch,
  createTimelineEvent
}
