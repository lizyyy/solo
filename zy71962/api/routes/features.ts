import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '../database.js'

const router = Router()

function buildFilterClause(query: Request['query']): { where: string, params: unknown[] } {
  const conditions: string[] = []
  const params: unknown[] = []

  if (query.featureName) {
    conditions.push('feature_name LIKE ?')
    params.push(`%${query.featureName}%`)
  }

  if (query.status && query.status !== 'all') {
    if (query.status === 'consistent') {
      conditions.push('is_consistent = 1')
    } else if (query.status === 'inconsistent') {
      conditions.push('is_consistent = 0')
    } else if (query.status === 'pending') {
      conditions.push('is_consistent IS NULL')
    }
  }

  if (query.dateFrom) {
    conditions.push('created_at >= ?')
    params.push(query.dateFrom)
  }

  if (query.dateTo) {
    conditions.push('created_at <= ?')
    params.push(query.dateTo)
  }

  const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''
  return { where, params }
}

const LEAK_PATTERNS = ['target', 'label', 'y_']

function detectLeak(featureName: string): { isLeak: boolean, pattern: string | null } {
  const lower = featureName.toLowerCase()
  for (const pattern of LEAK_PATTERNS) {
    if (lower.includes(pattern)) {
      return { isLeak: true, pattern }
    }
  }
  return { isLeak: false, pattern: null }
}

function judgeConsistency(trainingSpec: string, onlineSpec: string): {
  isConsistent: boolean | null
  inconsistentReason: string | null
  judgmentBasis: string | null
} {
  if (!trainingSpec || !onlineSpec) {
    return {
      isConsistent: null,
      inconsistentReason: onlineSpec ? '训练口径缺失' : '线上口径缺失',
      judgmentBasis: onlineSpec ? '训练口径缺失，无法比对' : '线上口径缺失，无法比对',
    }
  }

  if (trainingSpec === onlineSpec) {
    return {
      isConsistent: true,
      inconsistentReason: null,
      judgmentBasis: '训练口径与线上口径完全匹配',
    }
  }

  const reason = `训练口径使用${trainingSpec}类型，线上口径使用${onlineSpec}类型，存在类型不一致`
  return {
    isConsistent: false,
    inconsistentReason: reason,
    judgmentBasis: reason,
  }
}

router.get('/', (req: Request, res: Response): void => {
  try {
    const db = getDb()
    const { where, params } = buildFilterClause(req.query)

    const features = db.prepare(`SELECT * FROM feature_specs ${where} ORDER BY created_at DESC`).all(...params)

    const mapped = features.map((row: any) => ({
      id: row.id,
      featureName: row.feature_name,
      trainingSpec: row.training_spec,
      onlineSpec: row.online_spec,
      isConsistent: row.is_consistent === null ? null : row.is_consistent === 1,
      inconsistentReason: row.inconsistent_reason,
      judgmentBasis: row.judgment_basis,
      source: row.source,
      version: row.version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }))

    res.json({ success: true, data: mapped })
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) })
  }
})

