const express = require('express')
const router = express.Router()
const inspectionService = require('../services/inspectionService')

router.post('/', async (req, res) => {
  try {
    const inspection = await inspectionService.createInspection(req.body)
    res.status(201).json(inspection)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const inspection = await inspectionService.getInspectionById(req.params.id)
    if (!inspection) {
      return res.status(404).json({ error: 'Inspection not found' })
    }
    res.json(inspection)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

router.get('/delivery/:deliveryId', async (req, res) => {
  try {
    const inspection = await inspectionService.getInspectionByDeliveryId(req.params.deliveryId)
    if (!inspection) {
      return res.status(404).json({ error: 'Inspection not found' })
    }
    res.json(inspection)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

module.exports = router
