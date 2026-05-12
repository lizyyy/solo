const express = require('express');
const router = express.Router();
const ContractService = require('../services/ContractService');

router.post('/', async (req, res) => {
  try {
    const contract = await ContractService.createContract(req.body);
    res.json({ success: true, data: contract });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const contracts = await ContractService.listContracts(req.query);
    res.json({ success: true, data: contracts });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const contract = await ContractService.getContractDetail(req.params.id);
    res.json({ success: true, data: contract });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get('/no/:contractNo', async (req, res) => {
  try {
    const contract = await ContractService.getContractByNo(req.params.contractNo);
    res.json({ success: true, data: contract });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get('/:contractId/forbearance-eligibility/:installmentId', async (req, res) => {
  try {
    const eligibility = await ContractService.calculateForbearanceEligibility(
      req.params.contractId,
      req.params.installmentId
    );
    res.json({ success: true, data: eligibility });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

module.exports = router;
