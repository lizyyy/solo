const express = require('express');
const router = express.Router();
const executionReceiptService = require('../services/executionReceiptService');
const store = require('../data/store');

router.post('/', (req, res) => {
  const requestId = req.headers['x-request-id'];
  
  if (requestId) {
    const idempotentResponse = store.checkIdempotency(requestId);
    if (idempotentResponse) {
      return res.status(idempotentResponse.status).json(idempotentResponse.body);
    }
  }

  try {
    if (!req.body.petId) {
      throw new Error('缺少必填字段：宠物ID');
    }
    if (!req.body.planId) {
      throw new Error('缺少必填字段：喂药计划ID');
    }

    const receipt = executionReceiptService.createExecutionReceipt(req.body);
    
    const response = {
      status: 201,
      body: {
        message: '执行回执创建成功',
        receipt
      }
    };

    if (requestId) {
      store.recordIdempotency(requestId, response);
    }

    res.status(201).json(response.body);
  } catch (error) {
    const response = {
      status: 400,
      body: {
        error: '创建执行回执失败',
        message: error.message
      }
    };

    if (requestId) {
      store.recordIdempotency(requestId, response);
    }

    res.status(400).json(response.body);
  }
});

router.get('/:receiptId', (req, res) => {
  try {
    const receipt = executionReceiptService.getExecutionReceiptById(req.params.receiptId);
    if (!receipt) {
      return res.status(404).json({
        error: '未找到执行回执',
        message: `找不到 ID 为 "${req.params.receiptId}" 的执行回执`
      });
    }
    res.json(receipt);
  } catch (error) {
    res.status(400).json({
      error: '查询执行回执失败',
      message: error.message
    });
  }
});

router.get('/plan/:planId', (req, res) => {
  try {
    const receipts = executionReceiptService.getExecutionReceiptsByPlanId(req.params.planId);
    res.json({
      count: receipts.length,
      receipts
    });
  } catch (error) {
    res.status(400).json({
      error: '查询喂药计划执行回执失败',
      message: error.message
    });
  }
});

router.get('/pet/:petId', (req, res) => {
  try {
    const receipts = executionReceiptService.getExecutionReceiptsByPetId(req.params.petId);
    res.json({
      count: receipts.length,
      receipts
    });
  } catch (error) {
    res.status(400).json({
      error: '查询宠物执行回执失败',
      message: error.message
    });
  }
});

router.post('/:receiptId/correct', (req, res) => {
  const requestId = req.headers['x-request-id'];
  
  if (requestId) {
    const idempotentResponse = store.checkIdempotency(requestId);
    if (idempotentResponse) {
      return res.status(idempotentResponse.status).json(idempotentResponse.body);
    }
  }

  try {
    if (!req.body.correctedBy) {
      throw new Error('缺少必填字段：修正人');
    }
    if (!req.body.reason) {
      throw new Error('缺少必填字段：修正原因');
    }

    const receipt = executionReceiptService.correctExecutionReceipt(req.params.receiptId, req.body);
    
    const response = {
      status: 200,
      body: {
        message: '执行回执修正成功',
        receipt
      }
    };

    if (requestId) {
      store.recordIdempotency(requestId, response);
    }

    res.json(response.body);
  } catch (error) {
    const response = {
      status: 400,
      body: {
        error: '修正执行回执失败',
        message: error.message
      }
    };

    if (requestId) {
      store.recordIdempotency(requestId, response);
    }

    res.status(400).json(response.body);
  }
});

module.exports = router;
