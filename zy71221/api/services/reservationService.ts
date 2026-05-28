import db from '../db.js'

export class BusinessError extends Error {
  code: string
  detail: any

  constructor(code: string, message: string, detail?: any) {
    super(message)
    this.code = code
    this.detail = detail
  }
}

interface ReservationFilter {
  security_code?: string
  client_account?: string
  status?: string
  date_from?: string
  date_to?: string
}

interface CreateReservationData {
  client_account: string
  client_name: string
  client_priority: number
  security_code: string
  security_name: string
  quantity: number
  reserve_date: string
  due_date: string
}

interface UpdateReservationData {
  quantity?: number
  due_date?: string
}

interface InventoryRow {
  total_qty: number
  locked_qty: number
}

interface ReservationRow {
  id: number
  status: string
  quantity: number
  security_code: string
  [key: string]: any
}

function buildFilterClause(filter: ReservationFilter, alias: string = 'r') {
  const conditions: string[] = []
  const params: any[] = []

  if (filter.security_code) {
    conditions.push(`${alias}.security_code = ?`)
    params.push(filter.security_code)
  }
  if (filter.client_account) {
    conditions.push(`${alias}.client_account = ?`)
    params.push(filter.client_account)
  }
  if (filter.status) {
    conditions.push(`${alias}.status = ?`)
    params.push(filter.status)
  }
  if (filter.date_from) {
    conditions.push(`${alias}.reserve_date >= ?`)
    params.push(filter.date_from)
  }
  if (filter.date_to) {
    conditions.push(`${alias}.reserve_date <= ?`)
    params.push(filter.date_to)
  }

  const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''
  return { whereClause, params }
}

function getReservations(filter: ReservationFilter = {}) {
  const { whereClause, params } = buildFilterClause(filter)

  const rows = db.prepare(`
    SELECT r.*,
      CASE WHEN r.status IN ('pending','locked','overdue')
        THEN CAST(julianday(r.due_date) - julianday(date('now','localtime')) AS INTEGER)
        ELSE NULL
      END as days_until_due
    FROM reservation r
    ${whereClause}
    ORDER BY r.created_at DESC
  `).all(...params)

  return rows
}

const createReservation = db.transaction((data: CreateReservationData) => {
  const inventory = db.prepare('SELECT * FROM inventory WHERE security_code = ?').get(data.security_code) as InventoryRow | undefined
  if (!inventory) {
    throw new BusinessError('NOT_FOUND', '证券不存在', { security_code: data.security_code })
  }

  const available = inventory.total_qty - inventory.locked_qty
  if (available < data.quantity) {
    throw new BusinessError(
      'INSUFFICIENT_INVENTORY',
      `可用库存仅 ${available} 股，当前预约 ${data.quantity} 股，差额 ${data.quantity - available} 股`,
      { available, requested: data.quantity, shortage: data.quantity - available }
    )
  }

  const result = db.prepare(`
    INSERT INTO reservation (client_account, client_name, client_priority, security_code, security_name, quantity, status, reserve_date, due_date)
    VALUES (?, ?, ?, ?, ?, ?, 'locked', ?, ?)
  `).run(
    data.client_account, data.client_name, data.client_priority,
    data.security_code, data.security_name, data.quantity,
    data.reserve_date, data.due_date
  )

  db.prepare('UPDATE inventory SET locked_qty = locked_qty + ? WHERE security_code = ?')
    .run(data.quantity, data.security_code)

  return db.prepare('SELECT * FROM reservation WHERE id = ?').get(result.lastInsertRowid)
})

