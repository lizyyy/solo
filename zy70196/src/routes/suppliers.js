const express = require('express')
const router = express.Router()
const prisma = require('../lib/prisma')

router.post('/', async (req, res) => {
  try {
    const supplier = await prisma.supplier.create({
      data: req.body
    })
    res.status(201).json(supplier)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

router.get('/', async (req, res) => {
  try {
    const suppliers = await prisma.supplier.findMany({
      orderBy: { name: 'asc' }
    })
    res.json(suppliers)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const supplier = await prisma.supplier.findUnique({
      where: { id: req.params.id },
      include: {
        deliveries: true,
        claims: true,
        exceptions: true
      }
    })
    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' })
    }
    res.json(supplier)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

module.exports = router
