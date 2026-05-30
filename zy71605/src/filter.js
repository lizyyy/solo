const { splitBalance } = require('./balance')

function filterMigrationRecords(store, filters = {}) {
  let records = store.get('migrationRecords')

  if (filters.card_id) {
    records = records.filter(r => r.card_id === filters.card_id)
  }
  if (filters.batch_id) {
    records = records.filter(r => r.batch_id === filters.batch_id)
  }
  if (filters.from_store) {
    records = records.filter(r => r.from_store === filters.from_store)
  }
  if (filters.to_store) {
    records = records.filter(r => r.to_store === filters.to_store)
  }
  if (filters.status) {
    records = records.filter(r => r.status === filters.status)
  }
  if (filters.source) {
    records = records.filter(r => r.source === filters.source)
  }
  if (filters.from_date) {
    records = records.filter(r => r.created_at >= filters.from_date)
  }
  if (filters.to_date) {
    records = records.filter(r => r.created_at <= filters.to_date)
  }
  if (filters.operator) {
    records = records.filter(r => r.operator === filters.operator)
  }

  return records
}

function filterMembers(store, filters = {}) {
  let members = store.get('members')

  if (filters.store_id) {
    members = members.filter(m => m.store_id === filters.store_id)
  }
  if (filters.card_id) {
    members = members.filter(m => m.card_id === filters.card_id)
  }
  if (filters.source) {
    members = members.filter(m => m.source === filters.source)
  }
  if (filters.has_frozen) {
    members = members.filter(m => (m.balance?.frozen || 0) > 0)
  }
  if (filters.has_bonus) {
    members = members.filter(m => (m.balance?.bonus || 0) > 0)
  }

  return members
}

module.exports = {
  filterMigrationRecords,
  filterMembers
}
