import { Router, type Request, type Response } from 'express'
import db from '../db.js'
import { v4 as uuidv4 } from 'uuid'
import { evaluateScenario } from '../scoringEngine.js'
import { scenarios as seedScenarios } from '../seedData.js'
import type { Scenario, PhaseConfig, Movement, GameResult, EvaluationResult } from '../../shared/types.js'

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

function buildDefaultPhases(scenario: Scenario): PhaseConfig[] {
  const nsStraight: Movement[] = []
  const nsLeft: Movement[] = []
  const ewStraight: Movement[] = []
  const ewLeft: Movement[] = []

  for (const approach of scenario.approaches) {
    if (approach.direction === 'north' || approach.direction === 'south') {
      if (approach.lanes.some(l => l.type === 'straight')) {
        nsStraight.push({ approachId: approach.id, laneType: 'straight' })
      }
      if (approach.lanes.some(l => l.type === 'left')) {
        nsLeft.push({ approachId: approach.id, laneType: 'left' })
      }
    }
    if (approach.direction === 'east' || approach.direction === 'west') {
      if (approach.lanes.some(l => l.type === 'straight')) {
        ewStraight.push({ approachId: approach.id, laneType: 'straight' })
      }
      if (approach.lanes.some(l => l.type === 'left')) {
        ewLeft.push({ approachId: approach.id, laneType: 'left' })
      }
    }
  }

  return [
    { id: 'phase-1', name: '南北直行', greenSeconds: 30, yellowSeconds: 3, redClearanceSeconds: 2, movements: nsStraight },
    { id: 'phase-2', name: '南北左转', greenSeconds: 15, yellowSeconds: 3, redClearanceSeconds: 2, movements: nsLeft },
    { id: 'phase-3', name: '东西直行', greenSeconds: 30, yellowSeconds: 3, redClearanceSeconds: 2, movements: ewStraight },
    { id: 'phase-4', name: '东西左转', greenSeconds: 15, yellowSeconds: 3, redClearanceSeconds: 2, movements: ewLeft },
  ]
}

router.post('/', (req: Request, res: Response) => {
  ensureSeeded()
  const { scenarioId, playerName } = req.body as { scenarioId: string; playerName: string }
  const scenarioRow = db.prepare('SELECT * FROM scenarios WHERE id = ?').get(scenarioId) as { config: string } | undefined
  if (!scenarioRow) {
    res.status(404).json({ error: 'Scenario not found' })
    return
  }
  const scenario: Scenario = JSON.parse(scenarioRow.config)
  const gameId = uuidv4()
  const defaultPhases = buildDefaultPhases(scenario)
  db.prepare('INSERT INTO games (id, scenario_id, player_name, phase_config) VALUES (?, ?, ?, ?)').run(
    gameId, scenarioId, playerName, JSON.stringify(defaultPhases),
  )
  res.status(201).json({ gameId })
})

router.get('/:id', (req: Request, res: Response) => {
  ensureSeeded()
  const row = db.prepare(`
    SELECT g.*, s.name as scenario_name, s.config as scenario_config
    FROM games g
    JOIN scenarios s ON g.scenario_id = s.id
    WHERE g.id = ?
  `).get(req.params.id) as Record<string, unknown> | undefined
  if (!row) {
    res.status(404).json({ error: 'Game not found' })
    return
  }
  const scenarioConfig = JSON.parse(row.scenario_config as string)
  res.json({
    id: row.id,
    scenarioId: row.scenario_id,
    scenarioName: row.scenario_name,
    playerName: row.player_name,
    phaseConfig: JSON.parse(row.phase_config as string),
    vehicleScore: row.vehicle_score,
    pedestrianScore: row.pedestrian_score,
    busScore: row.bus_score,
    totalScore: row.total_score,
    passed: row.passed,
    risks: JSON.parse(row.risks as string),
    winReasons: JSON.parse(row.win_reasons as string),
    loseReasons: JSON.parse(row.lose_reasons as string),
    passThreshold: scenarioConfig.passThreshold,
    createdAt: row.created_at,
  })
})

router.put('/:id/phases', (req: Request, res: Response) => {
  const { phaseConfig } = req.body as { phaseConfig: PhaseConfig[] }
  db.prepare('UPDATE games SET phase_config = ? WHERE id = ?').run(
    JSON.stringify(phaseConfig), req.params.id,
  )
  res.json({ success: true })
})

router.post('/:id/submit', (req: Request, res: Response) => {
  ensureSeeded()
  const gameRow = db.prepare('SELECT * FROM games WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined
  if (!gameRow) {
    res.status(404).json({ error: 'Game not found' })
    return
  }
  const scenarioRow = db.prepare('SELECT * FROM scenarios WHERE id = ?').get(gameRow.scenario_id as string) as { config: string; name: string } | undefined
  if (!scenarioRow) {
    res.status(404).json({ error: 'Scenario not found' })
    return
  }
  const scenario: Scenario = JSON.parse(scenarioRow.config)
  const phases: PhaseConfig[] = JSON.parse(gameRow.phase_config as string)
  const evaluation = evaluateScenario(scenario, phases)

  db.prepare(
    'UPDATE games SET vehicle_score = ?, pedestrian_score = ?, bus_score = ?, total_score = ?, passed = ?, risks = ?, win_reasons = ?, lose_reasons = ? WHERE id = ?',
  ).run(
    evaluation.vehicleScore,
    evaluation.pedestrianScore,
    evaluation.busScore,
    evaluation.totalScore,
    evaluation.passed ? 1 : 0,
    JSON.stringify(evaluation.risks),
    JSON.stringify(evaluation.winReasons),
    JSON.stringify(evaluation.loseReasons),
    gameRow.id as string,
  )

  const result: GameResult = {
    gameId: gameRow.id as string,
    scenarioId: gameRow.scenario_id as string,
    scenarioName: scenarioRow.name,
    playerName: gameRow.player_name as string,
    phaseConfig: phases,
    vehicleScore: evaluation.vehicleScore,
    pedestrianScore: evaluation.pedestrianScore,
    busScore: evaluation.busScore,
    totalScore: evaluation.totalScore,
    passed: evaluation.passed,
    passThreshold: scenario.passThreshold,
    risks: evaluation.risks,
    winReasons: evaluation.winReasons,
    loseReasons: evaluation.loseReasons,
  }

  res.json(result)
})

export default router
