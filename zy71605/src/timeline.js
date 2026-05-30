function buildTimeline(store, filters = {}) {
  let events = store.get('timelineEvents')

  if (filters.card_id) {
    events = events.filter(e => e.card_id === filters.card_id)
  }
  if (filters.migration_id) {
    events = events.filter(e => e.migration_id === filters.migration_id)
  }
  if (filters.action) {
    events = events.filter(e => e.action === filters.action)
  }
  if (filters.from) {
    events = events.filter(e => e.created_at >= filters.from)
  }
  if (filters.to) {
    events = events.filter(e => e.created_at <= filters.to)
  }
  if (filters.operator) {
    events = events.filter(e => e.operator === filters.operator)
  }

  events.sort((a, b) => a.created_at.localeCompare(b.created_at))

  return events
}

function replayTimeline(store, filters = {}) {
  const events = buildTimeline(store, filters)

  const states = []
  const currentState = new Map()

  for (const evt of events) {
    const cardId = evt.card_id
    const prevState = currentState.has(cardId) ? { ...currentState.get(cardId) } : null

    if (evt.action === 'migrate') {
      if (!currentState.has(cardId)) {
        currentState.set(cardId, {
          card_id: cardId,
          status: 'migrated',
          events: [evt],
          last_action: evt
        })
      } else {
        const existing = currentState.get(cardId)
        existing.status = 'migrated'
        existing.events.push(evt)
        existing.last_action = evt
      }
    } else if (evt.action === 'rollback') {
      if (currentState.has(cardId)) {
        const existing = currentState.get(cardId)
        existing.status = 'rolled_back'
        existing.events.push(evt)
        existing.last_action = evt
      }
    } else if (evt.action === 'supplement') {
      if (currentState.has(cardId)) {
        const existing = currentState.get(cardId)
        existing.status = 'supplemented'
        existing.events.push(evt)
        existing.last_action = evt
      }
    }

    states.push({
      event: evt,
      prevState,
      currentState: currentState.has(cardId) ? { ...currentState.get(cardId) } : null
    })
  }

  return { events, states, finalStates: Array.from(currentState.values()) }
}

function getCardHistory(store, cardId) {
  const events = buildTimeline(store, { card_id: cardId })
  const migrations = store.filter('migrationRecords', r => r.card_id === cardId)

  return {
    card_id: cardId,
    event_count: events.length,
    migration_count: migrations.length,
    timeline: events.map(e => ({
      time: e.created_at,
      action: e.action,
      detail: e.detail,
      operator: e.operator
    })),
    migrations: migrations.map(m => ({
      migration_id: m.migration_id,
      from_store: m.from_store,
      to_store: m.to_store,
      status: m.status,
      before: m.before_snapshot?.split,
      after: m.after_snapshot?.split,
      created_at: m.created_at
    }))
  }
}

module.exports = {
  buildTimeline,
  replayTimeline,
  getCardHistory
}
