import { getDb } from '../db.js'
import { v4 as uuidv4 } from 'uuid'
import { BusinessError } from '../errors.js'

export function checkDuplicate(clientId: string, type: string): boolean {
  const db = getDb()
  const today = new Date().toISOString().split('T')[0]
  const key = `${clientId}_${today}_${type}`
  const existing = db.prepare('SELECT id FROM notifications WHERE idempotency_key = ?').get(key)
  return !!existing
}

export function createNotification(
  clientId: string,
  type: 'margin_call' | 'warning' | 'force_liquidation',
  content?: string,
  marginShortfallOverride?: number
): any {
  const db = getDb()

  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(clientId) as any
  if (!client) {
    throw new BusinessError(`客户ID ${clientId} 不存在`, { severity: 'error' })
  }

  const today = new Date().toISOString().split('T')[0]
  const idempotencyKey = `${clientId}_${today}_${type}`

  const existing = db.prepare('SELECT * FROM notifications WHERE idempotency_key = ?').get(idempotencyKey) as any
  if (existing) {
    throw new BusinessError(
      `客户${client.name} ${today}已发送${typeLabel(type)}`,
      { severity: 'warning', objectKey: idempotencyKey }
    )
  }

  const marginShortfall = marginShortfallOverride ?? Math.max(0, client.margin_used - client.equity)
  const defaultContent = content || `尊敬的${client.name}客户，您的账户风险率已达${client.risk_rate}%，${
    type === 'margin_call' ? '请及时追加保证金' :
    type === 'force_liquidation' ? '即将执行强平操作' :
    '请关注账户风险'
  }。`

  const id = uuidv4()
  const now = new Date().toISOString()

  db.prepare(`
    INSERT INTO notifications (id, client_id, type, status, margin_shortfall, content, idempotency_key, created_at)
    VALUES (?, ?, ?, 'draft', ?, ?, ?, ?)
  `).run(id, clientId, type, marginShortfall, defaultContent, idempotencyKey, now)

  return db.prepare('SELECT * FROM notifications WHERE id = ?').get(id)
}

function typeLabel(type: string): string {
  const map: Record<string, string> = {
    margin_call: '追保通知',
    warning: '风险预警通知',
    force_liquidation: '强平通知',
  }
  return map[type] || type
}

export function sendNotification(id: string): any {
  const db = getDb()

  const notification = db.prepare('SELECT * FROM notifications WHERE id = ?').get(id) as any
  if (!notification) {
    throw new BusinessError(`通知ID ${id} 不存在`, { severity: 'error' })
  }
  if (notification.status !== 'draft') {
    throw new BusinessError(`通知当前状态为${notification.status}，只有草稿状态才能发送`, { severity: 'warning' })
  }

  const now = new Date().toISOString()
  const transaction = db.transaction(() => {
    db.prepare(`
      UPDATE notifications SET status = 'sent', sent_at = ? WHERE id = ?
    `).run(now, id)

    db.prepare(`
      INSERT INTO notification_status_logs (id, notification_id, from_status, to_status, reason, created_at)
      VALUES (?, ?, 'draft', 'sent', '手动发送', ?)
    `).run(uuidv4(), id, now)
  })
  transaction()

  return db.prepare('SELECT * FROM notifications WHERE id = ?').get(id)
}

export function withdrawNotification(id: string, reason: string): any {
  const db = getDb()

  const notification = db.prepare('SELECT * FROM notifications WHERE id = ?').get(id) as any
  if (!notification) {
    throw new BusinessError(`通知ID ${id} 不存在`, { severity: 'error' })
  }
  if (notification.status !== 'sent') {
    throw new BusinessError(`通知当前状态为${notification.status}，只有已发送状态才能撤回`, { severity: 'warning' })
  }

  const now = new Date().toISOString()
  const transaction = db.transaction(() => {
    db.prepare(`
      UPDATE notifications SET status = 'withdrawn', withdrawn_at = ? WHERE id = ?
    `).run(now, id)

    db.prepare(`
      INSERT INTO notification_status_logs (id, notification_id, from_status, to_status, reason, created_at)
      VALUES (?, ?, 'sent', 'withdrawn', ?, ?)
    `).run(uuidv4(), id, reason, now)
  })
  transaction()

  return db.prepare('SELECT * FROM notifications WHERE id = ?').get(id)
}

export function getNotifications(filters: {
  clientId?: string
  type?: string
  status?: string
  page?: number
  pageSize?: number
}): { data: any[]; total: number } {
  const db = getDb()

  const conditions: string[] = []
  const params: any[] = []

  if (filters.clientId) {
    conditions.push('n.client_id = ?')
    params.push(filters.clientId)
  }
  if (filters.type) {
    conditions.push('n.type = ?')
    params.push(filters.type)
  }
  if (filters.status) {
    conditions.push('n.status = ?')
    params.push(filters.status)
  }

  const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''

  const total = (db.prepare(`SELECT COUNT(*) as cnt FROM notifications n ${where}`).get(...params) as any).cnt

  const page = filters.page || 1
  const pageSize = filters.pageSize || 20
  const offset = (page - 1) * pageSize

  const data = db.prepare(`
    SELECT n.*, c.name as client_name, c.account as client_account
    FROM notifications n
    LEFT JOIN clients c ON c.id = n.client_id
    ${where}
    ORDER BY n.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, pageSize, offset)

  const items = (data as any[]).map(n => ({
    ...n,
    client: n.client_name ? { id: n.client_id, name: n.client_name, account: n.client_account } : undefined,
  }))

  return { data: items, total }
}
