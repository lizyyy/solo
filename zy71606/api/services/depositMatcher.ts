import { getDb } from '../db.js'
import { v4 as uuidv4 } from 'uuid'
import { BusinessError } from '../errors.js'

const MATCH_WINDOW_DAYS = 3

export function autoMatch(): { matched: number; details: any[] } {
  const db = getDb()

  const unmatchedDeposits = db.prepare(`
    SELECT d.*, c.name as client_name
    FROM deposits d
    LEFT JOIN clients c ON c.id = d.client_id
    WHERE d.match_status IN ('unmatched', 'partially_matched')
  `).all() as any[]

  const details: any[] = []
  let matchedCount = 0

  const transaction = db.transaction(() => {
    for (const deposit of unmatchedDeposits) {
      const notifications = db.prepare(`
        SELECT n.*
        FROM notifications n
        WHERE n.client_id = ?
          AND n.status IN ('sent', 'partially_deducted')
          AND datetime(n.sent_at) >= datetime(?, '-${MATCH_WINDOW_DAYS} days')
        ORDER BY n.sent_at ASC
      `).all(deposit.client_id, deposit.deposit_time) as any[]

      if (notifications.length === 0) continue

      let remainingAmount = deposit.amount

      for (const notification of notifications) {
        if (remainingAmount <= 0) break

        const alreadyMatched = (db.prepare(`
          SELECT COALESCE(SUM(matched_amount), 0) as total
          FROM deposit_matches
          WHERE notification_id = ?
        `).get(notification.id) as any).total

        const notificationRemaining = notification.margin_shortfall - alreadyMatched
        if (notificationRemaining <= 0) continue

        const matchAmount = Math.min(remainingAmount, notificationRemaining)

        db.prepare(`
          INSERT INTO deposit_matches (id, deposit_id, notification_id, matched_amount, matched_at, match_type)
          VALUES (?, ?, ?, ?, datetime('now'), 'auto')
        `).run(uuidv4(), deposit.id, notification.id, matchAmount)

        const newNotificationRemaining = notificationRemaining - matchAmount
        if (newNotificationRemaining <= 0) {
          db.prepare(`UPDATE notifications SET status = 'settled' WHERE id = ?`).run(notification.id)
          logStatusChange(db, notification.id, notification.status, 'settled', '保证金匹配后自动结清')
        } else if (notification.status === 'sent') {
          db.prepare(`UPDATE notifications SET status = 'partially_deducted' WHERE id = ?`).run(notification.id)
          logStatusChange(db, notification.id, 'sent', 'partially_deducted', '部分保证金匹配')
        }

        remainingAmount -= matchAmount
        matchedCount++

        details.push({
          depositId: deposit.id,
          notificationId: notification.id,
          clientName: deposit.client_name,
          matchedAmount: matchAmount,
        })
      }

      if (remainingAmount <= 0) {
        db.prepare(`UPDATE deposits SET match_status = 'matched' WHERE id = ?`).run(deposit.id)
      } else if (remainingAmount < deposit.amount) {
        db.prepare(`UPDATE deposits SET match_status = 'partially_matched' WHERE id = ?`).run(deposit.id)
      }
    }
  })

  transaction()
  return { matched: matchedCount, details }
}

function logStatusChange(db: any, notificationId: string, fromStatus: string, toStatus: string, reason: string) {
  db.prepare(`
    INSERT INTO notification_status_logs (id, notification_id, from_status, to_status, reason, created_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
  `).run(uuidv4(), notificationId, fromStatus, toStatus, reason)
}

export function manualMatch(depositId: string, notificationId: string, amount: number): any {
  const db = getDb()

  const deposit = db.prepare('SELECT * FROM deposits WHERE id = ?').get(depositId) as any
  if (!deposit) {
    throw new BusinessError(`入金记录ID ${depositId} 不存在`, { severity: 'error' })
  }

  const notification = db.prepare('SELECT * FROM notifications WHERE id = ?').get(notificationId) as any
  if (!notification) {
    throw new BusinessError(`通知ID ${notificationId} 不存在`, { severity: 'error' })
  }

  if (deposit.client_id !== notification.client_id) {
    throw new BusinessError('入金记录与通知不属于同一客户，无法匹配', { severity: 'error' })
  }

  const alreadyMatchedDeposit = (db.prepare(`
    SELECT COALESCE(SUM(matched_amount), 0) as total FROM deposit_matches WHERE deposit_id = ?
  `).get(depositId) as any).total

  const depositRemaining = deposit.amount - alreadyMatchedDeposit
  if (amount > depositRemaining) {
    throw new BusinessError(
      `匹配金额${amount}超过入金剩余可匹配金额${depositRemaining}`,
      { severity: 'warning' }
    )
  }

  const transaction = db.transaction(() => {
    db.prepare(`
      INSERT INTO deposit_matches (id, deposit_id, notification_id, matched_amount, matched_at, match_type)
      VALUES (?, ?, ?, ?, datetime('now'), 'manual')
    `).run(uuidv4(), depositId, notificationId, amount)

    const newDepositMatched = alreadyMatchedDeposit + amount
    if (newDepositMatched >= deposit.amount) {
      db.prepare(`UPDATE deposits SET match_status = 'matched' WHERE id = ?`).run(depositId)
    } else {
      db.prepare(`UPDATE deposits SET match_status = 'partially_matched' WHERE id = ?`).run(depositId)
    }

    const alreadyMatchedNotification = (db.prepare(`
      SELECT COALESCE(SUM(matched_amount), 0) as total FROM deposit_matches WHERE notification_id = ?
    `).get(notificationId) as any).total

    if (alreadyMatchedNotification >= notification.margin_shortfall) {
      db.prepare(`UPDATE notifications SET status = 'settled' WHERE id = ?`).run(notificationId)
      logStatusChange(db, notificationId, notification.status, 'settled', '手动匹配后结清')
    } else if (notification.status === 'sent') {
      db.prepare(`UPDATE notifications SET status = 'partially_deducted' WHERE id = ?`).run(notificationId)
      logStatusChange(db, notificationId, 'sent', 'partially_deducted', '手动部分匹配')
    }
  })
  transaction()

  return db.prepare('SELECT * FROM deposit_matches WHERE deposit_id = ? AND notification_id = ? ORDER BY matched_at DESC').get(depositId, notificationId)
}

