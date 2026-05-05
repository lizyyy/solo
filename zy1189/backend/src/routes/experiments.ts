import { Router, Request, Response } from 'express'
import { dataStore } from '../store/dataStore.js'
import { Experiment } from '../types/index.js'

const router = Router()

router.get('/', (_req: Request, res: Response) => {
  const experiments = dataStore.getAllExperiments()
  res.json({
    success: true,
    data: experiments
  })
})

router.get('/:id', (req: Request, res: Response) => {
  const { id } = req.params
  const experiment = dataStore.getExperiment(id)
  
  if (!experiment) {
    res.status(404).json({
      success: false,
      error: 'Experiment not found'
    })
    return
  }
  
  res.json({
    success: true,
    data: experiment
  })
})

router.post('/', (req: Request, res: Response) => {
  const { name, description } = req.body
  
  if (!name || typeof name !== 'string') {
    res.status(400).json({
      success: false,
      error: 'Name is required and must be a string'
    })
    return
  }
  
  const experiment = dataStore.createExperiment(name, description || '')
  
  res.status(201).json({
    success: true,
    data: experiment
  })
})

router.put('/:id', (req: Request, res: Response) => {
  const { id } = req.params
  const updates: Partial<Experiment> = req.body
  
  const updated = dataStore.updateExperiment(id, updates)
  
  if (!updated) {
    res.status(404).json({
      success: false,
      error: 'Experiment not found'
    })
    return
  }
  
  res.json({
    success: true,
    data: updated
  })
})

router.delete('/:id', (req: Request, res: Response) => {
  const { id } = req.params
  const deleted = dataStore.deleteExperiment(id)
  
  if (!deleted) {
    res.status(404).json({
      success: false,
      error: 'Experiment not found'
    })
    return
  }
  
  res.json({
    success: true,
    message: 'Experiment deleted'
  })
})

router.post('/:id/duplicate', (req: Request, res: Response) => {
  const { id } = req.params
  const duplicated = dataStore.duplicateExperiment(id)
  
  if (!duplicated) {
    res.status(404).json({
      success: false,
      error: 'Experiment not found'
    })
    return
  }
  
  res.status(201).json({
    success: true,
    data: duplicated
  })
})

router.put('/:id/save-state', (req: Request, res: Response) => {
  const { id } = req.params
  const { tasks, events, snapshots, lastTick, configuration } = req.body
  
  const experiment = dataStore.getExperiment(id)
  if (!experiment) {
    res.status(404).json({
      success: false,
      error: 'Experiment not found'
    })
    return
  }
  
  const updated = dataStore.updateExperiment(id, {
    tasks,
    events,
    snapshots,
    lastTick,
    configuration,
    updatedAt: Date.now()
  })
  
  res.json({
    success: true,
    data: updated
  })
})

export default router
