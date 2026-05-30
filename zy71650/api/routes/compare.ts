import { Router, type Request, type Response } from 'express'
import { getDb } from '../db.js'

const PARAMS = ['attack', 'decay', 'sustain', 'release'] as const

const router = Router()

router.post('/', (req: Request, res: Response): void => {
  try {
    const { recordIds } = req.body

    if (!recordIds || !Array.isArray(recordIds) || recordIds.length < 2) {
      res.status(400).json({ success: false, error: 'At least 2 record IDs are required' })
      return
    }

    const db = getDb()

    const records = (recordIds as string[]).map((id: string) => {
      return db.prepare('SELECT * FROM fitting_records WHERE id = ?').get(id) as any
    })

    for (let i = 0; i < records.length; i++) {
      if (!records[i]) {
        res.status(404).json({ success: false, error: `Record ${recordIds[i]} not found` })
        return
      }
    }

    const differences: {
      param: string
      values: { recordId: string; value: number }[]
      maxDiff: number
      maxDiffPercent: number
    }[] = []

    for (const param of PARAMS) {
      const values = records.map((r: any) => ({
        recordId: r.id,
        value: r[`conclusion_${param}`],
      }))
      const numValues = values.map((v) => v.value)
      const maxVal = Math.max(...numValues)
      const minVal = Math.min(...numValues)
      const maxDiff = maxVal - minVal
      const maxDiffPercent = minVal !== 0 ? (maxDiff / Math.abs(minVal)) * 100 : maxDiff > 0 ? 100 : 0

      differences.push({ param, values, maxDiff, maxDiffPercent })
    }

    const coverageWarnings: {
      oldRecordId: string
      newRecordId: string
      coveredParams: string[]
      message: string
    }[] = []

    for (const record of records) {
      if (record.superseded_by) {
        const newerRecord = db.prepare('SELECT * FROM fitting_records WHERE id = ?').get(record.superseded_by) as any
        if (newerRecord) {
          const coveredParams: string[] = []

          for (const param of PARAMS) {
            const oldVal = record[`conclusion_${param}`]
            const newVal = newerRecord[`conclusion_${param}`]
            const percentDiff = oldVal !== 0 ? (Math.abs(newVal - oldVal) / Math.abs(oldVal)) * 100 : 100
            if (percentDiff > 20) {
              coveredParams.push(param)
            }
          }

          if (coveredParams.length > 0) {
            coverageWarnings.push({
              oldRecordId: record.id,
              newRecordId: newerRecord.id,
              coveredParams,
              message: `记录 ${record.id.slice(0, 6)}... 的 ${coveredParams.join(', ')} 参数已被新拟合覆盖（变化超过 20%）`,
            })
          }
        }
      }
    }

    res.status(200).json({
      success: true,
      data: {
        records,
        differences,
        coverageWarnings,
      }
    })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to compare records' })
  }
})

export default router
