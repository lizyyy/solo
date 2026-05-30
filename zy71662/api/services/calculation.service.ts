import { v4 as uuidv4 } from 'uuid'
import { getDb } from '../db/database.js'
import {
  type ForceDecomposition,
  type LoadVerification,
  type RiskItem,
  toKg,
  roundTo,
  G,
} from '../../shared/types.js'

export function decompose(schemeId: string): ForceDecomposition[] {
  const db = getDb()

  const points = db.prepare(
    'SELECT id, label, angle, angle_direction FROM rigging_point WHERE scheme_id = ?'
  ).all(schemeId) as Array<{ id: string; label: string; angle: number; angle_direction: 'left' | 'right' }>

  const result: ForceDecomposition[] = []

  for (const point of points) {
    const assignments = db.prepare(
      'SELECT a.quantity, f.weight, f.weight_unit FROM assignment a JOIN fixture f ON a.fixture_id = f.id WHERE a.point_id = ? AND a.scheme_id = ?'
    ).all(point.id, schemeId) as Array<{ quantity: number; weight: number; weight_unit: 'kg' | 'lb' }>

    let totalWeightKg = 0
    for (const a of assignments) {
      totalWeightKg += toKg(a.weight, a.weight_unit) * a.quantity
    }

    const angleRad = (point.angle * Math.PI) / 180
    const verticalForceN = totalWeightKg * G * Math.cos(angleRad)
    const horizontalForceN = totalWeightKg * G * Math.sin(angleRad)

    result.push({
      pointId: point.id,
      pointLabel: point.label,
      totalWeightKg: roundTo(totalWeightKg),
      verticalForceN: roundTo(verticalForceN),
      horizontalForceN: roundTo(horizontalForceN),
      angleDeg: roundTo(point.angle),
      angleDirection: point.angle_direction,
    })
  }

  return result
}

export function verify(schemeId: string): LoadVerification[] {
  const db = getDb()

  const scheme = db.prepare(
    'SELECT safety_factor FROM scheme WHERE id = ?'
  ).get(schemeId) as { safety_factor: number }

  const points = db.prepare(
    'SELECT id, label, rated_load, rated_load_unit FROM rigging_point WHERE scheme_id = ?'
  ).all(schemeId) as Array<{ id: string; label: string; rated_load: number; rated_load_unit: 'kg' | 'lb' }>

  const result: LoadVerification[] = []

  for (const point of points) {
    const assignments = db.prepare(
      'SELECT a.quantity, f.weight, f.weight_unit FROM assignment a JOIN fixture f ON a.fixture_id = f.id WHERE a.point_id = ? AND a.scheme_id = ?'
    ).all(point.id, schemeId) as Array<{ quantity: number; weight: number; weight_unit: 'kg' | 'lb' }>

    let actualLoadKg = 0
    for (const a of assignments) {
      actualLoadKg += toKg(a.weight, a.weight_unit) * a.quantity
    }

    const ratedLoadKg = toKg(point.rated_load, point.rated_load_unit)
    const loadRatio = roundTo(actualLoadKg / ratedLoadKg, 3)
    const safetyFactor = scheme.safety_factor

    let status: 'safe' | 'warning' | 'overload'
    if (loadRatio > 1.0) {
      status = 'overload'
    } else if (loadRatio > 1 / safetyFactor) {
      status = 'warning'
    } else {
      status = 'safe'
    }

    result.push({
      pointId: point.id,
      pointLabel: point.label,
      actualLoadKg: roundTo(actualLoadKg),
      ratedLoadKg: roundTo(ratedLoadKg),
      loadRatio,
      safetyFactor,
      status,
    })
  }

  return result
}

