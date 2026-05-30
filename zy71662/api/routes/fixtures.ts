import { Router, type Request, type Response } from 'express'
import * as fixtureService from '../services/fixture.service.js'

const router = Router()

router.get('/', (_req: Request, res: Response) => {
  try {
    const fixtures = fixtureService.listFixtures()
    res.json({ success: true, data: fixtures })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

router.post('/', (req: Request, res: Response) => {
  try {
    const fixture = fixtureService.createFixture(req.body)
    res.status(201).json({ success: true, data: fixture })
  } catch (error) {
    res.status(400).json({ success: false, error: (error as Error).message })
  }
})

router.get('/:fid', (req: Request, res: Response) => {
  try {
    const fixture = fixtureService.getFixture(req.params.fid)
    if (!fixture) {
      res.status(404).json({ success: false, error: 'Fixture not found' })
      return
    }
    res.json({ success: true, data: fixture })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

router.put('/:fid', (req: Request, res: Response) => {
  try {
    const fixture = fixtureService.updateFixture(req.params.fid, req.body)
    res.json({ success: true, data: fixture })
  } catch (error) {
    const msg = (error as Error).message
    if (msg.includes('not found')) {
      res.status(404).json({ success: false, error: msg })
      return
    }
    res.status(400).json({ success: false, error: msg })
  }
})

router.delete('/:fid', (req: Request, res: Response) => {
  try {
    const deleted = fixtureService.deleteFixture(req.params.fid)
    if (!deleted) {
      res.status(404).json({ success: false, error: 'Fixture not found' })
      return
    }
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

export default router
