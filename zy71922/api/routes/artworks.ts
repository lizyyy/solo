import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '../db.js'

const router = Router()

router.get('/artworks', (req: Request, res: Response): void => {
  try {
    const { status, source, disputed, page = '1', limit = '20' } = req.query
    const db = getDb()

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1)
    const limitNum = Math.max(1, Math.min(100, parseInt(limit as string, 10) || 20))
    const offset = (pageNum - 1) * limitNum

    const whereClauses: string[] = []
    const params: any[] = []

    if (status) {
      whereClauses.push('a.status = ?')
      params.push(status)
    }
    if (source) {
      whereClauses.push('EXISTS (SELECT 1 FROM source_links sl WHERE sl.artwork_id = a.id AND sl.source_type = ?)')
      params.push(source)
    }
    if (disputed === 'true' || disputed === '1') {
      whereClauses.push('EXISTS (SELECT 1 FROM disputes d WHERE d.artwork_id = a.id AND d.resolved = 0)')
    }

    const whereStr = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : ''

    const countRow = db.prepare(`SELECT COUNT(*) as total FROM artworks a ${whereStr}`).get(...params) as { total: number }
    const rows = db.prepare(`SELECT a.* FROM artworks a ${whereStr} ORDER BY a.created_at DESC LIMIT ? OFFSET ?`).all(...params, limitNum, offset) as any[]

    res.json({
      success: true,
      data: {
        items: rows,
        total: countRow.total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(countRow.total / limitNum),
      },
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.get('/artworks/:id', (req: Request, res: Response): void => {
  try {
    const { id } = req.params
    const db = getDb()

    const artwork = db.prepare('SELECT * FROM artworks WHERE id = ?').get(id) as any
    if (!artwork) {
      res.status(404).json({ success: false, error: '作品未找到' })
      return
    }

    const sources = db.prepare('SELECT * FROM source_links WHERE artwork_id = ?').all(id)
    const corrections = db.prepare('SELECT * FROM corrections WHERE artwork_id = ? ORDER BY created_at DESC').all(id)
    const disputes = db.prepare('SELECT * FROM disputes WHERE artwork_id = ? ORDER BY created_at DESC').all(id)

    res.json({
      success: true,
      data: { ...artwork, sources, corrections, disputes },
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.patch('/artworks/:id', (req: Request, res: Response): void => {
  try {
    const { id } = req.params
    const { field, old_value, new_value, reason } = req.body
    const db = getDb()

    if (!field || new_value === undefined || !reason) {
      res.status(400).json({ success: false, error: 'field, new_value, reason 为必填项' })
      return
    }

    const artwork = db.prepare('SELECT * FROM artworks WHERE id = ?').get(id) as any
    if (!artwork) {
      res.status(404).json({ success: false, error: '作品未找到' })
      return
    }

    const allowedFields = ['title', 'artist', 'dimensions', 'dimension_unit', 'medium', 'year', 'status']
    if (!allowedFields.includes(field)) {
      res.status(400).json({ success: false, error: `不允许修改字段: ${field}` })
      return
    }

    const actualOldValue = old_value ?? String(artwork[field] ?? '')
    const correctionId = uuidv4()
    const now = new Date().toISOString()

    const transaction = db.transaction(() => {
      db.prepare(
        `INSERT INTO corrections (id, artwork_id, field, old_value, new_value, reason) VALUES (?, ?, ?, ?, ?, ?)`
      ).run(correctionId, id, field, String(actualOldValue), String(new_value), reason)

      db.prepare(`UPDATE artworks SET ${field} = ?, updated_at = ?, status = 'corrected' WHERE id = ?`).run(String(new_value), now, id)
    })

    transaction()

    const updated = db.prepare('SELECT * FROM artworks WHERE id = ?').get(id)

    res.json({ success: true, data: updated })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.post('/artworks/:id/corrections', (req: Request, res: Response): void => {
  try {
    const { id } = req.params
    const { field, old_value, new_value, reason } = req.body
    const db = getDb()

    if (!field || new_value === undefined || !reason) {
      res.status(400).json({ success: false, error: 'field, new_value, reason 为必填项' })
      return
    }

    const artwork = db.prepare('SELECT * FROM artworks WHERE id = ?').get(id) as any
    if (!artwork) {
      res.status(404).json({ success: false, error: '作品未找到' })
      return
    }

    const allowedFields = ['title', 'artist', 'dimensions', 'dimension_unit', 'medium', 'year', 'status']
    if (!allowedFields.includes(field)) {
      res.status(400).json({ success: false, error: `不允许修改字段: ${field}` })
      return
    }

    const actualOldValue = old_value ?? String(artwork[field] ?? '')
    const correctionId = uuidv4()
    const now = new Date().toISOString()

    const transaction = db.transaction(() => {
      db.prepare(
        `INSERT INTO corrections (id, artwork_id, field, old_value, new_value, reason) VALUES (?, ?, ?, ?, ?, ?)`
      ).run(correctionId, id, field, String(actualOldValue), String(new_value), reason)

      db.prepare(`UPDATE artworks SET ${field} = ?, updated_at = ?, status = 'corrected' WHERE id = ?`).run(String(new_value), now, id)
    })

    transaction()

    const correction = db.prepare('SELECT * FROM corrections WHERE id = ?').get(correctionId)

    res.status(201).json({ success: true, data: correction })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.get('/artworks/:id/sources', (req: Request, res: Response): void => {
  try {
    const { id } = req.params
    const db = getDb()

    const artwork = db.prepare('SELECT id FROM artworks WHERE id = ?').get(id) as any
    if (!artwork) {
      res.status(404).json({ success: false, error: '作品未找到' })
      return
    }

    const sources = db.prepare('SELECT * FROM source_links WHERE artwork_id = ? ORDER BY imported_at DESC').all(id)

    res.json({ success: true, data: sources })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.post('/artworks/:id/disputes', (req: Request, res: Response): void => {
  try {
    const { id } = req.params
    const { field, current_value, dispute_reason, correction_basis, source_reference } = req.body
    const db = getDb()

    if (!field || !dispute_reason) {
      res.status(400).json({ success: false, error: 'field 和 dispute_reason 为必填项' })
      return
    }

    const artwork = db.prepare('SELECT * FROM artworks WHERE id = ?').get(id) as any
    if (!artwork) {
      res.status(404).json({ success: false, error: '作品未找到' })
      return
    }

    const disputeId = uuidv4()
    const now = new Date().toISOString()

    const transaction = db.transaction(() => {
      db.prepare(
        `INSERT INTO disputes (id, artwork_id, field, current_value, dispute_reason, correction_basis, source_reference) VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(disputeId, id, field, current_value ?? null, dispute_reason, correction_basis ?? null, source_reference ?? null)

      db.prepare(`UPDATE artworks SET status = 'disputed', updated_at = ? WHERE id = ?`).run(now, id)
    })

    transaction()

    const dispute = db.prepare('SELECT * FROM disputes WHERE id = ?').get(disputeId)

    res.status(201).json({ success: true, data: dispute })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.patch('/disputes/:id', (req: Request, res: Response): void => {
  try {
    const { id } = req.params
    const { resolved: resolvedValue } = req.body
    const db = getDb()

    if (resolvedValue === undefined) {
      res.status(400).json({ success: false, error: 'resolved 为必填项' })
      return
    }

    const dispute = db.prepare('SELECT * FROM disputes WHERE id = ?').get(id) as any
    if (!dispute) {
      res.status(404).json({ success: false, error: '争议未找到' })
      return
    }

    if (dispute.resolved) {
      res.status(400).json({ success: false, error: '该争议已解决' })
      return
    }

    const now = new Date().toISOString()

    const transaction = db.transaction(() => {
      db.prepare(`UPDATE disputes SET resolved = 1, resolved_at = ? WHERE id = ?`).run(now, id)

      const remainingDisputes = db.prepare(
        `SELECT COUNT(*) as cnt FROM disputes WHERE artwork_id = ? AND resolved = 0`
      ).get(dispute.artwork_id) as { cnt: number }

      if (remainingDisputes.cnt === 0) {
        const hasCorrections = db.prepare(
          `SELECT COUNT(*) as cnt FROM corrections WHERE artwork_id = ? AND reverted = 0`
        ).get(dispute.artwork_id) as { cnt: number }

        if (hasCorrections.cnt > 0) {
          db.prepare(`UPDATE artworks SET status = 'corrected', updated_at = ? WHERE id = ?`).run(now, dispute.artwork_id)
        } else {
          db.prepare(`UPDATE artworks SET status = 'checked', updated_at = ? WHERE id = ?`).run(now, dispute.artwork_id)
        }
      }
    })

    transaction()

    const updated = db.prepare('SELECT * FROM disputes WHERE id = ?').get(id)

    res.json({ success: true, data: updated })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router
