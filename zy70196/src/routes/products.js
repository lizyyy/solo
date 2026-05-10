const express = require('express')
const router = express.Router()
const prisma = require('../lib/prisma')

router.post('/', async (req, res) => {
  try {
    const product = await prisma.product.create({
      data: req.body
    })
    res.status(201).json(product)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

router.get('/', async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      orderBy: { name: 'asc' }
    })
    res.json(products)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id }
    })
    if (!product) {
      return res.status(404).json({ error: 'Product not found' })
    }
    res.json(product)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

module.exports = router
