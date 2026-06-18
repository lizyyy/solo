import { v4 as uuidv4 } from 'uuid'
import db from '../db.js'

interface ImportRecord {
  id: string
  project_id: string
  source: string
  raw_row: string
  location_name: string
  address: string
  longitude: number | null
  latitude: number | null
  period: string
  sunlight_hours: number | null
  complaint: string | null
  remark: string | null
  raw_remark: string
  imported_at: string
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function detect_same_name(records: ImportRecord[], projectId: string): Array<{ type: string; severity: string; recordIds: string[]; description: string; originalValues: Record<string, string> }> {
  const warnings: Array<{ type: string; severity: string; recordIds: string[]; description: string; originalValues: Record<string, string> }> = []
  const nameGroups = new Map<string, ImportRecord[]>()

  for (const r of records) {
    const key = r.location_name
    if (!nameGroups.has(key)) nameGroups.set(key, [])
    nameGroups.get(key)!.push(r)
  }

  for (const [name, group] of nameGroups) {
    if (group.length > 1) {
      const hasDiffCoords = group.some((r, i) =>
        group.some((other, j) => {
          if (i >= j) return false
          if (r.longitude == null || r.latitude == null || other.longitude == null || other.latitude == null) return false
          return r.longitude !== other.longitude || r.latitude !== other.latitude
        })
      )
      if (hasDiffCoords) {
        warnings.push({
          type: 'same_name',
          severity: 'warning',
          recordIds: group.map((r) => r.id),
          description: `同名路口"${name}"存在${group.length}条坐标不同的记录，可能是不同地点`,
          originalValues: Object.fromEntries(group.map((r) => [r.id, `地址:${r.address} 坐标:${r.longitude},${r.latitude}`]))
        })
      }
    }
  }

  return warnings
}

function detect_duplicate_complaint(records: ImportRecord[], projectId: string): Array<{ type: string; severity: string; recordIds: string[]; description: string; originalValues: Record<string, string> }> {
  const warnings: Array<{ type: string; severity: string; recordIds: string[]; description: string; originalValues: Record<string, string> }> = []
  const complaintGroups = new Map<string, ImportRecord[]>()

  for (const r of records) {
    if (r.complaint && r.complaint.trim()) {
      const key = `${r.address}|||${r.complaint}`
      if (!complaintGroups.has(key)) complaintGroups.set(key, [])
      complaintGroups.get(key)!.push(r)
    }
  }

  for (const [, group] of complaintGroups) {
    if (group.length > 1) {
      warnings.push({
        type: 'duplicate_complaint',
        severity: 'info',
        recordIds: group.map((r) => r.id),
        description: `地址"${group[0].address}"存在${group.length}条相同投诉"${group[0].complaint}"`,
        originalValues: Object.fromEntries(group.map((r) => [r.id, `投诉:${r.complaint} 导入时间:${r.imported_at}`]))
      })
    }
  }

  return warnings
}

function detect_coordinate_drift(records: ImportRecord[], projectId: string): Array<{ type: string; severity: string; recordIds: string[]; description: string; originalValues: Record<string, string> }> {
  const warnings: Array<{ type: string; severity: string; recordIds: string[]; description: string; originalValues: Record<string, string> }> = []
  const nameGroups = new Map<string, ImportRecord[]>()

  for (const r of records) {
    if (r.longitude != null && r.latitude != null) {
      const key = r.location_name
      if (!nameGroups.has(key)) nameGroups.set(key, [])
      nameGroups.get(key)!.push(r)
    }
  }

  for (const [name, group] of nameGroups) {
    if (group.length > 1) {
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          const dist = haversineDistance(group[i].latitude!, group[i].longitude!, group[j].latitude!, group[j].longitude!)
          if (dist > 50) {
            warnings.push({
              type: 'coordinate_drift',
              severity: 'error',
              recordIds: [group[i].id, group[j].id],
              description: `同名"${name}"坐标偏移${Math.round(dist)}米，超过50米阈值`,
              originalValues: {
                [group[i].id]: `坐标:${group[i].longitude},${group[i].latitude}`,
                [group[j].id]: `坐标:${group[j].longitude},${group[j].latitude}`
              }
            })
          }
        }
      }
    }
  }

  return warnings
}

function detect_cross_period(records: ImportRecord[], projectId: string): Array<{ type: string; severity: string; recordIds: string[]; description: string; originalValues: Record<string, string> }> {
  const warnings: Array<{ type: string; severity: string; recordIds: string[]; description: string; originalValues: Record<string, string> }> = []
  const nameGroups = new Map<string, ImportRecord[]>()

  for (const r of records) {
    const key = `${r.location_name}|||${r.address}`
    if (!nameGroups.has(key)) nameGroups.set(key, [])
    nameGroups.get(key)!.push(r)
  }

  for (const [key, group] of nameGroups) {
    const periods = new Set(group.map((r) => r.period))
    if (periods.size > 1) {
      warnings.push({
        type: 'cross_period',
        severity: 'warning',
        recordIds: group.map((r) => r.id),
        description: `"${key.split('|||')[0]}"跨时段数据：${[...periods].join('、')}，统计口径可能不同`,
        originalValues: Object.fromEntries(group.map((r) => [r.id, `时段:${r.period} 日照:${r.sunlight_hours}`]))
      })
    }
  }

  return warnings
}

