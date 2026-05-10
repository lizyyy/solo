const express = require('express');
const router = express.Router();
const AgreementService = require('../services/AgreementService');

router.post('/', async (req, res) => {
  try {
    const { name, year, totalAmount } = req.body;
    const agreement = await AgreementService.createAgreement({ name, year, totalAmount });
    res.status(201).json(agreement);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/', (req, res) => {
  try {
    const agreements = AgreementService.getAllAgreements();
    res.json(agreements);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const agreement = AgreementService.getAgreement(req.params.id);
    res.json(agreement);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

router.put('/:id/total-amount', (req, res) => {
  try {
    const { newTotalAmount } = req.body;
    const updated = AgreementService.updateAgreementTotalAmount(req.params.id, newTotalAmount);
    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/:id/available', (req, res) => {
  try {
    const available = AgreementService.getAvailableAmount(req.params.id);
    res.json({ available_amount: available });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
