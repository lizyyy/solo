const express = require('express')
const router = express.Router()
const prisma = require('../lib/prisma')
const deliveryService = require('../services/deliveryService')

router.post('/', async (req, res) => {
  try {
    const delivery = await deliveryService.createDelivery(req.body)
    res.status(201).json(delivery)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

router.get('/', async (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      supplierId: req.query.supplierId,
      startDate: req.query.startDate,
      endDate: req.query.endDate
    }
    const deliveries = await deliveryService.listDeliveries(filters)
    res.json(deliveries)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const delivery = await deliveryService.getDeliveryById(req.params.id)
    if (!delivery) {
      return res.status(404).json({ error: 'Delivery not found' })
    }
    res.json(delivery)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

router.get('/no/:deliveryNo', async (req, res) => {
  try {
    const delivery = await deliveryService.getDeliveryByNo(req.params.deliveryNo)
    if (!delivery) {
      return res.status(404).json({ error: 'Delivery not found' })
    }
    res.json(delivery)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

module.exports = router
