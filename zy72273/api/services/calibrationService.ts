import { v4 as uuidv4 } from 'uuid'
import { getDb } from '../db/database.js'

interface CoordinateInput {
  pointName: string
  type: string
  lat?: number | null
  lng?: number | null
  x?: number | null
  y?: number | null
  z?: number | null
}

interface ImportData {
  beaconId: string
  originDescription?: string
  coordinates: CoordinateInput[]
  photoIds?: string[]
}

function detectCoordinateType(entry: CoordinateInput): string {
  const hasLatLng = entry.lat != null && entry.lng != null
  const hasMetric = entry.x != null && entry.y != null
  if (hasLatLng && hasMetric) return 'mixed'
  if (hasLatLng) return 'latlng'
  if (hasMetric) return 'metric'
  return entry.type || 'latlng'
}

function isMixed(entry: CoordinateInput): boolean {
  return entry.lat != null && entry.lng != null && entry.x != null && entry.y != null
}

function generateFieldTeamNote(
  db: ReturnType<typeof getDb>,
  recordId: string,
  coordinateMixDetected: boolean,
  hasPhotos: boolean,
) {
  const whyLeftBehind = coordinateMixDetected
    ? '经纬度与米制坐标混用，未自动归正，待巡检组复核'
    : ''

  const missingMaterials: string[] = []
  const nextStep: Record<string, string> = {}

  if (coordinateMixDetected) {
    missingMaterials.push('巡检组复核确认')
    nextStep.contactTeam = 'inspection'
    nextStep.contactPerson = '巡检组'
    nextStep.action = '复核混用坐标'
  }

  if (!hasPhotos) {
    missingMaterials.push('巡检照片编号')
    if (!nextStep.contactTeam) {
      nextStep.contactTeam = 'inspection'
      nextStep.contactPerson = '巡检组'
      nextStep.action = '补录巡检照片编号'
    }
  }

  if (!coordinateMixDetected && hasPhotos) {
    nextStep.contactTeam = 'operations'
    nextStep.contactPerson = '园区运维'
    nextStep.action = '日常维护'
  }

  const existing = db
    .prepare('SELECT version FROM field_team_notes WHERE record_id = ?')
    .get(recordId) as { version: number } | undefined

  const version = existing ? existing.version + 1 : 1

  if (existing) {
    db.prepare(
      `UPDATE field_team_notes SET why_left_behind = ?, missing_materials = ?, next_step = ?, generated_at = datetime('now'), version = ? WHERE record_id = ?`,
    ).run(whyLeftBehind, JSON.stringify(missingMaterials), JSON.stringify(nextStep), version, recordId)
  } else {
    db.prepare(
      `INSERT INTO field_team_notes (id, record_id, why_left_behind, missing_materials, next_step, version) VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(uuidv4(), recordId, whyLeftBehind, JSON.stringify(missingMaterials), JSON.stringify(nextStep), version)
  }
}

export function importCalibrationData(data: ImportData) {
  const db = getDb()
  const recordId = uuidv4()

  const coordinateMixDetected = data.coordinates.some(isMixed)
  const hasPhotos = data.photoIds && data.photoIds.length > 0

  let status: string
  if (coordinateMixDetected) {
    status = 'pending_review'
  } else if (!hasPhotos) {
    status = 'pending_photo'
  } else {
    status = 'calibrated'
  }

  const insertRecord = db.prepare(`
    INSERT INTO calibration_records (id, beacon_id, origin_description, status, coordinate_mix_detected)
    VALUES (?, ?, ?, ?, ?)
  `)

  const insertEntry = db.prepare(`
    INSERT INTO coordinate_entries (id, record_id, point_name, coordinate_type, lat, lng, x, y, z)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const insertPhoto = db.prepare(`
    INSERT INTO inspection_photos (id, record_id, photo_id, supplemented_by, supplemented_at)
    VALUES (?, ?, ?, ?, datetime('now'))
  `)

  const insertLog = db.prepare(`
    INSERT INTO operation_logs (id, record_id, action, operator, operator_role, description)
    VALUES (?, ?, 'import', 'system', 'system', ?)
  `)

  const transaction = db.transaction(() => {
    insertRecord.run(recordId, data.beaconId, data.originDescription || '', status, coordinateMixDetected ? 1 : 0)

    for (const coord of data.coordinates) {
      const coordType = detectCoordinateType(coord)
      insertEntry.run(
        uuidv4(),
        recordId,
        coord.pointName,
        coordType,
        coord.lat ?? null,
        coord.lng ?? null,
        coord.x ?? null,
        coord.y ?? null,
        coord.z ?? null,
      )
    }

    if (data.photoIds && data.photoIds.length > 0) {
      for (const photoId of data.photoIds) {
        insertPhoto.run(uuidv4(), recordId, photoId, 'system')
      }
    }

    generateFieldTeamNote(db, recordId, coordinateMixDetected, hasPhotos)

    insertLog.run(uuidv4(), recordId, `导入信标 ${data.beaconId} 校准数据`)
  })

  transaction()

  return { recordId, status, coordinateMixDetected }
}

export function supplementPhoto(recordId: string, photoIds: string[], operator: string) {
  const db = getDb()

  const record = db
    .prepare('SELECT * FROM calibration_records WHERE id = ?')
    .get(recordId) as Record<string, any> | undefined

  if (!record) throw new Error('记录不存在')

  const insertPhoto = db.prepare(`
    INSERT INTO inspection_photos (id, record_id, photo_id, supplemented_by, supplemented_at)
    VALUES (?, ?, ?, ?, datetime('now'))
  `)

  const insertLog = db.prepare(`
    INSERT INTO operation_logs (id, record_id, action, operator, operator_role, description)
    VALUES (?, ?, 'supplement_photo', ?, ?, ?)
  `)

  const transaction = db.transaction(() => {
    for (const photoId of photoIds) {
      insertPhoto.run(uuidv4(), recordId, photoId, operator)
    }

    const photos = db.prepare('SELECT COUNT(*) as cnt FROM inspection_photos WHERE record_id = ?').get(recordId) as { cnt: number }

    if (record.status === 'pending_photo' && photos.cnt > 0) {
      if (record.coordinate_mix_detected) {
        db.prepare("UPDATE calibration_records SET status = 'pending_review', updated_at = datetime('now') WHERE id = ?").run(recordId)
      } else {
        db.prepare("UPDATE calibration_records SET status = 'calibrated', updated_at = datetime('now') WHERE id = ?").run(recordId)
      }
    }

    const hasPhotos = photos.cnt > 0
    generateFieldTeamNote(db, recordId, !!record.coordinate_mix_detected, hasPhotos)

    insertLog.run(
      uuidv4(),
      recordId,
      operator,
      'inspection',
      `补录巡检照片: ${photoIds.join(', ')}`,
    )
  })

  transaction()

  return { recordId, supplementedPhotos: photoIds }
}

export function manualCorrect(
  recordId: string,
  entryId: string,
  correction: Record<string, any>,
  operator: string,
  reason: string,
) {
  const db = getDb()

  const record = db
    .prepare('SELECT * FROM calibration_records WHERE id = ?')
    .get(recordId) as Record<string, any> | undefined
  if (!record) throw new Error('记录不存在')

  const entry = db
    .prepare('SELECT * FROM coordinate_entries WHERE id = ? AND record_id = ?')
    .get(entryId, recordId) as Record<string, any> | undefined
  if (!entry) throw new Error('坐标条目不存在')

  const beforeSnapshot = JSON.stringify({
    lat: entry.lat,
    lng: entry.lng,
    x: entry.x,
    y: entry.y,
    z: entry.z,
    coordinate_type: entry.coordinate_type,
  })

  const sets: string[] = []
  const values: any[] = []

  if (correction.lat !== undefined) { sets.push('lat = ?'); values.push(correction.lat) }
  if (correction.lng !== undefined) { sets.push('lng = ?'); values.push(correction.lng) }
  if (correction.x !== undefined) { sets.push('x = ?'); values.push(correction.x) }
  if (correction.y !== undefined) { sets.push('y = ?'); values.push(correction.y) }
  if (correction.z !== undefined) { sets.push('z = ?'); values.push(correction.z) }

  if (sets.length > 0) {
    sets.push('manual_correction = ?')
    values.push(JSON.stringify(correction))
    values.push(entryId)

    db.prepare(`UPDATE coordinate_entries SET ${sets.join(', ')} WHERE id = ?`).run(...values)
  }

  const updatedEntry = db
    .prepare('SELECT * FROM coordinate_entries WHERE id = ?')
    .get(entryId) as Record<string, any>

  const afterSnapshot = JSON.stringify({
    lat: updatedEntry.lat,
    lng: updatedEntry.lng,
    x: updatedEntry.x,
    y: updatedEntry.y,
    z: updatedEntry.z,
    coordinate_type: updatedEntry.coordinate_type,
  })

  db.prepare(`
    INSERT INTO operation_logs (id, record_id, action, operator, operator_role, description, reason, before_snapshot, after_snapshot)
    VALUES (?, ?, 'manual_correct', ?, 'operations', ?, ?, ?, ?)
  `).run(
    uuidv4(),
    recordId,
    operator,
    `人工修正坐标条目 ${entry.point_name}`,
    reason,
    beforeSnapshot,
    afterSnapshot,
  )

  db.prepare("UPDATE calibration_records SET updated_at = datetime('now') WHERE id = ?").run(recordId)

  return { recordId, entryId }
}

export function rerunCalibration(recordId: string, operator: string) {
  const db = getDb()

  const record = db
    .prepare('SELECT * FROM calibration_records WHERE id = ?')
    .get(recordId) as Record<string, any> | undefined
  if (!record) throw new Error('记录不存在')

  const beforeSnapshot = JSON.stringify({ status: record.status })

  db.prepare("UPDATE calibration_records SET status = 'calibrated', updated_at = datetime('now') WHERE id = ?").run(recordId)

  const afterSnapshot = JSON.stringify({ status: 'calibrated' })

  db.prepare(`
    INSERT INTO operation_logs (id, record_id, action, operator, operator_role, description, reason, before_snapshot, after_snapshot)
    VALUES (?, ?, 'rerun', ?, 'operations', ?, ?, ?, ?)
  `).run(
    uuidv4(),
    recordId,
    operator,
    `重跑校准: 信标 ${record.beacon_id}`,
    '重跑校准',
    beforeSnapshot,
    afterSnapshot,
  )

  return { recordId }
}

export function getRecords(status?: string) {
  const db = getDb()

  let rows: any[]
  if (status) {
    rows = db.prepare('SELECT * FROM calibration_records WHERE status = ? ORDER BY created_at DESC').all(status)
  } else {
    rows = db.prepare('SELECT * FROM calibration_records ORDER BY created_at DESC').all()
  }

  return rows.map((row: Record<string, any>) => {
    const photoCount = db
      .prepare('SELECT COUNT(*) as cnt FROM inspection_photos WHERE record_id = ?')
      .get(row.id) as { cnt: number }
    return {
      ...row,
      coordinate_mix_detected: !!row.coordinate_mix_detected,
      photo_count: photoCount.cnt,
    }
  })
}

export function getRecordDetail(recordId: string) {
  const db = getDb()

  const record = db
    .prepare('SELECT * FROM calibration_records WHERE id = ?')
    .get(recordId) as Record<string, any> | undefined
  if (!record) throw new Error('记录不存在')

  const coordinates = db
    .prepare('SELECT * FROM coordinate_entries WHERE record_id = ?')
    .all(recordId) as Record<string, any>[]

  const photos = db
    .prepare('SELECT * FROM inspection_photos WHERE record_id = ?')
    .all(recordId) as Record<string, any>[]

  const note = db
    .prepare('SELECT * FROM field_team_notes WHERE record_id = ?')
    .get(recordId) as Record<string, any> | undefined

  const logs = db
    .prepare('SELECT * FROM operation_logs WHERE record_id = ? ORDER BY timestamp DESC')
    .all(recordId) as Record<string, any>[]

  return {
    ...record,
    coordinate_mix_detected: !!record.coordinate_mix_detected,
    coordinates: coordinates.map((c) => ({
      ...c,
      manual_correction: c.manual_correction ? JSON.parse(c.manual_correction) : null,
    })),
    photos,
    note: note
      ? {
          ...note,
          missing_materials: JSON.parse(note.missing_materials),
          next_step: JSON.parse(note.next_step),
        }
      : null,
    logs: logs.map((l) => ({
      ...l,
      before_snapshot: l.before_snapshot ? JSON.parse(l.before_snapshot) : null,
      after_snapshot: l.after_snapshot ? JSON.parse(l.after_snapshot) : null,
    })),
  }
}

export function getOperationLogs(recordId: string) {
  const db = getDb()

  const record = db
    .prepare('SELECT id FROM calibration_records WHERE id = ?')
    .get(recordId) as Record<string, any> | undefined
  if (!record) throw new Error('记录不存在')

  const logs = db
    .prepare('SELECT * FROM operation_logs WHERE record_id = ? ORDER BY timestamp DESC')
    .all(recordId) as Record<string, any>[]

  return logs.map((l) => ({
    ...l,
    before_snapshot: l.before_snapshot ? JSON.parse(l.before_snapshot) : null,
    after_snapshot: l.after_snapshot ? JSON.parse(l.after_snapshot) : null,
  }))
}

export function getFieldTeamNote(recordId: string) {
  const db = getDb()

  const record = db
    .prepare('SELECT id FROM calibration_records WHERE id = ?')
    .get(recordId) as Record<string, any> | undefined
  if (!record) throw new Error('记录不存在')

  const note = db
    .prepare('SELECT * FROM field_team_notes WHERE record_id = ?')
    .get(recordId) as Record<string, any> | undefined

  if (!note) return null

  return {
    ...note,
    missing_materials: JSON.parse(note.missing_materials),
    next_step: JSON.parse(note.next_step),
  }
}

export function getRerunCommand(recordId: string) {
  const db = getDb()

  const record = db
    .prepare('SELECT beacon_id FROM calibration_records WHERE id = ?')
    .get(recordId) as Record<string, any> | undefined
  if (!record) throw new Error('记录不存在')

  return `curl -X POST http://localhost:3001/api/records/${recordId}/rerun -H "Content-Type: application/json" -d '{"operator":"system"}'`
}

export function resetDatabase() {
  const db = getDb()

  db.exec(`
    DELETE FROM inspection_photos;
    DELETE FROM operation_logs;
    DELETE FROM field_team_notes;
    DELETE FROM coordinate_entries;
    DELETE FROM calibration_records;
  `)
}
