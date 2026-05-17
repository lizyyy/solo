const express = require('express');
const ContractService = require('../services/ContractService');

const router = express.Router();
const contractService = new ContractService();

router.post('/', (req, res) => {
  try {
    const contract = contractService.createContract(req.body);
    res.status(201).json({
      success: true,
      data: contract
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/', (req, res) => {
  const contracts = contractService.getAllContracts();
  res.json({
    success: true,
    data: contracts
  });
});

router.get('/:contractNo', (req, res) => {
  const contract = contractService.getContract(req.params.contractNo);
  if (!contract) {
    return res.status(404).json({
      success: false,
      error: '合同不存在'
    });
  }
  res.json({
    success: true,
    data: contract
  });
});

router.post('/:contractNo/status', (req, res) => {
  try {
    const { action, operator, comment } = req.body;
    const contract = contractService.transitionStatus(
      req.params.contractNo,
      action,
      operator,
      comment
    );
    res.json({
      success: true,
      data: contract
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/:contractNo/sync', (req, res) => {
  try {
    const { targetSystem, operator } = req.body;
    const contract = contractService.syncToBusinessSystem(
      req.params.contractNo,
      targetSystem,
      operator
    );
    res.json({
      success: true,
      data: contract
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/:contractNo/correct', (req, res) => {
  try {
    const contract = contractService.correctContract(
      req.params.contractNo,
      req.body
    );
    res.json({
      success: true,
      data: contract
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/:contractNo/export', (req, res) => {
  try {
    const { format = 'json' } = req.query;
    const report = contractService.exportReport(req.params.contractNo, format);
    
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${req.params.contractNo}-report.csv`);
      res.send(report);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.send(report);
    }
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/:contractNo/exceptions', (req, res) => {
  const exceptions = contractService.getContractExceptions(req.params.contractNo);
  res.json({
    success: true,
    data: exceptions
  });
});

module.exports = router;