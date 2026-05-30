import { v4 as uuidv4 } from 'uuid'
import { getDb } from '../db/database.js'
import type { Fixture, Assignment, CreateFixtureInput, UpdateFixtureInput, CreateAssignmentInput, UpdateAssignmentInput } from '../../shared/types.js'

function rowToFixture(row: Record<string, unknown>): Fixture {
  return {
    id: row.id as string,
    name: row.name as string,
    weight: row.weight as number,
    weightUnit: row.weight_unit as 'kg' | 'lb',
    quantity: row.quantity as number,
  }
}

function rowToAssignment(row: Record<string, unknown>): Assignment {
  return {
    id: row.id as string,
    schemeId: row.scheme_id as string,
    pointId: row.point_id as string,
    fixtureId: row.fixture_id as string,
    quantity: row.quantity as number,
    notes: row.notes as string,
  }
}

export function listFixtures(): Fixture[] {
  const db = getDb()
  const rows = db.prepare('SELECT * FROM fixture').all() as Record<string, unknown>[]
  return rows.map(rowToFixture)
}

export function getFixture(id: string): Fixture | null {
  const db = getDb()
  const row = db.prepare('SELECT * FROM fixture WHERE id = ?').get(id) as Record<string, unknown> | undefined
  return row ? rowToFixture(row) : null
}

export function createFixture(input: CreateFixtureInput): Fixture {
  const db = getDb()
  const id = uuidv4()
  db.prepare(
    'INSERT INTO fixture (id, name, weight, weight_unit, quantity) VALUES (?, ?, ?, ?, ?)'
  ).run(id, input.name, input.weight, input.weightUnit, input.quantity)
  return { id, ...input }
}

export function updateFixture(id: string, input: UpdateFixtureInput): Fixture {
  const db = getDb()
  const existing = getFixture(id)
  if (!existing) {
    throw new Error(`Fixture not found: ${id}`)
  }
  const name = input.name ?? existing.name
  const weight = input.weight ?? existing.weight
  const weightUnit = input.weightUnit ?? existing.weightUnit
  const quantity = input.quantity ?? existing.quantity
  db.prepare(
    'UPDATE fixture SET name = ?, weight = ?, weight_unit = ?, quantity = ? WHERE id = ?'
  ).run(name, weight, weightUnit, quantity, id)
  return { id, name, weight, weightUnit, quantity }
}

export function deleteFixture(id: string): boolean {
  const db = getDb()
  const result = db.prepare('DELETE FROM fixture WHERE id = ?').run(id)
  return result.changes > 0
}

export function getAssignments(schemeId: string): Assignment[] {
  const db = getDb()
  const rows = db.prepare('SELECT * FROM assignment WHERE scheme_id = ?').all(schemeId) as Record<string, unknown>[]
  return rows.map(rowToAssignment)
}

export function createAssignment(schemeId: string, input: CreateAssignmentInput): Assignment {
  const db = getDb()
  const point = db.prepare('SELECT id FROM rigging_point WHERE id = ? AND scheme_id = ?').get(input.pointId, schemeId) as Record<string, unknown> | undefined
  if (!point) {
    throw new Error(`Rigging point ${input.pointId} does not belong to scheme ${schemeId}`)
  }
  const fixture = db.prepare('SELECT id FROM fixture WHERE id = ?').get(input.fixtureId) as Record<string, unknown> | undefined
  if (!fixture) {
    throw new Error(`Fixture not found: ${input.fixtureId}`)
  }
  const id = uuidv4()
  db.prepare(
    'INSERT INTO assignment (id, scheme_id, point_id, fixture_id, quantity, notes) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, schemeId, input.pointId, input.fixtureId, input.quantity, input.notes ?? '')
  return {
    id,
    schemeId,
    pointId: input.pointId,
    fixtureId: input.fixtureId,
    quantity: input.quantity,
    notes: input.notes ?? '',
  }
}

export function updateAssignment(schemeId: string, assignmentId: string, input: UpdateAssignmentInput): Assignment {
  const db = getDb()
  const existing = db.prepare('SELECT * FROM assignment WHERE id = ? AND scheme_id = ?').get(assignmentId, schemeId) as Record<string, unknown> | undefined
  if (!existing) {
    throw new Error(`Assignment not found: ${assignmentId}`)
  }
  const pointId = input.pointId ?? (existing.point_id as string)
  const fixtureId = input.fixtureId ?? (existing.fixture_id as string)
  const quantity = input.quantity ?? (existing.quantity as number)
  const notes = input.notes ?? (existing.notes as string)
  if (input.pointId) {
    const point = db.prepare('SELECT id FROM rigging_point WHERE id = ? AND scheme_id = ?').get(input.pointId, schemeId) as Record<string, unknown> | undefined
    if (!point) {
      throw new Error(`Rigging point ${input.pointId} does not belong to scheme ${schemeId}`)
    }
  }
  if (input.fixtureId) {
    const fixture = db.prepare('SELECT id FROM fixture WHERE id = ?').get(input.fixtureId) as Record<string, unknown> | undefined
    if (!fixture) {
      throw new Error(`Fixture not found: ${input.fixtureId}`)
    }
  }
  db.prepare(
    'UPDATE assignment SET point_id = ?, fixture_id = ?, quantity = ?, notes = ? WHERE id = ?'
  ).run(pointId, fixtureId, quantity, notes, assignmentId)
  return {
    id: assignmentId,
    schemeId,
    pointId,
    fixtureId,
    quantity,
    notes,
  }
}

export function deleteAssignment(schemeId: string, assignmentId: string): boolean {
  const db = getDb()
  const result = db.prepare('DELETE FROM assignment WHERE id = ? AND scheme_id = ?').run(assignmentId, schemeId)
  return result.changes > 0
}
