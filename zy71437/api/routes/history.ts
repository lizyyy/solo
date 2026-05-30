import { Router, type Request, type Response } from 'express'
import db from '../db.js'
import { scenarios as seedScenarios } from '../seedData.js'

const router = Router()

function ensureSeeded() {
  const count = (db.prepare('SELECT COUNT(*) as count FROM scenarios').get() as { count: number }).count
  if (count === 0) {
    const insert = db.prepare('INSERT INTO scenarios (id, name, difficulty, intersection_type, config) VALUES (?, ?, ?, ?, ?)')
    for (const s of seedScenarios) {
      insert.run(s.id, s.name, s.difficulty, s.intersectionType, JSON.stringify(s))
    }
  }
}

router.get('/leaderboard', (req: Request, res: Response) => {
  ensureSeeded()
  const { scenarioId } = req.query
  let rows: any[]
  if (scenarioId) {
    rows = db.prepare(
      `SELECT g.player_name, g.scenario_id, s.name as scenario_name, g.total_score, g.vehicle_score, g.pedestrian_score, g.bus_score, g.passed, g.created_at
       FROM games g
       INNER JOIN scenarios s ON g.scenario_id = s.id
       INNER JOIN (
         SELECT player_name, MAX(total_score) as max_score
         FROM games
         WHERE scenario_id = ?
         GROUP BY player_name
       ) m ON g.player_name = m.player_name AND g.total_score = m.max_score
       WHERE g.scenario_id = ?
       ORDER BY g.total_score DESC
       LIMIT 20`,
    ).all(scenarioId as string, scenarioId as string) as any[]
  } else {
    rows = db.prepare(
      `SELECT g.player_name, g.scenario_id, s.name as scenario_name, g.total_score, g.vehicle_score, g.pedestrian_score, g.bus_score, g.passed, g.created_at
       FROM games g
       INNER JOIN scenarios s ON g.scenario_id = s.id
       INNER JOIN (
         SELECT player_name, MAX(total_score) as max_score
         FROM games
         GROUP BY player_name
       ) m ON g.player_name = m.player_name AND g.total_score = m.max_score
       ORDER BY g.total_score DESC
       LIMIT 20`,
    ).all() as any[]
  }
  res.json(rows.map(row => ({
    playerName: row.player_name,
    scenarioId: row.scenario_id,
    scenarioName: row.scenario_name,
    totalScore: row.total_score,
    vehicleScore: row.vehicle_score,
    pedestrianScore: row.pedestrian_score,
    busScore: row.bus_score,
    passed: row.passed === 1,
    createdAt: row.created_at,
  })))
})

router.get('/:id/export', (req: Request, res: Response) => {
  ensureSeeded()
  const row = db.prepare('SELECT * FROM games WHERE id = ?').get(req.params.id) as any | undefined
  if (!row) {
    res.status(404).json({ error: 'Game not found' })
    return
  }
  const csv = `id,scenario_id,player_name,vehicle_score,pedestrian_score,bus_score,total_score,passed,created_at\n${row.id},${row.scenario_id},${row.player_name},${row.vehicle_score},${row.pedestrian_score},${row.bus_score},${row.total_score},${row.passed ? 1 : 0},${row.created_at}`
  res.setHeader('Content-Type', 'text/csv')
  res.setHeader('Content-Disposition', `attachment; filename=game-${row.id}.csv`)
  res.send(csv)
})

router.get('/', (req: Request, res: Response) => {
  ensureSeeded()
  const { player } = req.query
  let rows: any[]
  if (player) {
    rows = db.prepare(
      'SELECT id, scenario_id, player_name, total_score, vehicle_score, pedestrian_score, bus_score, passed, created_at FROM games WHERE player_name = ? ORDER BY created_at DESC',
    ).all(player as string) as any[]
  } else {
    rows = db.prepare(
      'SELECT id, scenario_id, player_name, total_score, vehicle_score, pedestrian_score, bus_score, passed, created_at FROM games ORDER BY created_at DESC',
    ).all() as any[]
  }
  res.json(rows.map(row => ({
    id: row.id,
    scenarioId: row.scenario_id,
    playerName: row.player_name,
    totalScore: row.total_score,
    vehicleScore: row.vehicle_score,
    pedestrianScore: row.pedestrian_score,
    busScore: row.bus_score,
    passed: row.passed === 1,
    createdAt: row.created_at,
  })))
})

export default router
