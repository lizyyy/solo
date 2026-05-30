import { v4 as uuidv4 } from 'uuid'
import { getDb } from '../db/database.js'
import {
  type Scheme,
  type RiggingPoint,
  type Assignment,
  type RiskItem,
  type ForceDecomposition,
  type LoadVerification,
  type SchemeVersion,
  type ChangelogEntry,
  type SchemeDetail,
  type SchemeSummary,
  type CreateSchemeInput,
  type UpdateSchemeInput,
  type CreatePointInput,
  type UpdatePointInput,
  toKg,
  roundTo,
  G,
} from '../../shared/types.js'

function mapSchemeRow(row: Record<string, unknown>): Scheme {
  return {
    id: row.id as string,
    name: row.name as string,
    description: row.description as string,
    safetyFactor: row.safety_factor as number,
    status: row.status as Scheme['status'],
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

function mapPointRow(row: Record<string, unknown>): RiggingPoint {
  return {
    id: row.id as string,
    schemeId: row.scheme_id as string,
    label: row.label as string,
    x: row.x as number,
    y: row.y as number,
    ratedLoad: row.rated_load as number,
    ratedLoadUnit: row.rated_load_unit as RiggingPoint['ratedLoadUnit'],
    angle: row.angle as number,
    angleDirection: row.angle_direction as RiggingPoint['angleDirection'],
    notes: row.notes as string,
    createdAt: row.created_at as string,
  }
}

function mapAssignmentRow(row: Record<string, unknown>): Assignment {
  return {
    id: row.id as string,
    schemeId: row.scheme_id as string,
    pointId: row.point_id as string,
    fixtureId: row.fixture_id as string,
    quantity: row.quantity as number,
    notes: row.notes as string,
  }
}

function mapRiskRow(row: Record<string, unknown>): RiskItem {
  return {
    id: row.id as string,
    schemeId: row.scheme_id as string,
    pointId: row.point_id as string | null,
    category: row.category as RiskItem['category'],
    severity: row.severity as RiskItem['severity'],
    message: row.message as string,
    status: row.status as RiskItem['status'],
    createdAt: row.created_at as string,
  }
}

function mapVersionRow(row: Record<string, unknown>): SchemeVersion {
  return {
    id: row.id as string,
    schemeId: row.scheme_id as string,
    versionNumber: row.version_number as number,
    snapshot: row.snapshot as string,
    createdAt: row.created_at as string,
  }
}

function mapChangelogRow(row: Record<string, unknown>): ChangelogEntry {
  return {
    id: row.id as string,
    versionId: row.version_id as string,
    field: row.field as string,
    oldValue: row.old_value as string,
    newValue: row.new_value as string,
    changedAt: row.changed_at as string,
  }
}

export function listSchemes(): SchemeSummary[] {
  const db = getDb()
  const schemes = db.prepare('SELECT * FROM scheme ORDER BY created_at DESC').all() as Record<string, unknown>[]

  const stmtPointCount = db.prepare('SELECT COUNT(*) AS count FROM rigging_point WHERE scheme_id = ?')
  const stmtPoints = db.prepare('SELECT rated_load, rated_load_unit FROM rigging_point WHERE scheme_id = ?')
  const stmtRiskCount = db.prepare('SELECT COUNT(*) AS count FROM risk_item WHERE scheme_id = ?')
  const stmtVersionCount = db.prepare('SELECT COUNT(*) AS count FROM scheme_version WHERE scheme_id = ?')

  return schemes.map((row) => {
    const scheme = mapSchemeRow(row)
    const pointCount = (stmtPointCount.get(scheme.id) as Record<string, number>).count
    const points = stmtPoints.all(scheme.id) as Record<string, unknown>[]
    const totalLoadKg = roundTo(
      points.reduce((sum, p) => sum + toKg(p.rated_load as number, p.rated_load_unit as 'kg' | 'lb'), 0),
      1,
    )
    const riskCount = (stmtRiskCount.get(scheme.id) as Record<string, number>).count
    const versionCount = (stmtVersionCount.get(scheme.id) as Record<string, number>).count

    return {
      id: scheme.id,
      name: scheme.name,
      status: scheme.status,
      safetyFactor: scheme.safetyFactor,
      pointCount,
      totalLoadKg,
      riskCount,
      versionCount,
      createdAt: scheme.createdAt,
      updatedAt: scheme.updatedAt,
    }
  })
}

export function getSchemeById(id: string): SchemeDetail | null {
  const db = getDb()
  const row = db.prepare('SELECT * FROM scheme WHERE id = ?').get(id) as Record<string, unknown> | undefined
  if (!row) return null

  const scheme = mapSchemeRow(row)
  const pointRows = db.prepare('SELECT * FROM rigging_point WHERE scheme_id = ?').all(id) as Record<string, unknown>[]
  const points = pointRows.map(mapPointRow)

  const assignmentRows = db.prepare('SELECT * FROM assignment WHERE scheme_id = ?').all(id) as Record<string, unknown>[]
  const assignments = assignmentRows.map(mapAssignmentRow)

  const riskRows = db.prepare('SELECT * FROM risk_item WHERE scheme_id = ?').all(id) as Record<string, unknown>[]
  const risks = riskRows.map(mapRiskRow)

  const fixtureRows = db.prepare('SELECT * FROM fixture').all() as Record<string, unknown>[]
  const fixtureMap = new Map<string, Record<string, unknown>>()
  for (const f of fixtureRows) {
    fixtureMap.set(f.id as string, f)
  }

  const decompositions: ForceDecomposition[] = []
  const verifications: LoadVerification[] = []

  for (const point of points) {
    const pointAssignments = assignments.filter((a) => a.pointId === point.id)
    let totalWeightKg = 0
    for (const assignment of pointAssignments) {
      const fixture = fixtureMap.get(assignment.fixtureId)
      if (fixture) {
        totalWeightKg += toKg(fixture.weight as number, fixture.weight_unit as 'kg' | 'lb') * assignment.quantity
      }
    }
    totalWeightKg = roundTo(totalWeightKg, 1)

    const angleRad = (point.angle * Math.PI) / 180
    const verticalForceN = roundTo(totalWeightKg * G * Math.cos(angleRad), 1)
    const horizontalForceN = roundTo(totalWeightKg * G * Math.sin(angleRad), 1)

    decompositions.push({
      pointId: point.id,
      pointLabel: point.label,
      totalWeightKg,
      verticalForceN,
      horizontalForceN,
      angleDeg: point.angle,
      angleDirection: point.angleDirection,
    })

    const ratedLoadKg = roundTo(toKg(point.ratedLoad, point.ratedLoadUnit), 1)
    const loadRatio = ratedLoadKg > 0 ? roundTo(totalWeightKg / ratedLoadKg, 3) : 0
    let status: LoadVerification['status'] = 'safe'
    if (loadRatio > 1) {
      status = 'overload'
    } else if (loadRatio > 1 / scheme.safetyFactor) {
      status = 'warning'
    }

    verifications.push({
      pointId: point.id,
      pointLabel: point.label,
      actualLoadKg: totalWeightKg,
      ratedLoadKg,
      loadRatio,
      safetyFactor: scheme.safetyFactor,
      status,
    })
  }

  return {
    scheme,
    points,
    assignments,
    risks,
    decompositions,
    verifications,
  }
}

export const getSchemeDetail = getSchemeById

export function createScheme(input: CreateSchemeInput): Scheme {
  const db = getDb()
  const id = uuidv4()
  const now = new Date().toISOString()

  db.prepare(
    `INSERT INTO scheme (id, name, description, safety_factor, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'draft', ?, ?)`,
  ).run(id, input.name, input.description, input.safetyFactor, now, now)

  return {
    id,
    name: input.name,
    description: input.description,
    safetyFactor: input.safetyFactor,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  }
}

export function updateScheme(id: string, input: UpdateSchemeInput): Scheme {
  const db = getDb()
  const existing = db.prepare('SELECT * FROM scheme WHERE id = ?').get(id) as Record<string, unknown> | undefined
  if (!existing) throw new Error(`Scheme not found: ${id}`)

  const scheme = mapSchemeRow(existing)
  const now = new Date().toISOString()

  const name = input.name ?? scheme.name
  const description = input.description ?? scheme.description
  const safetyFactor = input.safetyFactor ?? scheme.safetyFactor
  const status = input.status ?? scheme.status

  db.prepare(
    `UPDATE scheme SET name = ?, description = ?, safety_factor = ?, status = ?, updated_at = ?
     WHERE id = ?`,
  ).run(name, description, safetyFactor, status, now, id)

  return {
    id,
    name,
    description,
    safetyFactor,
    status,
    createdAt: scheme.createdAt,
    updatedAt: now,
  }
}

export function deleteScheme(id: string): boolean {
  const db = getDb()
  const result = db.prepare('DELETE FROM scheme WHERE id = ?').run(id)
  return result.changes > 0
}

export function getPoints(schemeId: string): RiggingPoint[] {
  const db = getDb()
  const rows = db.prepare('SELECT * FROM rigging_point WHERE scheme_id = ? ORDER BY created_at').all(schemeId) as Record<string, unknown>[]
  return rows.map(mapPointRow)
}

export function createPoint(schemeId: string, input: CreatePointInput): RiggingPoint {
  const db = getDb()
  const id = uuidv4()
  const now = new Date().toISOString()

  db.prepare(
    `INSERT INTO rigging_point (id, scheme_id, label, x, y, rated_load, rated_load_unit, angle, angle_direction, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, schemeId, input.label, input.x, input.y, input.ratedLoad, input.ratedLoadUnit, input.angle, input.angleDirection, input.notes, now)

  db.prepare('UPDATE scheme SET updated_at = ? WHERE id = ?').run(now, schemeId)

  return {
    id,
    schemeId,
    label: input.label,
    x: input.x,
    y: input.y,
    ratedLoad: input.ratedLoad,
    ratedLoadUnit: input.ratedLoadUnit,
    angle: input.angle,
    angleDirection: input.angleDirection,
    notes: input.notes,
    createdAt: now,
  }
}

export function updatePoint(schemeId: string, pointId: string, input: UpdatePointInput): RiggingPoint {
  const db = getDb()
  const existing = db.prepare('SELECT * FROM rigging_point WHERE id = ? AND scheme_id = ?').get(pointId, schemeId) as Record<string, unknown> | undefined
  if (!existing) throw new Error(`Point not found: ${pointId}`)

  const point = mapPointRow(existing)
  const now = new Date().toISOString()

  const label = input.label ?? point.label
  const x = input.x ?? point.x
  const y = input.y ?? point.y
  const ratedLoad = input.ratedLoad ?? point.ratedLoad
  const ratedLoadUnit = input.ratedLoadUnit ?? point.ratedLoadUnit
  const angle = input.angle ?? point.angle
  const angleDirection = input.angleDirection ?? point.angleDirection
  const notes = input.notes ?? point.notes

  db.prepare(
    `UPDATE rigging_point SET label = ?, x = ?, y = ?, rated_load = ?, rated_load_unit = ?, angle = ?, angle_direction = ?, notes = ?
     WHERE id = ?`,
  ).run(label, x, y, ratedLoad, ratedLoadUnit, angle, angleDirection, notes, pointId)

  db.prepare('UPDATE scheme SET updated_at = ? WHERE id = ?').run(now, schemeId)

  return {
    id: pointId,
    schemeId,
    label,
    x,
    y,
    ratedLoad,
    ratedLoadUnit,
    angle,
    angleDirection,
    notes,
    createdAt: point.createdAt,
  }
}

export function deletePoint(schemeId: string, pointId: string): boolean {
  const db = getDb()
  const now = new Date().toISOString()
  const result = db.prepare('DELETE FROM rigging_point WHERE id = ? AND scheme_id = ?').run(pointId, schemeId)

  if (result.changes > 0) {
    db.prepare('UPDATE scheme SET updated_at = ? WHERE id = ?').run(now, schemeId)
  }

  return result.changes > 0
}

export function createSnapshot(schemeId: string): SchemeVersion {
  const db = getDb()
  const detail = getSchemeById(schemeId)
  if (!detail) throw new Error(`Scheme not found: ${schemeId}`)

  const maxRow = db.prepare('SELECT MAX(version_number) AS max FROM scheme_version WHERE scheme_id = ?').get(schemeId) as Record<string, number | null>
  const versionNumber = (maxRow.max ?? 0) + 1

  const id = uuidv4()
  const now = new Date().toISOString()
  const snapshot = JSON.stringify(detail)

  db.prepare(
    `INSERT INTO scheme_version (id, scheme_id, version_number, snapshot, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(id, schemeId, versionNumber, snapshot, now)

  return {
    id,
    schemeId,
    versionNumber,
    snapshot,
    createdAt: now,
  }
}

export function getVersions(schemeId: string): SchemeVersion[] {
  const db = getDb()
  const rows = db.prepare('SELECT * FROM scheme_version WHERE scheme_id = ? ORDER BY version_number DESC').all(schemeId) as Record<string, unknown>[]
  return rows.map(mapVersionRow)
}

export function getVersion(schemeId: string, versionId: string): { version: SchemeVersion; changelog: ChangelogEntry[]; data: SchemeDetail } | null {
  const db = getDb()
  const row = db.prepare('SELECT * FROM scheme_version WHERE id = ? AND scheme_id = ?').get(versionId, schemeId) as Record<string, unknown> | undefined
  if (!row) return null

  const version = mapVersionRow(row)
  const changelogRows = db.prepare('SELECT * FROM changelog WHERE version_id = ?').all(versionId) as Record<string, unknown>[]
  const changelog = changelogRows.map(mapChangelogRow)
  const data = JSON.parse(version.snapshot) as SchemeDetail

  return { version, changelog, data }
}
