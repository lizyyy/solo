import { Router, type Request, type Response } from 'express'
import { getDb } from '../db.js'

const router = Router()

interface JudgmentRow {
  id: string
  record_id: string
  step: number
  type: string
  description: string
  result: string
  created_at: string
}

function judgmentToApi(row: JudgmentRow) {
  return {
    id: row.id,
    recordId: row.record_id,
    step: row.step,
    type: row.type,
    description: row.description,
    result: row.result,
    createdAt: row.created_at,
  }
}

router.get('/:id/judgments', (req: Request, res: Response) => {
  const db = getDb()
  const { id } = req.params

  const record = db.prepare('SELECT id FROM records WHERE id = ?').get(id)
  if (!record) {
    res.status(404).json({ error: '记录不存在' })
    return
  }

  const rows = db.prepare('SELECT * FROM judgment_logs WHERE record_id = ? ORDER BY step ASC').all(id) as JudgmentRow[]
  res.json({ judgments: rows.map(judgmentToApi) })
})

export default router
