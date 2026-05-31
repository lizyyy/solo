import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { getDb } from './db.js'
import type Database from 'better-sqlite3'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const SAMPLES_DIR = path.resolve(__dirname, '../samples')

interface SamplePaymentFlow {
  anchorId: string
  anchorName: string
  transactionId: string
  amount: number
  time: string
  platform: string
}

interface SampleRefundRequest {
  anchorId: string
  requestId: string
  amount: number
  reason: string
  time: string
}

interface SampleApprovalEmail {
  anchorId: string
  subject: string
  rawContent: string
  parsedAmount: number | null
  note: string
  receivedAt: string
}

interface SampleHandwrittenNote {
  anchorId: string
  content: string
  createdAt: string
}

function loadJson<T>(filename: string): T[] {
  const filePath = path.join(SAMPLES_DIR, filename)
  if (!fs.existsSync(filePath)) return []
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8)
}

export function loadSampleData(): number {
  const db = getDb()

  const payments = loadJson<SamplePaymentFlow>('payment_flows.json')
  const refunds = loadJson<SampleRefundRequest>('refund_requests.json')
  const emails = loadJson<SampleApprovalEmail>('approval_emails.json')
  const notes = loadJson<SampleHandwrittenNote>('handwritten_notes.json')

  const refundMap = new Map<string, SampleRefundRequest[]>()
  for (const r of refunds) {
    const list = refundMap.get(r.anchorId) || []
    list.push(r)
    refundMap.set(r.anchorId, list)
  }

  const emailMap = new Map<string, SampleApprovalEmail[]>()
  for (const e of emails) {
    const list = emailMap.get(e.anchorId) || []
    list.push(e)
    emailMap.set(e.anchorId, list)
  }

  const noteMap = new Map<string, SampleHandwrittenNote[]>()
  for (const n of notes) {
    const list = noteMap.get(n.anchorId) || []
    list.push(n)
    noteMap.set(n.anchorId, list)
  }

  const seenKeys = new Map<string, string>()

  const insertSettlement = db.prepare(`
    INSERT INTO settlement (id, anchor_id, anchor_name, total_tip, refund_amount, share_rate, settlement_amount, status, is_duplicate, has_empty_fields, is_full_refund, has_change_history, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const insertPayment = db.prepare(`
    INSERT INTO payment_flow (id, settlement_id, transaction_id, amount, time, platform)
    VALUES (?, ?, ?, ?, ?, ?)
  `)

  const insertRefund = db.prepare(`
    INSERT INTO refund_request (id, settlement_id, request_id, amount, reason, time)
    VALUES (?, ?, ?, ?, ?, ?)
  `)

  const insertEmail = db.prepare(`
    INSERT INTO approval_email (id, settlement_id, subject, raw_content, parsed_amount, note, received_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)

  const insertNote = db.prepare(`
    INSERT INTO handwritten_note (id, settlement_id, content, created_at)
    VALUES (?, ?, ?, ?)
  `)

  const clearAll = db.transaction(() => {
    db.exec('DELETE FROM change_history')
    db.exec('DELETE FROM handwritten_note')
    db.exec('DELETE FROM approval_email')
    db.exec('DELETE FROM refund_request')
    db.exec('DELETE FROM payment_flow')
    db.exec('DELETE FROM settlement')
  })

  clearAll()

  const insertAll = db.transaction(() => {
    let count = 0

    for (const p of payments) {
      const dedupeKey = `${p.anchorId}|${p.amount}|${p.time}|${p.platform}`
      if (seenKeys.has(dedupeKey)) {
        const existingId = seenKeys.get(dedupeKey)!
        db.prepare('UPDATE settlement SET is_duplicate = 1 WHERE id = ?').run(existingId)
        continue
      }

      const settlementId = generateId()
      seenKeys.set(dedupeKey, settlementId)

      const refundList = refundMap.get(p.anchorId) || []
      const refund = refundList.length > 0 ? refundList[0] : null
      const emailList = emailMap.get(p.anchorId) || []
      const email = emailList.length > 0 ? emailList[0] : null
      const noteList = noteMap.get(p.anchorId) || []
      const note = noteList.length > 0 ? noteList[0] : null

      let shareRate: number | null = 0.5
      let refundAmount: number | null = refund ? refund.amount : null
      let totalTip: number | null = p.amount
      let settlementAmount: number | null = null

      const hasEmptyFields = totalTip === null || refundAmount === null || shareRate === null

      let isFullRefund = false
      if (refundAmount !== null && totalTip !== null && refundAmount === totalTip && refundAmount > 0) {
        isFullRefund = true
        settlementAmount = 0
      } else if (totalTip !== null && refundAmount !== null && shareRate !== null) {
        settlementAmount = (totalTip - refundAmount) * shareRate
      }

      let status: string = 'matched'
      if (refundAmount !== null && totalTip !== null && refundAmount > totalTip) {
        status = 'needs_review'
      } else if (hasEmptyFields) {
        status = 'needs_review'
      } else if (!refund && !email) {
        status = 'needs_review'
      }

      if (p.anchorId === 'A004') {
        totalTip = null
        refundAmount = null
        shareRate = null
        settlementAmount = null
        status = 'needs_review'
      }

      insertSettlement.run(
        settlementId,
        p.anchorId,
        p.anchorName,
        totalTip,
        refundAmount,
        shareRate,
        settlementAmount,
        status,
        0,
        hasEmptyFields || p.anchorId === 'A004' ? 1 : 0,
        isFullRefund ? 1 : 0,
        0,
        new Date().toISOString()
      )

      insertPayment.run(
        generateId(),
        settlementId,
        p.transactionId,
        p.amount,
        p.time,
        p.platform
      )

      if (refund) {
        insertRefund.run(
          generateId(),
          settlementId,
          refund.requestId,
          refund.amount,
          refund.reason,
          refund.time
        )
      }

      if (email) {
        insertEmail.run(
          generateId(),
          settlementId,
          email.subject,
          email.rawContent,
          email.parsedAmount,
          email.note,
          email.receivedAt
        )
      }

      if (note) {
        insertNote.run(
          generateId(),
          settlementId,
          note.content,
          note.createdAt
        )
      }

      if (email && (email.note.includes('旧口径') || email.note.includes('旧合同'))) {
        const isOldContract = email.note.includes('旧合同')
        const chId = generateId()
        db.prepare(`
          INSERT INTO change_history (id, settlement_id, field, old_value, new_value, reason, operator, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          chId,
          settlementId,
          isOldContract ? 'shareRate' : 'settlementAmount',
          isOldContract ? '0.6' : '2050',
          isOldContract ? '0.5' : '2250',
          `审批邮件补充：${email.note}`,
          '系统',
          email.receivedAt
        )

        db.prepare('UPDATE settlement SET has_change_history = 1 WHERE id = ?')
          .run(settlementId)
      }

      count++
    }

    return count
  })

  const count = insertAll()
  return count
}