router.post('/import', (req: Request, res: Response): void => {
  try {
    const { features, operator } = req.body

    if (!Array.isArray(features) || !operator) {
      res.status(400).json({ success: false, error: 'features数组或operator缺失' })
      return
    }

    const db = getDb()
    const now = new Date().toISOString()
    const imported: number[] = []
    const duplicates: Array<{ featureName: string, existingVersion: number, action: 'skipped' }> = []
    const newLeakAlerts: string[] = []

    const insertFeature = db.prepare(`
      INSERT INTO feature_specs (id, feature_name, training_spec, online_spec, is_consistent, inconsistent_reason, judgment_basis, source, version, created_at, updated_at)
      VALUES (@id, @featureName, @trainingSpec, @onlineSpec, @isConsistent, @inconsistentReason, @judgmentBasis, @source, @version, @createdAt, @updatedAt)
    `)

    const insertLeakAlert = db.prepare(`
      INSERT INTO leak_alerts (id, feature_name, source, description, next_step, responsible_person, is_resolved, detected_at, resolved_at)
      VALUES (@id, @featureName, @source, @description, @nextStep, @responsiblePerson, @isResolved, @detectedAt, @resolvedAt)
    `)

    const insertAuditLog = db.prepare(`
      INSERT INTO audit_logs (id, operation_type, operator, target_feature_id, target_feature_name, before_value, after_value, reason, filter_snapshot, created_at)
      VALUES (@id, @operationType, @operator, @targetFeatureId, @targetFeatureName, @beforeValue, @afterValue, @reason, @filterSnapshot, @createdAt)
    `)

    const transaction = db.transaction(() => {
      for (const f of features) {
        const existing = db.prepare('SELECT id, version FROM feature_specs WHERE feature_name = ?').get(f.featureName) as any

        if (existing) {
          duplicates.push({
            featureName: f.featureName,
            existingVersion: existing.version,
            action: 'skipped',
          })
          continue
        }

        const { isConsistent, inconsistentReason, judgmentBasis } = judgeConsistency(f.trainingSpec, f.onlineSpec)
        const id = uuidv4()

        insertFeature.run({
          id,
          featureName: f.featureName,
          trainingSpec: f.trainingSpec,
          onlineSpec: f.onlineSpec,
          isConsistent: isConsistent === null ? null : isConsistent ? 1 : 0,
          inconsistentReason,
          judgmentBasis,
          source: 'import',
          version: 1,
          createdAt: now,
          updatedAt: now,
        })

        imported.push(1)

        const leak = detectLeak(f.featureName)
        if (leak.isLeak) {
          const source = isConsistent === false ? 'evaluation_table' : 'online_feedback'
          const description = `特征名称包含"${leak.pattern}"，疑似训练数据泄漏到特征中`
          const nextStep = '移除该特征或确认其为合法特征'
          const responsiblePerson = '算法团队'

          insertLeakAlert.run({
            id: uuidv4(),
            featureName: f.featureName,
            source,
            description,
            nextStep,
            responsiblePerson,
            isResolved: 0,
            detectedAt: now,
            resolvedAt: null,
          })

          insertAuditLog.run({
            id: uuidv4(),
            operationType: 'leak_detected',
            operator,
            targetFeatureId: id,
            targetFeatureName: f.featureName,
            beforeValue: null,
            afterValue: null,
            reason: description,
            filterSnapshot: null,
            createdAt: now,
          })

          newLeakAlerts.push(f.featureName)
        }
      }

      const auditLogId = uuidv4()
      insertAuditLog.run({
        id: auditLogId,
        operationType: 'import',
        operator,
        targetFeatureId: null,
        targetFeatureName: null,
        beforeValue: null,
        afterValue: null,
        reason: `导入${features.length}个特征，成功${imported.length}个，跳过重复${duplicates.length}个`,
        filterSnapshot: null,
        createdAt: now,
      })
    })

    transaction()

    res.json({
      success: true,
      data: {
        imported: imported.length,
        duplicates,
        leakAlerts: newLeakAlerts,
      },
    })
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) })
  }
})