function detect_field_missing(records: ImportRecord[], projectId: string): Array<{ type: string; severity: string; recordIds: string[]; description: string; originalValues: Record<string, string> }> {
  const warnings: Array<{ type: string; severity: string; recordIds: string[]; description: string; originalValues: Record<string, string> }> = []

  for (const r of records) {
    const missing: string[] = []
    if (r.sunlight_hours == null) missing.push('日照时长')
    if (r.longitude == null || r.latitude == null) missing.push('坐标')

    if (missing.length > 0) {
      warnings.push({
        type: 'field_missing',
        severity: 'warning',
        recordIds: [r.id],
        description: `"${r.location_name}"缺失字段：${missing.join('、')}`,
        originalValues: { [r.id]: `缺失:${missing.join(',')}` }
      })
    }
  }

  return warnings
}

export function runPrecheck(projectId: string): void {
  const deleteWarnings = db.prepare(`DELETE FROM precheck_warnings WHERE project_id = ?`)
  const insertWarning = db.prepare(`
    INSERT INTO precheck_warnings (id, project_id, type, severity, record_ids, description, original_values, resolved)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0)
  `)
  const insertReviewItem = db.prepare(`
    INSERT INTO review_items (id, project_id, record_id, status, verdict, conflict_ledger_evidence, conflict_import_evidence, conflict_suggestion)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const deleteMergeGroups = db.prepare(`DELETE FROM merge_groups WHERE project_id = ?`)
  const insertMergeGroup = db.prepare(`
    INSERT INTO merge_groups (id, project_id, type, record_ids, strategy, note)
    VALUES (?, ?, ?, ?, 'pending', NULL)
  `)

  const records = db.prepare(`SELECT * FROM import_records WHERE project_id = ?`).all(projectId) as ImportRecord[]

  const allWarnings = [
    ...detect_same_name(records, projectId),
    ...detect_duplicate_complaint(records, projectId),
    ...detect_coordinate_drift(records, projectId),
    ...detect_cross_period(records, projectId),
    ...detect_field_missing(records, projectId),
  ]

  const sunlightByLocation = new Map<string, ImportRecord>()
  const ledgerByLocation = new Map<string, ImportRecord>()
  for (const r of records) {
    const key = `${r.location_name}|||${r.address}`
    if (r.source === 'sunlight') {
      if (!sunlightByLocation.has(key)) sunlightByLocation.set(key, r)
    } else {
      if (!ledgerByLocation.has(key)) ledgerByLocation.set(key, r)
    }
  }

  const conflicts: Array<{ ledger: ImportRecord; sunlight: ImportRecord }> = []
  for (const [key, ledgerRecord] of ledgerByLocation) {
    const sunlightRecord = sunlightByLocation.get(key)
    if (sunlightRecord && ledgerRecord.sunlight_hours != null && sunlightRecord.sunlight_hours != null) {
      const diff = Math.abs(ledgerRecord.sunlight_hours - sunlightRecord.sunlight_hours)
      if (diff > 0.5) {
        conflicts.push({ ledger: ledgerRecord, sunlight: sunlightRecord })
      }
    }
  }

  const transaction = db.transaction(() => {
    deleteWarnings.run(projectId)
    deleteMergeGroups.run(projectId)

    for (const w of allWarnings) {
      insertWarning.run(
        uuidv4(),
        projectId,
        w.type,
        w.severity,
        JSON.stringify(w.recordIds),
        w.description,
        JSON.stringify(w.originalValues)
      )
    }

    const sameNameWarnings = allWarnings.filter((w) => w.type === 'same_name')
    for (const w of sameNameWarnings) {
      insertMergeGroup.run(uuidv4(), projectId, 'same_name', JSON.stringify(w.recordIds))
    }

    const dupComplaintWarnings = allWarnings.filter((w) => w.type === 'duplicate_complaint')
    for (const w of dupComplaintWarnings) {
      insertMergeGroup.run(uuidv4(), projectId, 'duplicate_complaint', JSON.stringify(w.recordIds))
    }

    const existingReviewRecords = new Set(
      (db.prepare(`SELECT record_id FROM review_items WHERE project_id = ?`).all(projectId) as any[]).map((r: any) => r.record_id)
    )

    for (const r of records) {
      if (existingReviewRecords.has(r.id)) continue
      const conflict = conflicts.find((c) => c.ledger.id === r.id || c.sunlight.id === r.id)
      if (conflict) {
        insertReviewItem.run(
          uuidv4(),
          projectId,
          r.id,
          'conflict',
          null,
          `审批台账日照${conflict.ledger.sunlight_hours}h`,
          `实测日照${conflict.sunlight.sunlight_hours}h`,
          '台账与实测差异超过0.5h，需裁决以哪方为准'
        )
      } else {
        insertReviewItem.run(
          uuidv4(),
          projectId,
          r.id,
          'pending',
          null,
          null,
          null,
          null
        )
      }
    }
  })

  transaction()

  const updateStatus = db.prepare(`UPDATE projects SET status = 'merging', updated_at = datetime('now') WHERE id = ?`)
  updateStatus.run(projectId)
}

export function getPrecheckWarnings(projectId: string) {
  return db.prepare(`SELECT * FROM precheck_warnings WHERE project_id = ? ORDER BY severity DESC, type`).all(projectId)
}
