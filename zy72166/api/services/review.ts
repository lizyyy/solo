import { v4 as uuidv4 } from 'uuid'
import db from '../db.js'

export function updateReviewStatus(
  reviewItemId: string,
  newStatus: string,
  newVerdict: string | null,
  reason: string,
  author: string
): any {
  const review = db.prepare(`SELECT * FROM review_items WHERE id = ?`).get(reviewItemId) as any
  if (!review) throw new Error('Review item not found')

  const transaction = db.transaction(() => {
    db.prepare(`
      INSERT INTO review_history (id, review_item_id, old_status, new_status, old_verdict, new_verdict, reason, author, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      uuidv4(),
      reviewItemId,
      review.status,
      newStatus,
      review.verdict,
      newVerdict,
      reason,
      author
    )

    db.prepare(`
      UPDATE review_items SET status = ?, verdict = ? WHERE id = ?
    `).run(newStatus, newVerdict, reviewItemId)

    db.prepare(`
      UPDATE projects SET updated_at = datetime('now') WHERE id = ?
    `).run(review.project_id)
  })

  transaction()

  return db.prepare(`SELECT * FROM review_items WHERE id = ?`).get(reviewItemId)
}

export function addNote(
  reviewItemId: string,
  content: string,
  author: string
): any {
  const review = db.prepare(`SELECT * FROM review_items WHERE id = ?`).get(reviewItemId) as any
  if (!review) throw new Error('Review item not found')

  const lastNote = db.prepare(
    `SELECT * FROM review_notes WHERE review_item_id = ? ORDER BY rowid DESC LIMIT 1`
  ).get(reviewItemId) as any

  let diffFromPrevious: string | null = null
  if (lastNote) {
    const oldLines = lastNote.content.split('\n')
    const newLines = content.split('\n')
    const added = newLines.filter((line: string) => !oldLines.includes(line))
    const removed = oldLines.filter((line: string) => !newLines.includes(line))
    const parts: string[] = []
    if (removed.length > 0) parts.push(`- ${removed.join('\n- ')}`)
    if (added.length > 0) parts.push(`+ ${added.join('\n+ ')}`)
    diffFromPrevious = parts.join('\n') || null
  }

  const noteId = uuidv4()
  db.prepare(`
    INSERT INTO review_notes (id, review_item_id, content, author, diff_from_previous, created_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
  `).run(noteId, reviewItemId, content, author, diffFromPrevious)

  return db.prepare(`SELECT * FROM review_notes WHERE id = ?`).get(noteId)
}

export function getDiff(reviewItemId: string): any {
  const notes = db.prepare(
    `SELECT *, rowid as _rowid FROM review_notes WHERE review_item_id = ? ORDER BY _rowid DESC LIMIT 2`
  ).all(reviewItemId) as any[]

  if (notes.length < 2) {
    return { diff: notes.length === 1 ? notes[0].diff_from_previous : null }
  }

  return { diff: notes[0].diff_from_previous }
}

export function resolveConflict(
  reviewItemId: string,
  resolution: string,
  resolvedBy: string
): any {
  const review = db.prepare(`SELECT * FROM review_items WHERE id = ?`).get(reviewItemId) as any
  if (!review) throw new Error('Review item not found')
  if (review.status !== 'conflict') throw new Error('Review item is not in conflict status')

  let newStatus = 'passed'
  if (resolution === 'needs_field_visit') newStatus = 'needs_field_visit'

  const transaction = db.transaction(() => {
    const paired = db.prepare(`
      SELECT id FROM review_items
      WHERE project_id = ? AND record_id != ? AND status = 'conflict'
      AND (
        (conflict_ledger_evidence = ? AND conflict_import_evidence = ?)
        OR (conflict_ledger_evidence IS NOT NULL AND conflict_import_evidence IS NOT NULL AND conflict_suggestion = ?)
      )
    `).all(review.project_id, review.record_id, review.conflict_ledger_evidence, review.conflict_import_evidence, review.conflict_suggestion) as any[]

    const allIds = [reviewItemId, ...paired.map((p: any) => p.id)]

    for (const rid of allIds) {
      db.prepare(`
        INSERT INTO review_history (id, review_item_id, old_status, new_status, old_verdict, new_verdict, reason, author, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).run(
        uuidv4(),
        rid,
        'conflict',
        newStatus,
        null,
        resolution,
        `冲突裁决：${resolution}`,
        resolvedBy
      )

      db.prepare(`
        UPDATE review_items
        SET conflict_resolution = ?, conflict_resolved_by = ?, conflict_resolved_at = datetime('now'), status = ?, verdict = ?
        WHERE id = ?
      `).run(resolution, resolvedBy, newStatus, resolution, rid)
    }

    db.prepare(`
      UPDATE projects SET updated_at = datetime('now') WHERE id = ?
    `).run(review.project_id)
  })

  transaction()

  return db.prepare(`SELECT * FROM review_items WHERE id = ?`).get(reviewItemId)
}

export function getHistory(reviewItemId: string): any[] {
  return db.prepare(
    `SELECT * FROM review_history WHERE review_item_id = ? ORDER BY created_at DESC`
  ).all(reviewItemId)
}
