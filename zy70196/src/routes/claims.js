const express = require('express')
const router = express.Router()
const claimService = require('../services/claimService')

router.get('/draft/:deliveryId', async (req, res) => {
  try {
    const draft = await claimService.generateClaimDraft(req.params.deliveryId)
    res.json(draft)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

router.post('/', async (req, res) => {
  try {
    const claim = await claimService.createClaim(req.body)
    res.status(201).json(claim)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

router.post('/:id/submit', async (req, res) => {
  try {
    const claim = await claimService.submitClaim(req.params.id)
    res.json(claim)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

router.post('/:id/supplier-confirm', async (req, res) => {
  try {
    const claim = await claimService.confirmBySupplier(req.params.id, req.body.remark)
    res.json(claim)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

router.post('/:id/supplier-reject', async (req, res) => {
  try {
    const claim = await claimService.rejectBySupplier(req.params.id, req.body.remark)
    res.json(claim)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

router.post('/:id/deduction-receipt', async (req, res) => {
  try {
    const { receiptNo, receiptDate } = req.body
    const claim = await claimService.recordDeductionReceipt(req.params.id, receiptNo, receiptDate)
    res.json(claim)
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
    const claims = await claimService.listClaims(filters)
    res.json(claims)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const claim = await claimService.getClaimById(req.params.id)
    if (!claim) {
      return res.status(404).json({ error: 'Claim not found' })
    }
    res.json(claim)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

router.get('/no/:claimNo', async (req, res) => {
  try {
    const claim = await claimService.getClaimByNo(req.params.claimNo)
    if (!claim) {
      return res.status(404).json({ error: 'Claim not found' })
    }
    res.json(claim)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

router.get('/:id/report', async (req, res) => {
  try {
    const report = await claimService.generateClaimReport(req.params.id)
    res.json(report)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

module.exports = router