router.put('/:id/correct', (req: Request, res: Response): void => {
  try {
    const { id } = req.params
    const { trainingSpec, onlineSpec, reason, operator } = req.body

    if (!operator) {
      res.status(400).json({ success: false, error: 'operator缺失' })
      return
    }

    const db = getDb()
    const existing = db.prepare('SELECT * FROM feature_specs WHERE id = ?').get(id) as any

    if (!existing) {
      res.status(404).json({ success: false, error: '特征不存在' })
      return
    }

    const now = new Date().toISOString()
    const newTrainingSpec = trainingSpec ?? existing.training_spec
    const newOnlineSpec = onlineSpec ?? existing.online_spec
    const beforeValue = JSON.stringify({
      trainingSpec: existing.training_spec,
      onlineSpec: existing.online_spec,
    })
    const afterValue = JSON.stringify({
      trainingSpec: newTrainingSpec,
      onlineSpec: newOnlineSpec,
    })

    const { isConsistent, inconsistentReason, judgmentBasis } = judgeConsistency(newTrainingSpec, newOnlineSpec)

    const transaction = db.transaction(() => {
      db.prepare(`
        UPDATE feature_specs
        SET training_spec = ?, online_spec = ?, is_consistent = ?, inconsistent_reason = ?,
            judgment_basis = ?, source = 'correction', version = version + 1, updated_at = ?
        WHERE id = ?
      `).run(
        newTrainingSpec, newOnlineSpec,
        isConsistent === null ? null : isConsistent ? 1 : 0,
        inconsistentReason, judgmentBasis, now, id,
      )

      db.prepare(`
        INSERT INTO audit_logs (id, operation_type, operator, target_feature_id, target_feature_name, before_value, after_value, reason, filter_snapshot, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        uuidv4(), 'correction', operator, id, existing.feature_name,
        beforeValue, afterValue, reason || null, null, now,
      )
    })

    transaction()

    const updated = db.prepare('SELECT * FROM feature_specs WHERE id = ?').get(id) as any

    res.json({
      success: true,
      data: {
        id: updated.id,
        featureName: updated.feature_name,
        trainingSpec: updated.training_spec,
        onlineSpec: updated.online_spec,
        isConsistent: updated.is_consistent === null ? null : updated.is_consistent === 1,
        inconsistentReason: updated.inconsistent_reason,
        judgmentBasis: updated.judgment_basis,
        source: updated.source,
        version: updated.version,
        createdAt: updated.created_at,
        updatedAt: updated.updated_at,
      },
    })
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) })
  }
})

router.post('/:id/rollback', (req: Request, res: Response): void => {
  try {
    const { id } = req.params
    const { operator, reason } = req.body

    if (!operator) {
      res.status(400).json({ success: false, error: 'operator缺失' })
      return
    }

    const db = getDb()
    const existing = db.prepare('SELECT * FROM feature_specs WHERE id = ?').get(id) as any

    if (!existing) {
      res.status(404).json({ success: false, error: '特征不存在' })
      return
    }

    if (existing.version <= 1) {
      res.status(400).json({ success: false, error: '当前版本为初始版本，无法回滚' })
      return
    }

    const now = new Date().toISOString()
    const beforeValue = JSON.stringify({
      trainingSpec: existing.training_spec,
      onlineSpec: existing.online_spec,
      version: existing.version,
    })

    const correctionLog = db.prepare(
      `SELECT before_value FROM audit_logs WHERE target_feature_id = ? AND operation_type = 'correction' ORDER BY created_at DESC LIMIT 1`
    ).get(id) as any

    let prevTrainingSpec = existing.training_spec
    let prevOnlineSpec = existing.online_spec

    if (correctionLog?.before_value) {
      try {
        const prev = JSON.parse(correctionLog.before_value)
        prevTrainingSpec = prev.trainingSpec ?? prevTrainingSpec
        prevOnlineSpec = prev.onlineSpec ?? prevOnlineSpec
      } catch {}
    }

    const { isConsistent, inconsistentReason, judgmentBasis } = judgeConsistency(prevTrainingSpec, prevOnlineSpec)

    const afterValue = JSON.stringify({
      trainingSpec: prevTrainingSpec,
      onlineSpec: prevOnlineSpec,
      version: existing.version - 1,
    })

    const transaction = db.transaction(() => {
      db.prepare(`
        UPDATE feature_specs
        SET training_spec = ?, online_spec = ?, is_consistent = ?, inconsistent_reason = ?,
            judgment_basis = ?, source = 'correction', version = version - 1, updated_at = ?
        WHERE id = ?
      `).run(
        prevTrainingSpec, prevOnlineSpec,
        isConsistent === null ? null : isConsistent ? 1 : 0,
        inconsistentReason, judgmentBasis, now, id,
      )

      db.prepare(`
        INSERT INTO audit_logs (id, operation_type, operator, target_feature_id, target_feature_name, before_value, after_value, reason, filter_snapshot, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        uuidv4(), 'rollback', operator, id, existing.feature_name,
        beforeValue, afterValue, reason || `回滚至版本${existing.version - 1}`, null, now,
      )
    })

    transaction()

    const updated = db.prepare('SELECT * FROM feature_specs WHERE id = ?').get(id) as any

    res.json({
      success: true,
      data: {
        id: updated.id,
        featureName: updated.feature_name,
        trainingSpec: updated.training_spec,
        onlineSpec: updated.online_spec,
        isConsistent: updated.is_consistent === null ? null : updated.is_consistent === 1,
        inconsistentReason: updated.inconsistent_reason,
        judgmentBasis: updated.judgment_basis,
        source: updated.source,
        version: updated.version,
        createdAt: updated.created_at,
        updatedAt: updated.updated_at,
      },
    })
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) })
  }
})

export default router
