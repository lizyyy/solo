import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '../db.js'

const router = Router()

router.post('/import', (req: Request, res: Response): void => {
  try {
    const { source_type, source_title, data } = req.body
    const db = getDb()

    if (!source_type || !source_title || !Array.isArray(data)) {
      res.status(400).json({ success: false, error: 'source_type, source_title, data 为必填项' })
      return
    }

    const batchId = uuidv4()
    let importedCount = 0
    let duplicateCount = 0
    const errors: string[] = []
    const duplicateEntries: any[] = []

    const insertArtwork = db.prepare(
      `INSERT INTO artworks (id, title, artist, dimensions, dimension_unit, medium, year, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    const insertSource = db.prepare(
      `INSERT INTO source_links (id, artwork_id, source_type, source_title, source_summary, source_data) VALUES (?, ?, ?, ?, ?, ?)`
    )
    const insertDuplicate = db.prepare(
      `INSERT INTO duplicates (id, batch_id, existing_artwork_id, incoming_data, match_fields) VALUES (?, ?, ?, ?, ?)`
    )

    const transaction = db.transaction(() => {
      db.prepare(
        `INSERT INTO import_batches (id, source_type, source_title, total_rows, imported_count, duplicate_count) VALUES (?, ?, ?, ?, ?, ?)`
      ).run(batchId, source_type, source_title, data.length, 0, 0)

      for (const item of data) {
        try {
          const existing = db.prepare(
            `SELECT id FROM artworks WHERE title = ? AND artist = ?`
          ).get(item.title, item.artist) as any

          if (existing) {
            duplicateCount++
            const dupId = uuidv4()
            insertDuplicate.run(dupId, batchId, existing.id, JSON.stringify(item), JSON.stringify(['title', 'artist']))
            duplicateEntries.push({ id: dupId, existing_artwork_id: existing.id, incoming_data: item })
          } else {
            const artworkId = uuidv4()
            insertArtwork.run(
              artworkId,
              item.title,
              item.artist,
              item.dimensions ?? null,
              item.dimension_unit ?? 'cm',
              item.medium ?? null,
              item.year ?? null,
              'unchecked'
            )
            insertSource.run(
              uuidv4(),
              artworkId,
              source_type,
              source_title,
              item.source_summary ?? null,
              item.source_data ? JSON.stringify(item.source_data) : null
            )
            importedCount++
          }
        } catch (err: any) {
          errors.push(`行 "${item.title}": ${err.message}`)
        }
      }

      db.prepare(
        `UPDATE import_batches SET imported_count = ?, duplicate_count = ? WHERE id = ?`
      ).run(importedCount, duplicateCount, batchId)
    })

    transaction()

    res.status(201).json({
      success: true,
      data: {
        imported: importedCount,
        duplicates: duplicateEntries,
        errors,
      },
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.post('/import/resolve', (req: Request, res: Response): void => {
  try {
    const { duplicate_id, action, reason } = req.body
    const db = getDb()

    if (!duplicate_id || !action) {
      res.status(400).json({ success: false, error: 'duplicate_id 和 action 为必填项' })
      return
    }

    if (!['merge', 'overwrite', 'skip'].includes(action)) {
      res.status(400).json({ success: false, error: 'action 必须为 merge, overwrite 或 skip' })
      return
    }

    const duplicate = db.prepare('SELECT * FROM duplicates WHERE id = ?').get(duplicate_id) as any
    if (!duplicate) {
      res.status(404).json({ success: false, error: '重复记录未找到' })
      return
    }

    if (duplicate.resolution) {
      res.status(400).json({ success: false, error: '该重复记录已解决' })
      return
    }

    const now = new Date().toISOString()
    const incomingData = JSON.parse(duplicate.incoming_data)

    const batch = db.prepare('SELECT * FROM import_batches WHERE id = ?').get(duplicate.batch_id) as any

    const transaction = db.transaction(() => {
      db.prepare(
        `UPDATE duplicates SET resolution = ?, reason = ?, resolved_at = ? WHERE id = ?`
      ).run(action, reason ?? null, now, duplicate_id)

      if (action === 'merge') {
        db.prepare(
          `INSERT INTO source_links (id, artwork_id, source_type, source_title, source_data) VALUES (?, ?, ?, ?, ?)`
        ).run(uuidv4(), duplicate.existing_artwork_id, batch?.source_type ?? 'artwork_list', batch?.source_title ?? '', JSON.stringify(incomingData))
      } else if (action === 'overwrite') {
        const fields: string[] = []
        const values: any[] = []

        if (incomingData.dimensions !== undefined) { fields.push('dimensions = ?'); values.push(incomingData.dimensions) }
        if (incomingData.dimension_unit !== undefined) { fields.push('dimension_unit = ?'); values.push(incomingData.dimension_unit) }
        if (incomingData.medium !== undefined) { fields.push('medium = ?'); values.push(incomingData.medium) }
        if (incomingData.year !== undefined) { fields.push('year = ?'); values.push(incomingData.year) }

        if (fields.length > 0) {
          fields.push('updated_at = ?')
          values.push(now)
          values.push(duplicate.existing_artwork_id)
          db.prepare(`UPDATE artworks SET ${fields.join(', ')} WHERE id = ?`).run(...values)
        }

        db.prepare(
          `INSERT INTO source_links (id, artwork_id, source_type, source_title, source_data) VALUES (?, ?, ?, ?, ?)`
        ).run(uuidv4(), duplicate.existing_artwork_id, batch?.source_type ?? 'artwork_list', batch?.source_title ?? '', JSON.stringify(incomingData))
      }
    })

    transaction()

    const updated = db.prepare('SELECT * FROM duplicates WHERE id = ?').get(duplicate_id)

    res.json({ success: true, data: updated })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router
