import { Router } from 'express'
import * as techService from '../services/technicianService.js'

const router = Router()

router.get('/', async (req, res) => {
  try {
    const technicians = await techService.listTechnicians()
    res.json(technicians)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

router.post('/', async (req, res) => {
  try {
    const { name } = req.body
    if (!name || typeof name !== 'string') {
      res.status(400).json({ error: 'name 为必填字符串' })
      return
    }
    
    const tech = await techService.createTechnician(name)
    res.status(201).json(tech)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    res.status(400).json({ error: message })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    await techService.deleteTechnician(req.params.id)
    res.status(204).send()
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    res.status(400).json({ error: message })
  }
})

export default router