export function detectRisks(schemeId: string): RiskItem[] {
  const db = getDb()

  const deleteStmt = db.prepare(
    "DELETE FROM risk_item WHERE scheme_id = ? AND status = 'pending'"
  )
  const insertStmt = db.prepare(
    "INSERT INTO risk_item (id, scheme_id, point_id, category, severity, message, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))"
  )
  const updateSchemeStmt = db.prepare(
    "UPDATE scheme SET status = 'flagged', updated_at = datetime('now') WHERE id = ?"
  )

  const points = db.prepare(
    'SELECT id, label, rated_load_unit, x, angle_direction FROM rigging_point WHERE scheme_id = ? ORDER BY x ASC'
  ).all(schemeId) as Array<{ id: string; label: string; rated_load_unit: 'kg' | 'lb'; x: number; angle_direction: 'left' | 'right' }>

  const verifications = verify(schemeId)

  let hasCritical = false

  const transaction = db.transaction(() => {
    deleteStmt.run(schemeId)

    for (const point of points) {
      const fixtures = db.prepare(
        'SELECT f.weight_unit FROM assignment a JOIN fixture f ON a.fixture_id = f.id WHERE a.point_id = ? AND a.scheme_id = ?'
      ).all(point.id, schemeId) as Array<{ weight_unit: 'kg' | 'lb' }>

      const hasMismatch = fixtures.some(f => f.weight_unit !== point.rated_load_unit)
      if (hasMismatch) {
        insertStmt.run(
          uuidv4(),
          schemeId,
          point.id,
          'unit_error',
          'critical',
          `Point ${point.label} has fixtures with units differing from rated load unit`,
          'pending'
        )
        hasCritical = true
      }
    }

    for (const v of verifications) {
      if (v.loadRatio > 1.0) {
        insertStmt.run(
          uuidv4(),
          schemeId,
          v.pointId,
          'overload',
          'critical',
          `Point ${v.pointLabel} is overloaded (ratio: ${v.loadRatio})`,
          'pending'
        )
        hasCritical = true
      } else if (v.loadRatio > 1 / v.safetyFactor) {
        insertStmt.run(
          uuidv4(),
          schemeId,
          v.pointId,
          'safety_insufficient',
          'warning',
          `Point ${v.pointLabel} exceeds safety factor (ratio: ${v.loadRatio})`,
          'pending'
        )
      }
    }

    for (let i = 0; i < points.length - 1; i++) {
      const left = points[i]
      const right = points[i + 1]
      if (left.angle_direction === right.angle_direction) {
        insertStmt.run(
          uuidv4(),
          schemeId,
          null,
          'angle_reversed',
          'warning',
          `Adjacent points ${left.label} and ${right.label} have reversed angle directions`,
          'pending'
        )
      }
    }

    if (hasCritical) {
      updateSchemeStmt.run(schemeId)
    }
  })

  transaction()

  return getRisks(schemeId)
}

export function getRisks(schemeId: string): RiskItem[] {
  const db = getDb()

  const rows = db.prepare(
    'SELECT id, scheme_id, point_id, category, severity, message, status, created_at FROM risk_item WHERE scheme_id = ?'
  ).all(schemeId) as Array<{
    id: string
    scheme_id: string
    point_id: string | null
    category: RiskItem['category']
    severity: RiskItem['severity']
    message: string
    status: RiskItem['status']
    created_at: string
  }>

  return rows.map(row => ({
    id: row.id,
    schemeId: row.scheme_id,
    pointId: row.point_id,
    category: row.category,
    severity: row.severity,
    message: row.message,
    status: row.status,
    createdAt: row.created_at,
  }))
}

export function updateRiskStatus(
  schemeId: string,
  riskId: string,
  status: 'pending' | 'resolved' | 'dismissed'
): RiskItem | null {
  const db = getDb()

  const result = db.prepare(
    'UPDATE risk_item SET status = ? WHERE id = ? AND scheme_id = ?'
  ).run(status, riskId, schemeId)

  if (result.changes === 0) return null

  const row = db.prepare(
    'SELECT id, scheme_id, point_id, category, severity, message, status, created_at FROM risk_item WHERE id = ?'
  ).get(riskId) as {
    id: string
    scheme_id: string
    point_id: string | null
    category: RiskItem['category']
    severity: RiskItem['severity']
    message: string
    status: RiskItem['status']
    created_at: string
  } | undefined

  if (!row) return null

  return {
    id: row.id,
    schemeId: row.scheme_id,
    pointId: row.point_id,
    category: row.category,
    severity: row.severity,
    message: row.message,
    status: row.status,
    createdAt: row.created_at,
  }
}
