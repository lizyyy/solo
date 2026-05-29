import { Router, Request, Response } from 'express'
import {
  getProblems,
  getProblemById,
  createProblem,
  getProblemVersions,
  compareVersions,
  createVersion,
  confirmProblem,
  getChannelStatus,
  getAnomalies,
  getReportData,
} from '../services/problemService.js'
import { anomalyDetectionMiddleware } from '../middleware/anomalyDetector.js'

const router = Router()

router.get('/problems', (req: Request, res: Response) => {
  const { status, channel, musician } = req.query
  const filters = {
    status: status as string | undefined,
    channel: channel ? parseInt(channel as string) : undefined,
    musician: musician as string | undefined,
  }
  const problems = getProblems(filters)
  res.json(problems)
})

router.get('/problems/:id', (req: Request, res: Response) => {
  const problem = getProblemById(req.params.id)
  if (!problem) {
    return res.status(404).json({ error: 'Problem not found' })
  }
  res.json(problem)
})

router.post('/problems', anomalyDetectionMiddleware, (req: Request, res: Response) => {
  const anomalies = (req as any).anomalies || []
  const problem = createProblem(req.body, anomalies)
  res.status(201).json(problem)
})

router.get('/problems/:id/versions', (req: Request, res: Response) => {
  const versions = getProblemVersions(req.params.id)
  res.json(versions)
})

router.get('/problems/:id/versions/:v1/:v2', (req: Request, res: Response) => {
  const v1 = parseInt(req.params.v1)
  const v2 = parseInt(req.params.v2)
  const diff = compareVersions(req.params.id, v1, v2)
  res.json(diff)
})

router.post('/problems/:id/versions', (req: Request, res: Response) => {
  try {
    const version = createVersion(req.params.id, req.body)
    res.status(201).json(version)
  } catch (error: any) {
    res.status(404).json({ error: error.message })
  }
})

router.post('/problems/:id/confirm', (req: Request, res: Response) => {
  try {
    const confirmation = confirmProblem(req.params.id, req.body)
    res.json(confirmation)
  } catch (error: any) {
    res.status(404).json({ error: error.message })
  }
})

router.get('/channels/status', (_req: Request, res: Response) => {
  const status = getChannelStatus()
  res.json(status)
})

router.get('/anomalies', (_req: Request, res: Response) => {
  const anomalies = getAnomalies()
  res.json(anomalies)
})

router.get('/report', (req: Request, res: Response) => {
  const { rehearsalId, startDate, endDate } = req.query
  const filters = {
    rehearsalId: rehearsalId as string | undefined,
    startDate: startDate as string | undefined,
    endDate: endDate as string | undefined,
  }
  const report = getReportData(filters)
  res.json(report)
})

export default router
