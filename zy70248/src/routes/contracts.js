const express = require('express');
const router = express.Router();
const { service: contractService } = require('../services/contractService');
const { handleError } = require('../utils/errors');

router.post('/', (req, res) => {
  try {
    const contract = contractService.createContract(req.body);
    res.json({ success: true, data: contract });
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/', (req, res) => {
  try {
    const contracts = contractService.getAllContracts();
    res.json({ success: true, data: contracts });
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/:id', (req, res) => {
  try {
    const contract = contractService.getContract(req.params.id);
    res.json({ success: true, data: contract });
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/active/:shipId', (req, res) => {
  try {
    const contract = contractService.getActiveContract(req.params.shipId, req.query.date);
    res.json({ success: true, data: contract });
  } catch (error) {
    handleError(res, error);
  }
});

module.exports = router;
