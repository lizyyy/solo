import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import db from '../db.js'

const router = Router()

router.post('/import', (req: Request, res: Response): void => {
  const { items, importedBy = 'system' } = req.body

  if (!items || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ success: false, error: 'items is required and must be a non-empty array' })
    return
  }

  const latestVersion = db.prepare('SELECT version FROM param_versions ORDER BY version DESC LIMIT 1').get() as { version: number } | undefined
  const newVersion = latestVersion ? latestVersion.version + 1 : 1

  const latestVersionId = db.prepare('SELECT id FROM param_versions ORDER BY version DESC LIMIT 1').get() as { id: string } | undefined
  const existingItems = latestVersionId
    ? db.prepare('SELECT name FROM param_items WHERE version_id = ?').all(latestVersionId.id) as { name: string }[]
    : []

  const existingNames = new Set(existingItems.map(i => i.name))

  const duplicates: { name: string }[] = []
  const newItems: { name: string; value: string; rationale?: string; is_denominator_zero?: number; raw_denominator_value?: string }[] = []

  for (const item of items) {
    if (existingNames.has(item.name)) {
      duplicates.push({ name: item.name })
    } else {
      newItems.push(item)
    }
  }

  const versionId = uuidv4()
  const insertVersion = db.prepare('INSERT INTO param_versions (id, version, imported_by, item_count, change_summary) VALUES (?, ?, ?, ?, ?)')
  const insertItem = db.prepare('INSERT INTO param_items (id, version_id, name, value, rationale, is_denominator_zero, raw_denominator_value, review_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')

  const transaction = db.transaction(() => {
    insertVersion.run(versionId, newVersion, importedBy, newItems.length, `导入 ${newItems.length} 条参数，${duplicates.length} 条重复`)

    for (const item of newItems) {
      insertItem.run(
        uuidv4(),
        versionId,
        item.name,
        item.value ?? '',
        item.rationale ?? '',
        item.is_denominator_zero ?? 0,
        item.raw_denominator_value ?? '',
        'normal'
      )
    }
  })

  transaction()

  res.json({
    success: true,
    data: {
      versionId,
      version: newVersion,
      duplicateCount: duplicates.length,
      importedCount: newItems.length,
      duplicates
    }
  })
})

router.get('/versions', (_req: Request, res: Response): void => {
  const versions = db.prepare('SELECT * FROM param_versions ORDER BY version DESC').all()
  res.json({ success: true, data: versions })
})

router.get('/items', (req: Request, res: Response): void => {
  const { versionId } = req.query

  let targetVersionId = versionId as string | undefined

  if (!targetVersionId) {
    const latest = db.prepare('SELECT id FROM param_versions ORDER BY version DESC LIMIT 1').get() as { id: string } | undefined
    if (!latest) {
      res.json({ success: true, data: [] })
      return
    }
    targetVersionId = latest.id
  }

  const items = db.prepare('SELECT * FROM param_items WHERE version_id = ?').all(targetVersionId)
  res.json({ success: true, data: items })
})

export default router