export function getUnmatched(): any[] {
  const db = getDb()

  const deposits = db.prepare(`
    SELECT d.*, c.name as client_name, c.account as client_account
    FROM deposits d
    LEFT JOIN clients c ON c.id = d.client_id
    WHERE d.match_status IN ('unmatched', 'partially_matched')
    ORDER BY d.deposit_time DESC
  `).all() as any[]

  return deposits.map(d => {
    let possibleReason = ''
    const hasNotification = db.prepare(`
      SELECT COUNT(*) as cnt FROM notifications
      WHERE client_id = ? AND status IN ('sent', 'partially_deducted')
    `).get(d.client_id) as any

    if (!hasNotification.cnt) {
      possibleReason = '该客户无待处理通知'
    } else {
      const withinWindow = db.prepare(`
        SELECT COUNT(*) as cnt FROM notifications
        WHERE client_id = ?
          AND status IN ('sent', 'partially_deducted')
          AND datetime(sent_at) >= datetime(?, '-${MATCH_WINDOW_DAYS} days')
      `).get(d.client_id, d.deposit_time) as any
      if (!withinWindow.cnt) {
        possibleReason = '入金时间超出通知匹配窗口（3天）'
      } else {
        const alreadyMatched = (db.prepare(`
          SELECT COALESCE(SUM(dm.matched_amount), 0) as total
          FROM deposit_matches dm
          JOIN notifications n ON n.id = dm.notification_id
          WHERE n.client_id = ? AND n.status IN ('sent', 'partially_deducted')
        `).get(d.client_id) as any).total
        const shortfall = (db.prepare(`
          SELECT COALESCE(SUM(margin_shortfall), 0) as total
          FROM notifications
          WHERE client_id = ? AND status IN ('sent', 'partially_deducted')
        `).get(d.client_id) as any).total
        if (alreadyMatched >= shortfall) {
          possibleReason = '通知追保金额已全部匹配'
        } else {
          possibleReason = '金额或时间不完全匹配，建议手动匹配'
        }
      }
    }

    return {
      ...d,
      client: { id: d.client_id, name: d.client_name, account: d.client_account },
      hint: possibleReason,
    }
  })
}

export function getDeposits(filters: {
  clientId?: string
  matchStatus?: string
  page?: number
  pageSize?: number
}): { data: any[]; total: number } {
  const db = getDb()

  const conditions: string[] = []
  const params: any[] = []

  if (filters.clientId) {
    conditions.push('d.client_id = ?')
    params.push(filters.clientId)
  }
  if (filters.matchStatus) {
    conditions.push('d.match_status = ?')
    params.push(filters.matchStatus)
  }

  const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''

  const total = (db.prepare(`SELECT COUNT(*) as cnt FROM deposits d ${where}`).get(...params) as any).cnt
  const page = filters.page || 1
  const pageSize = filters.pageSize || 20
  const offset = (page - 1) * pageSize

  const data = db.prepare(`
    SELECT d.*, c.name as client_name, c.account as client_account
    FROM deposits d
    LEFT JOIN clients c ON c.id = d.client_id
    ${where}
    ORDER BY d.deposit_time DESC
    LIMIT ? OFFSET ?
  `).all(...params, pageSize, offset)

  const items = (data as any[]).map(d => ({
    ...d,
    client: d.client_name ? { id: d.client_id, name: d.client_name, account: d.client_account } : undefined,
  }))

  return { data: items, total }
}

export function createDeposit(clientId: string, amount: number, depositTime: string): any {
  const db = getDb()

  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(clientId) as any
  if (!client) {
    throw new BusinessError(`客户ID ${clientId} 不存在`, { severity: 'error' })
  }

  const id = uuidv4()
  db.prepare(`
    INSERT INTO deposits (id, client_id, amount, deposit_time, match_status)
    VALUES (?, ?, ?, ?, 'unmatched')
  `).run(id, clientId, amount, depositTime)

  return db.prepare('SELECT * FROM deposits WHERE id = ?').get(id)
}
