import { Router, type Request, type Response } from 'express'
import db from '../db.js'
import type { Scenario, ScenarioSummary } from '../../shared/types.js'
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

router.get('/', (_req: Request, res: Response) => {
  ensureSeeded()
  const rows = db.prepare('SELECT * FROM scenarios').all() as { id: string; name: string; difficulty: string; intersection_type: string; config: string }[]
  const summaries: ScenarioSummary[] = rows.map(row => {
    const scenario: Scenario = JSON.parse(row.config)
    return {
      id: row.id,
      name: row.name,
      difficulty: row.difficulty as ScenarioSummary['difficulty'],
      intersectionType: row.intersection_type as ScenarioSummary['intersectionType'],
      totalVehicleFlow: scenario.approaches.reduce((sum, a) => sum + a.vehicleFlow, 0),
      totalPedestrianFlow: scenario.approaches.reduce((sum, a) => sum + a.pedestrianFlow, 0),
      busRouteCount: scenario.busRoutes.length,
    }
  })
  res.json(summaries)
})

router.get('/:id', (req: Request, res: Response) => {
  ensureSeeded()
  const row = db.prepare('SELECT * FROM scenarios WHERE id = ?').get(req.params.id) as { id: string; name: string; difficulty: string; intersection_type: string; config: string } | undefined
  if (!row) {
    res.status(404).json({ error: 'Scenario not found' })
    return
  }
  const scenario: Scenario = JSON.parse(row.config)
  res.json(scenario)
})

export default router
