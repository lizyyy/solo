import { Router, type Request, type Response } from 'express'
import * as schemeService from '../services/scheme.service.js'
import * as fixtureService from '../services/fixture.service.js'
import * as calculationService from '../services/calculation.service.js'

const router = Router()

router.get('/', (_req: Request, res: Response) => {
  try {
    const schemes = schemeService.listSchemes()
    res.json({ success: true, data: schemes })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

router.post('/', (req: Request, res: Response) => {
  try {
    const scheme = schemeService.createScheme(req.body)
    res.status(201).json({ success: true, data: scheme })
  } catch (error) {
    res.status(400).json({ success: false, error: (error as Error).message })
  }
})

router.get('/:id', (req: Request, res: Response) => {
  try {
    const detail = schemeService.getSchemeById(req.params.id)
    if (!detail) {
      res.status(404).json({ success: false, error: 'Scheme not found' })
      return
    }
    res.json({ success: true, data: detail })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

router.put('/:id', (req: Request, res: Response) => {
  try {
    const scheme = schemeService.updateScheme(req.params.id, req.body)
    res.json({ success: true, data: scheme })
  } catch (error) {
    const msg = (error as Error).message
    if (msg.includes('not found')) {
      res.status(404).json({ success: false, error: msg })
      return
    }
    res.status(400).json({ success: false, error: msg })
  }
})

router.delete('/:id', (req: Request, res: Response) => {
  try {
    const deleted = schemeService.deleteScheme(req.params.id)
    if (!deleted) {
      res.status(404).json({ success: false, error: 'Scheme not found' })
      return
    }
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

router.get('/:id/points', (req: Request, res: Response) => {
  try {
    const points = schemeService.getPoints(req.params.id)
    res.json({ success: true, data: points })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

router.post('/:id/points', (req: Request, res: Response) => {
  try {
    const point = schemeService.createPoint(req.params.id, req.body)
    res.status(201).json({ success: true, data: point })
  } catch (error) {
    res.status(400).json({ success: false, error: (error as Error).message })
  }
})

router.put('/:id/points/:pid', (req: Request, res: Response) => {
  try {
    const point = schemeService.updatePoint(req.params.id, req.params.pid, req.body)
    res.json({ success: true, data: point })
  } catch (error) {
    const msg = (error as Error).message
    if (msg.includes('not found')) {
      res.status(404).json({ success: false, error: msg })
      return
    }
    res.status(400).json({ success: false, error: msg })
  }
})

router.delete('/:id/points/:pid', (req: Request, res: Response) => {
  try {
    const deleted = schemeService.deletePoint(req.params.id, req.params.pid)
    if (!deleted) {
      res.status(404).json({ success: false, error: 'Point not found' })
      return
    }
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

router.post('/:id/assignments', (req: Request, res: Response) => {
  try {
    const assignment = fixtureService.createAssignment(req.params.id, req.body)
    res.status(201).json({ success: true, data: assignment })
  } catch (error) {
    res.status(400).json({ success: false, error: (error as Error).message })
  }
})

router.put('/:id/assignments/:aid', (req: Request, res: Response) => {
  try {
    const assignment = fixtureService.updateAssignment(req.params.id, req.params.aid, req.body)
    res.json({ success: true, data: assignment })
  } catch (error) {
    const msg = (error as Error).message
    if (msg.includes('not found')) {
      res.status(404).json({ success: false, error: msg })
      return
    }
    res.status(400).json({ success: false, error: msg })
  }
})

router.delete('/:id/assignments/:aid', (req: Request, res: Response) => {
  try {
    const deleted = fixtureService.deleteAssignment(req.params.id, req.params.aid)
    if (!deleted) {
      res.status(404).json({ success: false, error: 'Assignment not found' })
      return
    }
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

router.post('/:id/snapshot', (req: Request, res: Response) => {
  try {
    const version = schemeService.createSnapshot(req.params.id)
    res.status(201).json({ success: true, data: version })
  } catch (error) {
    const msg = (error as Error).message
    if (msg.includes('not found')) {
      res.status(404).json({ success: false, error: msg })
      return
    }
    res.status(400).json({ success: false, error: msg })
  }
})

router.get('/:id/versions', (req: Request, res: Response) => {
  try {
    const versions = schemeService.getVersions(req.params.id)
    res.json({ success: true, data: versions })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

router.get('/:id/versions/:vid', (req: Request, res: Response) => {
  try {
    const version = schemeService.getVersion(req.params.id, req.params.vid)
    if (!version) {
      res.status(404).json({ success: false, error: 'Version not found' })
      return
    }
    res.json({ success: true, data: version })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

router.get('/:id/risks', (req: Request, res: Response) => {
  try {
    const risks = calculationService.getRisks(req.params.id)
    res.json({ success: true, data: risks })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

router.put('/:id/risks/:rid', (req: Request, res: Response) => {
  try {
    const risk = calculationService.updateRiskStatus(req.params.id, req.params.rid, req.body.status)
    if (!risk) {
      res.status(404).json({ success: false, error: 'Risk not found' })
      return
    }
    res.json({ success: true, data: risk })
  } catch (error) {
    res.status(400).json({ success: false, error: (error as Error).message })
  }
})

export default router
