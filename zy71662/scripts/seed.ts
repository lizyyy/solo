import { getDb } from '../api/db/database.js'
import { v4 as uuidv4 } from 'uuid'

const db = getDb()

const schemeId = uuidv4()
const now = new Date().toISOString()

db.prepare(
  `INSERT INTO scheme (id, name, description, safety_factor, status, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, ?)`
).run(schemeId, '示例话剧演出', '2025年春季话剧主舞台吊点方案', 2.0, 'draft', now, now)

const fixtures = [
  { id: uuidv4(), name: '聚光灯 1kW', weight: 12.5, weight_unit: 'kg', quantity: 8 },
  { id: uuidv4(), name: '追光灯 2kW', weight: 18.0, weight_unit: 'kg', quantity: 4 },
  { id: uuidv4(), name: 'LED面光灯', weight: 8.5, weight_unit: 'kg', quantity: 12 },
  { id: uuidv4(), name: '柔光灯', weight: 15.0, weight_unit: 'lb', quantity: 6 },
  { id: uuidv4(), name: '电脑灯 1200W', weight: 22.0, weight_unit: 'kg', quantity: 6 },
]

const insertFixture = db.prepare(
  'INSERT INTO fixture (id, name, weight, weight_unit, quantity) VALUES (?, ?, ?, ?, ?)'
)
for (const f of fixtures) {
  insertFixture.run(f.id, f.name, f.weight, f.weight_unit, f.quantity)
}

const points = [
  { id: uuidv4(), label: 'A1', x: 2, y: 8, rated_load: 200, rated_load_unit: 'kg', angle: 0, angle_direction: 'left', notes: '舞台左前区主吊点' },
  { id: uuidv4(), label: 'A2', x: 6, y: 8, rated_load: 200, rated_load_unit: 'kg', angle: 5, angle_direction: 'right', notes: '舞台中前区吊点' },
  { id: uuidv4(), label: 'A3', x: 10, y: 8, rated_load: 200, rated_load_unit: 'kg', angle: 5, angle_direction: 'left', notes: '舞台右前区主吊点' },
  { id: uuidv4(), label: 'B1', x: 4, y: 4, rated_load: 150, rated_load_unit: 'kg', angle: 0, angle_direction: 'left', notes: '舞台左后区吊点' },
  { id: uuidv4(), label: 'B2', x: 8, y: 4, rated_load: 150, rated_load_unit: 'kg', angle: 10, angle_direction: 'right', notes: '舞台右后区吊点' },
]

const insertPoint = db.prepare(
  `INSERT INTO rigging_point (id, scheme_id, label, x, y, rated_load, rated_load_unit, angle, angle_direction, notes, created_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
)
for (const p of points) {
  insertPoint.run(p.id, schemeId, p.label, p.x, p.y, p.rated_load, p.rated_load_unit, p.angle, p.angle_direction, p.notes, now)
}

const assignments = [
  { id: uuidv4(), point_id: points[0].id, fixture_id: fixtures[0].id, quantity: 2, notes: '' },
  { id: uuidv4(), point_id: points[0].id, fixture_id: fixtures[2].id, quantity: 3, notes: '' },
  { id: uuidv4(), point_id: points[1].id, fixture_id: fixtures[0].id, quantity: 3, notes: '' },
  { id: uuidv4(), point_id: points[1].id, fixture_id: fixtures[1].id, quantity: 1, notes: '' },
  { id: uuidv4(), point_id: points[2].id, fixture_id: fixtures[0].id, quantity: 2, notes: '' },
  { id: uuidv4(), point_id: points[2].id, fixture_id: fixtures[2].id, quantity: 3, notes: '' },
  { id: uuidv4(), point_id: points[3].id, fixture_id: fixtures[3].id, quantity: 3, notes: '注意单位为lb' },
  { id: uuidv4(), point_id: points[3].id, fixture_id: fixtures[2].id, quantity: 2, notes: '' },
  { id: uuidv4(), point_id: points[4].id, fixture_id: fixtures[4].id, quantity: 3, notes: '' },
  { id: uuidv4(), point_id: points[4].id, fixture_id: fixtures[1].id, quantity: 2, notes: '' },
]

const insertAssignment = db.prepare(
  'INSERT INTO assignment (id, scheme_id, point_id, fixture_id, quantity, notes) VALUES (?, ?, ?, ?, ?, ?)'
)
for (const a of assignments) {
  insertAssignment.run(a.id, schemeId, a.point_id, a.fixture_id, a.quantity, a.notes)
}

console.log('Seed data inserted successfully')
console.log(`Scheme: ${schemeId}`)
console.log(`Fixtures: ${fixtures.length}`)
console.log(`Points: ${points.length}`)
console.log(`Assignments: ${assignments.length}`)

process.exit(0)
