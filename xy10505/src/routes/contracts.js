const express = require('express');
const router = express.Router();
const contractService = require('../services/contractService');
const { buildSuccessResponse, buildErrorResponse } = require('../utils');

router.post('/', (req, res) => {
  try {
    const contract = contractService.createContract(req.body);
    res.json(buildSuccessResponse(contract, '合同创建成功'));
  } catch (err) {
    res.status(400).json(buildErrorResponse(err.message, 400));
  }
});

router.get('/:id', (req, res) => {
  try {
    const contract = contractService.getContractById(req.params.id);
    if (!contract) {
      return res.status(404).json(buildErrorResponse('合同不存在', 404));
    }
    res.json(buildSuccessResponse(contract, '查询成功'));
  } catch (err) {
    res.status(400).json(buildErrorResponse(err.message, 400));
  }
});

router.get('/', (req, res) => {
  try {
    const { category, partyA, partyB, limit = 100, offset = 0 } = req.query;
    const filters = {};
    if (category) filters.category = category;
    if (partyA) filters.partyA = partyA;
    if (partyB) filters.partyB = partyB;
    
    const contracts = contractService.getContracts(
      filters, 
      parseInt(limit), 
      parseInt(offset)
    );
    res.json(buildSuccessResponse(contracts, '查询成功'));
  } catch (err) {
    res.status(400).json(buildErrorResponse(err.message, 400));
  }
});

router.put('/:id', (req, res) => {
  try {
    const { operator } = req.body;
    if (!operator) {
      return res.status(400).json(buildErrorResponse('必须提供操作人', 400));
    }
    const contract = contractService.updateContract(req.params.id, req.body, operator);
    res.json(buildSuccessResponse(contract, '合同更新成功'));
  } catch (err) {
    res.status(400).json(buildErrorResponse(err.message, 400));
  }
});

module.exports = router;