const updateReservation = db.transaction((id: number, data: UpdateReservationData) => {
  const reservation = db.prepare('SELECT * FROM reservation WHERE id = ?').get(id) as ReservationRow | undefined
  if (!reservation) {
    throw new BusinessError('NOT_FOUND', '预约单不存在', { id })
  }

  if (reservation.status !== 'locked') {
    throw new BusinessError('INVALID_STATUS', '该预约单状态已变更，请刷新后重试', { current_status: reservation.status })
  }

  const newQuantity = data.quantity ?? reservation.quantity
  const newDueDate = data.due_date ?? reservation.due_date
  const delta = newQuantity - reservation.quantity

  if (delta > 0) {
    const inventory = db.prepare('SELECT * FROM inventory WHERE security_code = ?').get(reservation.security_code) as InventoryRow
    const available = inventory.total_qty - inventory.locked_qty
    if (available < delta) {
      throw new BusinessError(
        'INSUFFICIENT_INVENTORY',
        `可用库存仅 ${available} 股，当前预约 ${newQuantity} 股，差额 ${newQuantity - reservation.quantity - available} 股`,
        { available, requested: newQuantity, shortage: newQuantity - reservation.quantity - available }
      )
    }
    db.prepare('UPDATE inventory SET locked_qty = locked_qty + ? WHERE security_code = ?')
      .run(delta, reservation.security_code)
  } else if (delta < 0) {
    db.prepare('UPDATE inventory SET locked_qty = locked_qty + ? WHERE security_code = ? AND locked_qty >= ?')
      .run(delta, reservation.security_code, Math.abs(delta))
  }

  db.prepare(`
    UPDATE reservation SET quantity = ?, due_date = ?, updated_at = datetime('now','localtime')
    WHERE id = ?
  `).run(newQuantity, newDueDate, id)

  return db.prepare('SELECT * FROM reservation WHERE id = ?').get(id)
})

const returnReservation = db.transaction((id: number) => {
  const reservation = db.prepare('SELECT * FROM reservation WHERE id = ?').get(id) as ReservationRow | undefined
  if (!reservation) {
    throw new BusinessError('NOT_FOUND', '预约单不存在', { id })
  }

  if (!['locked', 'overdue'].includes(reservation.status)) {
    throw new BusinessError('INVALID_STATUS', '该预约单状态不允许归还操作', { current_status: reservation.status })
  }

  const today = new Date().toISOString().slice(0, 10)

  db.prepare('UPDATE inventory SET locked_qty = locked_qty - ? WHERE security_code = ? AND locked_qty >= ?')
    .run(reservation.quantity, reservation.security_code, reservation.quantity)

  db.prepare(`
    UPDATE reservation SET status = 'returned', return_date = ?, updated_at = datetime('now','localtime')
    WHERE id = ?
  `).run(today, id)

  return db.prepare('SELECT * FROM reservation WHERE id = ?').get(id)
})

const cancelReservation = db.transaction((id: number, reason: string) => {
  const reservation = db.prepare('SELECT * FROM reservation WHERE id = ?').get(id) as ReservationRow | undefined
  if (!reservation) {
    throw new BusinessError('NOT_FOUND', '预约单不存在', { id })
  }

  if (!['locked', 'pending'].includes(reservation.status)) {
    throw new BusinessError('INVALID_STATUS', '该预约单状态不允许撤单操作', { current_status: reservation.status })
  }

  const today = new Date().toISOString().slice(0, 10)

  if (reservation.status === 'pending') {
    db.prepare(`
      UPDATE reservation SET status = 'cancelled', cancel_date = ?, cancel_reason = ?, compensation_status = 'success', updated_at = datetime('now','localtime')
      WHERE id = ?
    `).run(today, reason, id)
  } else {
    const invResult = db.prepare('UPDATE inventory SET locked_qty = locked_qty - ? WHERE security_code = ? AND locked_qty >= ?')
      .run(reservation.quantity, reservation.security_code, reservation.quantity)

    if (invResult.changes > 0) {
      db.prepare(`
        UPDATE reservation SET status = 'cancelled', cancel_date = ?, cancel_reason = ?, compensation_status = 'success', updated_at = datetime('now','localtime')
        WHERE id = ?
      `).run(today, reason, id)
    } else {
      db.prepare(`
        UPDATE reservation SET status = 'compensation_error', cancel_date = ?, cancel_reason = ?, compensation_status = 'failed', updated_at = datetime('now','localtime')
        WHERE id = ?
      `).run(today, reason, id)
    }
  }

  return db.prepare('SELECT * FROM reservation WHERE id = ?').get(id)
})

function markOverdue() {
  const today = new Date().toISOString().slice(0, 10)
  const result = db.prepare(`
    UPDATE reservation SET status = 'overdue', updated_at = datetime('now','localtime')
    WHERE status = 'locked' AND due_date < ?
  `).run(today)
  return { updated_count: result.changes }
}

export default {
  getReservations,
  createReservation,
  updateReservation,
  returnReservation,
  cancelReservation,
  markOverdue,
}
