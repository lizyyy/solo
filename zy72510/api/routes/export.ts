import { Router, type Request, type Response } from 'express'
import { getBatch, getBatchSamples } from '../services/batches.js'
import { listConflicts } from '../services/conflicts.js'
import type { Sample, ConflictEvidence } from '../../shared/types'

const router = Router()

router.get('/:batchId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { batchId } = req.params
    const format = (req.query.format as string) || 'json'

    const batch = await getBatch(batchId)
    if (!batch) {
      res.status(404).json({ error: 'batch not found' })
      return
    }

    const { all } = await getBatchSamples(batchId)
    const conflicts = await listConflicts(batchId)

    if (format === 'csv') {
      const headers = [
        'id',
        'content',
        'confidenceA',
        'confidenceB',
        'labelA',
        'labelB',
        'grayLabel',
        'finalLabel',
        'isLowConfidence',
        'annotatorNote',
        'reviewedBy',
        'hasConflict',
      ]
      const rows = all.map((sample: Sample) => {
        const hasConflict = conflicts.some((c: ConflictEvidence) => c.sampleId === sample.id)
        return [
          sample.id,
          `"${(sample.content ?? '').replace(/"/g, '""')}"`,
          sample.confidenceA,
          sample.confidenceB,
          sample.labelA,
          sample.labelB,
          sample.grayLabel,
          sample.finalLabel ?? '',
          sample.isLowConfidence,
          `"${(sample.annotatorNote ?? '').replace(/"/g, '""')}"`,
          sample.reviewedBy ?? '',
          hasConflict,
        ].join(',')
      })
      const csv = [headers.join(','), ...rows].join('\n')

      res.setHeader('Content-Type', 'text/csv; charset=utf-8')
      res.setHeader('Content-Disposition', `attachment; filename="${batchId}.csv"`)
      res.send(csv)
    } else {
      const data = {
        batch,
        samples: all,
        conflicts,
      }
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.setHeader('Content-Disposition', `attachment; filename="${batchId}.json"`)
      res.json(data)
    }
  } catch (error) {
    res.status(500).json({ error: (error as Error).message })
  }
})

export default router
