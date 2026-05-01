import { Router } from 'express'
import * as statsService from '../services/statisticsService.js'

const router = Router()

router.get('/', async (req, res) => {
  try {
    const { startDate, endDate } = req.query
    
    const filter: statsService.StatsFilter = {}
    if (typeof startDate === 'string') {
      filter.startDate = startDate
    }
    if (typeof endDate === 'string') {
      filter.endDate = endDate
    }
    
    const stats = await statsService.getStatistics(filter)
    res.json(stats)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

export default router
