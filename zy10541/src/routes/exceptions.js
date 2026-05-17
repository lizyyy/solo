const express = require('express');
const ContractService = require('../services/ContractService');

const router = express.Router();
const contractService = new ContractService();

router.get('/', (req, res) => {
  const exceptions = contractService.getAllExceptions();
  res.json({
    success: true,
    data: exceptions
  });
});

router.get('/:exceptionId', (req, res) => {
  const exceptions = contractService.getAllExceptions();
  const exception = exceptions.find(e => e.id === req.params.exceptionId);
  
  if (!exception) {
    return res.status(404).json({
      success: false,
      error: '异常记录不存在'
    });
  }
  
  res.json({
    success: true,
    data: exception
  });
});

router.post('/:exceptionId/resolve', (req, res) => {
  try {
    const { handler, note } = req.body;
    const exception = contractService.resolveException(
      req.params.exceptionId,
      handler,
      note
    );
    
    if (!exception) {
      return res.status(404).json({
        success: false,
        error: '异常记录不存在'
      });
    }
    
    res.json({
      success: true,
      data: exception
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;