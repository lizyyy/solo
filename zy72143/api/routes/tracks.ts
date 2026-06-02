import { Router, type Request, type Response } from 'express'
import db, { insertAuditLog } from '../db.js'

const router = Router()

router.get('/', (req: Request, res: Response): void => {
  const { status, search } = req.query
  let sql = 'SELECT * FROM tracks WHERE 1=1'
  const params: unknown[] = []

  if (status) {
    sql += ' AND status = ?'
    params.push(status)
  }

  if (search) {
    sql += ' AND name LIKE ?'
    params.push(`%${search}%`)
  }

  sql += ' ORDER BY id ASC'

  const tracks = db.prepare(sql).all(...params)
  res.json({ success: true, data: tracks })
})

router.get('/:id', (req: Request, res: Response): void => {
  const track = db.prepare('SELECT * FROM tracks WHERE id = ?').get(req.params.id)

  if (!track) {
    res.status(404).json({ success: false, error: 'Track not found' })
    return
  }

  res.json({ success: true, data: track })
})

router.put('/:id', (req: Request, res: Response): void => {
  const trackId = Number(req.params.id)
  const existing = db.prepare('SELECT * FROM tracks WHERE id = ?').get(trackId) as Record<string, unknown> | undefined

  if (!existing) {
    res.status(404).json({ success: false, error: 'Track not found' })
    return
  }

  const { status, operatorNote, processedBy } = req.body
  const updates: string[] = []
  const values: unknown[] = []

  if (status !== undefined) {
    updates.push('status = ?')
    values.push(status)
  }

  if (operatorNote !== undefined) {
    updates.push('operator_note = ?')
    values.push(operatorNote)
  }

  if (processedBy !== undefined) {
    updates.push('processed_by = ?')
    values.push(processedBy)
  }

  if (updates.length === 0) {
    res.status(400).json({ success: false, error: 'No fields to update' })
    return
  }

  updates.push("updated_at = datetime('now')")
  updates.push("processed_at = datetime('now')")
  values.push(trackId)

  db.prepare(`UPDATE tracks SET ${updates.join(', ')} WHERE id = ?`).run(...values)

  if (status !== undefined && status !== existing.status) {
    const oldStatus = existing.status as string
    const oldVersion = existing.version as string
    insertAuditLog({
      track_id: trackId,
      track_name: existing.name as string,
      operator: processedBy || 'system',
      action: 'status_change',
      old_value: oldStatus,
      new_value: status,
      detail: `状态从 "${oldStatus}" 变更为 "${status}"，曲目版本: ${oldVersion}`,
    })
  }

  if (operatorNote !== undefined) {
    insertAuditLog({
      track_id: trackId,
      track_name: existing.name as string,
      operator: processedBy || 'system',
      action: 'operator_note',
      new_value: operatorNote,
      detail: '操作员添加备注',
    })
  }

  const updated = db.prepare('SELECT * FROM tracks WHERE id = ?').get(trackId)
  res.json({ success: true, data: updated })
})

router.post('/clean', (req: Request, res: Response): void => {
  const tracks = db.prepare('SELECT * FROM tracks ORDER BY id ASC').all() as Record<string, unknown>[]

  const nameVersionMap = new Map<string, Record<string, unknown>[]>()
  for (const track of tracks) {
    const key = `${track.name}::${track.version}`
    if (!nameVersionMap.has(key)) {
      nameVersionMap.set(key, [])
    }
    nameVersionMap.get(key)!.push(track)
  }

  const nameMap = new Map<string, Record<string, unknown>[]>()
  for (const track of tracks) {
    const key = track.name as string
    if (!nameMap.has(key)) {
      nameMap.set(key, [])
    }
    nameMap.get(key)!.push(track)
  }

  const suggestions: Record<string, string> = {
    old_master: '检测到旧版母带，版本低于当前最新版。请确认是否保留旧版，如不再使用建议标记为已废弃，避免覆盖新版文件。',
    duplicate: '检测到重复曲目（同名同版本）。请核实哪条为正确记录，保留一条并将其余标记为重复。',
    missing_auth: '缺少授权信息（合同编号或授权期限为空）。请补充合同备注中的授权起止日期后再通过。',
    manual_rename: '此曲目由人工改名录入，原名可能与现有记录重复。请核实改名原因并确认是否需要合并。',
    none: '曲目信息完整，无异常，可直接通过。',
  }

  const now = new Date()
  const today = now.toISOString().split('T')[0]
  let updatedCount = 0

  const updateStmt = db.prepare(`
    UPDATE tracks
    SET status = ?, anomaly_type = ?, anomaly_detail = ?, processing_suggestion = ?, updated_at = datetime('now')
    WHERE id = ?
  `)

  const transaction = db.transaction(() => {
    for (const track of tracks) {
      let anomalyType: string | null = null
      let anomalyDetail = ''
      let status = 'passed'

      const key = `${track.name}::${track.version}`
      const sameNameVersion = nameVersionMap.get(key) || []
      if (sameNameVersion.length > 1) {
        anomalyType = 'duplicate'
        anomalyDetail = `同名同版本曲目共 ${sameNameVersion.length} 条记录`
        status = 'needs_review'
      }

      if (!anomalyType) {
        const sameName = nameMap.get(track.name as string) || []
        const versions = sameName.map(t => t.version as string)
        if (versions.includes('v2') && track.version === 'v1') {
          anomalyType = 'old_master'
          anomalyDetail = `存在更高版本 v2，当前为旧版 v1`
          status = 'needs_review'
        }
      }

      if (!anomalyType) {
        if (!track.contract_id || !track.auth_start_date || !track.auth_end_date) {
          anomalyType = 'missing_auth'
          const missing: string[] = []
          if (!track.contract_id) missing.push('合同编号')
          if (!track.auth_start_date) missing.push('授权开始日期')
          if (!track.auth_end_date) missing.push('授权结束日期')
          anomalyDetail = `缺少: ${missing.join('、')}`
          status = 'needs_review'
        }
      }

      if (!anomalyType) {
        if (track.source === 'manual') {
          anomalyType = 'manual_rename'
          anomalyDetail = '人工改名录入'
          status = 'needs_review'
        }
      }

      if (!anomalyType) {
        if (track.auth_end_date && track.auth_end_date as string < today) {
          status = 'old_caliber'
          anomalyType = 'none'
          anomalyDetail = '授权已过期'
        }
      }

      if (!anomalyType) {
        anomalyType = 'none'
      }

      let suggestion = suggestions[anomalyType] || suggestions['none']
      if (status === 'old_caliber') {
        suggestion = '旧口径录入，授权已过期。请确认是否需要续约授权，如不再使用建议标记为旧口径存档。'
      }

      updateStmt.run(status, anomalyType, anomalyDetail, suggestion, track.id)
      updatedCount++

      insertAuditLog({
        track_id: track.id as number,
        track_name: track.name as string,
        operator: 'system',
        action: 'clean',
        old_value: JSON.stringify({ status: track.status, anomaly_type: track.anomaly_type }),
        new_value: JSON.stringify({ status, anomaly_type: anomalyType }),
        detail: `清洗检测: ${anomalyDetail || '无异常'}`,
      })
    }
  })

  transaction()

  res.json({ success: true, data: { updatedCount } })
})

export default router
