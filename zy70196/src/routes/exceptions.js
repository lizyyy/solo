const express = require('express')
const router = express.Router()
const exceptionService = require('../services/exceptionService')

router.get('/', async (req, res) => {
  try {
    const filters = {
      type: req.query.type,
      status: req.query.status,
      supplierId: req.query.supplierId,
      deliveryId: req.query.deliveryId,
      claimId: req.query.claimId
    }
    const exceptions = await exceptionService.getExceptions(filters)
    res.json(exceptions)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

router.post('/:id/resolve', async (req, res) => {
  try {
    const { resolvedBy, resolutionNote } = req.body
    const exception = await exceptionService.resolveException(req.params.id, resolvedBy, resolutionNote)
    res.json(exception)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

router.get('/tasks', async (req, res) => {
  try {
    const filters = {
      type: req.query.type,
      assignee: req.query.assignee,
      completed: req.query.completed === 'true' ? true : req.query.completed === 'false' ? false : undefined,
      source: req.query.source
    }
    const tasks = await exceptionService.getPendingTasks(filters)
    res.json(tasks)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

router.post('/tasks/:id/complete', async (req, res) => {
  try {
    const { completedBy } = req.body
    const task = await exceptionService.completeTask(req.params.id, completedBy)
    res.json(task)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

module.exports = router
