const express = require('express');
const ContractService = require('../services/contract.service');

const router = express.Router();

router.get('/can-generate/:employeeId', (req, res) => {
  try {
    const result = ContractService.canGenerate(req.params.employeeId);
    res.json(result);
  } catch (error) {
    res.status(error.statusCode || 500).json({
      error: error.code || 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

router.post('/generate/:employeeId', (req, res) => {
  try {
    const contract = ContractService.generate(
      req.params.employeeId,
      req.body,
      req.headers['x-user-id'] || 'system'
    );
    res.status(201).json(contract);
  } catch (error) {
    res.status(error.statusCode || 500).json({
      error: error.code || 'INTERNAL_ERROR',
      message: error.message,
      missingDocuments: error.missingDocuments
    });
  }
});

router.post('/regenerate/:employeeId', (req, res) => {
  try {
    const contract = ContractService.regenerate(
      req.params.employeeId,
      req.body,
      req.headers['x-user-id'] || 'system'
    );
    res.status(201).json(contract);
  } catch (error) {
    res.status(error.statusCode || 500).json({
      error: error.code || 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

router.post('/sign/:id', (req, res) => {
  try {
    const contract = ContractService.sign(
      req.params.id,
      req.headers['x-user-id'] || 'admin'
    );
    res.json(contract);
  } catch (error) {
    res.status(error.statusCode || 500).json({
      error: error.code || 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

router.get('/employee/:employeeId', (req, res) => {
  try {
    const contracts = ContractService.getEmployeeContracts(req.params.employeeId);
    res.json(contracts);
  } catch (error) {
    res.status(error.statusCode || 500).json({
      error: error.code || 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

router.get('/:id', (req, res) => {
  try {
    const contract = ContractService.getById(req.params.id);
    res.json(contract);
  } catch (error) {
    res.status(error.statusCode || 500).json({
      error: error.code || 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

module.exports = router;
