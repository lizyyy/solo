import { Router, type Request, type Response } from 'express'
import db from '../db.js'

const router = Router()

interface ParameterSnapshot {
  id: string
  run_id: string | null
  snapshot_time: string
  parameters: string
  changed_from: string | null
  change_step: number
  impact_summary: string | null
}

router.get('/snapshots', (_req: Request, res: Response): void => {
  try {
    const snapshots = db.prepare('SELECT * FROM parameter_snapshots ORDER BY snapshot_time DESC').all() as ParameterSnapshot[]

    const result = snapshots.map(s => ({
      ...s,
      parameters: JSON.parse(s.parameters),
      changed_from: s.changed_from ? JSON.parse(s.changed_from) : null,
      impact_summary: s.impact_summary ? JSON.parse(s.impact_summary) : null,
    }))

    res.json({ success: true, data: result })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch snapshots' })
  }
})

router.get('/diff', (req: Request, res: Response): void => {
  try {
    const { from, to } = req.query

    if (!from || !to) {
      res.status(400).json({ success: false, error: 'from and to query parameters are required' })
      return
    }

    const fromSnapshot = db.prepare('SELECT * FROM parameter_snapshots WHERE id = ?').get(from as string) as ParameterSnapshot | undefined
    const toSnapshot = db.prepare('SELECT * FROM parameter_snapshots WHERE id = ?').get(to as string) as ParameterSnapshot | undefined

    if (!fromSnapshot) {
      res.status(404).json({ success: false, error: 'From snapshot not found' })
      return
    }

    if (!toSnapshot) {
      res.status(404).json({ success: false, error: 'To snapshot not found' })
      return
    }

    const fromParams = JSON.parse(fromSnapshot.parameters) as Record<string, unknown>
    const toParams = JSON.parse(toSnapshot.parameters) as Record<string, unknown>

    const added: string[] = []
    const removed: string[] = []
    const changed: { field: string; from: unknown; to: unknown }[] = []

    for (const key of Object.keys(toParams)) {
      if (!(key in fromParams)) {
        added.push(key)
      } else if (JSON.stringify(fromParams[key]) !== JSON.stringify(toParams[key])) {
        changed.push({ field: key, from: fromParams[key], to: toParams[key] })
      }
    }

    for (const key of Object.keys(fromParams)) {
      if (!(key in toParams)) {
        removed.push(key)
      }
    }

    res.json({
      success: true,
      data: {
        from: { id: fromSnapshot.id, snapshot_time: fromSnapshot.snapshot_time, parameters: fromParams },
        to: { id: toSnapshot.id, snapshot_time: toSnapshot.snapshot_time, parameters: toParams },
        diff: { added, removed, changed },
      },
    })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to compute diff' })
  }
})

export default router
