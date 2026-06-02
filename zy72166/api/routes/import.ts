import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import db from '../db.js'
import { runPrecheck, getPrecheckWarnings } from '../services/precheck.js'
import { seedProject } from '../seed.js'

const router = Router()

router.post('/:id/import', (req: Request, res: Response): void => {
  try {
    const { id } = req.params
    const project = db.prepare(`SELECT * FROM projects WHERE id = ?`).get(id) as any
    if (!project) {
      res.status(404).json({ success: false, error: '项目不存在' })
      return
    }

    const { source, records } = req.body as {
      source: 'sunlight' | 'ledger'
      records: Array<Record<string, any>>
    }

    if (!source || !records || !Array.isArray(records)) {
      res.status(400).json({ success: false, error: '需要source和records参数' })
      return
    }

    const insertRecord = db.prepare(`
      INSERT INTO import_records (id, project_id, source, raw_row, location_name, address, longitude, latitude, period, sunlight_hours, complaint, remark, raw_remark, imported_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `)

    const transaction = db.transaction(() => {
      const insertedIds: string[] = []
      for (const record of records) {
        const recordId = uuidv4()
        insertRecord.run(
          recordId,
          id,
          source,
          JSON.stringify(record),
          record.location_name || record['点位名称'] || '',
          record.address || record['地址'] || '',
          parseFloat(record.longitude || record['经度'] || '') || null,
          parseFloat(record.latitude || record['纬度'] || '') || null,
          record.period || record['时段'] || '',
          parseFloat(record.sunlight_hours || record['日照时长'] || '') || null,
          record.complaint || record['投诉情况'] || null,
          record.remark || record['备注'] || null,
          String(record.raw_remark || record.remark || record['备注'] || ''),
        )
        insertedIds.push(recordId)
      }

      db.prepare(`UPDATE projects SET status = 'prechecking', updated_at = datetime('now') WHERE id = ?`).run(id)
      return insertedIds
    })

    const insertedIds = transaction()

    runPrecheck(id)

    res.status(201).json({
      success: true,
      data: { importedCount: insertedIds.length, recordIds: insertedIds },
    })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

router.get('/:id/precheck', (req: Request, res: Response): void => {
  try {
    const warnings = getPrecheckWarnings(req.params.id)
    res.json({ success: true, data: warnings })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

router.post('/:id/seed', (req: Request, res: Response): void => {
  try {
    const { id } = req.params
    const project = db.prepare(`SELECT * FROM projects WHERE id = ?`).get(id) as any
    if (!project) {
      res.status(404).json({ success: false, error: '项目不存在' })
      return
    }

    seedProject(id)
    runPrecheck(id)

    res.json({ success: true, data: { message: '种子数据已加载' } })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

export default router
