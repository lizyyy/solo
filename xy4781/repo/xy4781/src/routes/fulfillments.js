const express = require('express');
const router = express.Router();
const fulfillmentService = require('../services/fulfillmentService');
const idempotencyService = require('../services/idempotencyService');

router.get('/', (req, res) => {
  try {
    const fulfillments = fulfillmentService.listFulfillments();
    res.json({
      success: true,
      data: fulfillments
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        message: error.message,
        code: error.code || 'INTERNAL_ERROR'
      }
    });
  }
});

router.get('/payments', (req, res) => {
  try {
    const payments = fulfillmentService.listPayments();
    res.json({
      success: true,
      data: payments
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        message: error.message,
        code: error.code || 'INTERNAL_ERROR'
      }
    });
  }
});

router.get('/:idOrNo', (req, res) => {
  try {
    const { idOrNo } = req.params;
    const fulfillment = fulfillmentService.getFulfillment(idOrNo);
    
    if (!fulfillment) {
      return res.status(404).json({
        success: false,
        error: {
          message: '核销单不存在',
          code: 'FULFILLMENT_NOT_FOUND'
        }
      });
    }

    res.json({
      success: true,
      data: fulfillment
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        message: error.message,
        code: error.code || 'INTERNAL_ERROR'
      }
    });
  }
});

router.post('/fulfill', async (req, res) => {
  try {
    const idempotencyKey = req.headers['x-idempotency-key'];
    const { prescriptionNo, pharmacistName } = req.body;
    const operator = req.headers['x-operator'] || 'anonymous';
    const requestIp = req.ip || req.connection.remoteAddress;

    if (!idempotencyKey) {
      return res.status(400).json({
        success: false,
        error: {
          message: '幂等键不能为空，请在请求头中提供 X-Idempotency-Key',
          code: 'MISSING_IDEMPOTENCY_KEY'
        }
      });
    }

    if (!prescriptionNo) {
      return res.status(400).json({
        success: false,
        error: {
          message: '处方编号不能为空',
          code: 'MISSING_PRESCRIPTION_NO'
        }
      });
    }

    if (!pharmacistName) {
      return res.status(400).json({
        success: false,
        error: {
          message: '药师姓名不能为空',
          code: 'MISSING_PHARMACIST_NAME'
        }
      });
    }

    const result = await idempotencyService.executeWithIdempotency(
      idempotencyKey,
      'FULFILL_PRESCRIPTION',
      async (ctx) => {
        return fulfillmentService.fulfillPrescription(
          { prescriptionNo, pharmacistName },
          operator,
          requestIp
        );
      }
    );

    if (result.isDuplicate) {
      return res.json({
        success: true,
        data: result.data,
        message: '重复请求，返回首次执行结果',
        isDuplicate: true
      });
    }

    res.status(201).json({
      success: true,
      data: result.data,
      message: '处方核销成功',
      isDuplicate: false
    });
  } catch (error) {
    if (error.name === 'IdempotencyError') {
      return res.status(409).json({
        success: false,
        error: {
          message: error.message,
          code: error.code
        }
      });
    }

    if (error.name === 'FulfillmentError') {
      return res.status(400).json({
        success: false,
        error: {
          message: error.message,
          code: error.code
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        message: error.message,
        code: error.code || 'INTERNAL_ERROR'
      }
    });
  }
});

router.post('/cancel', async (req, res) => {
  try {
    const idempotencyKey = req.headers['x-idempotency-key'];
    const { fulfillmentNo, reason } = req.body;
    const operator = req.headers['x-operator'] || 'anonymous';
    const requestIp = req.ip || req.connection.remoteAddress;

    if (!idempotencyKey) {
      return res.status(400).json({
        success: false,
        error: {
          message: '幂等键不能为空，请在请求头中提供 X-Idempotency-Key',
          code: 'MISSING_IDEMPOTENCY_KEY'
        }
      });
    }

    if (!fulfillmentNo) {
      return res.status(400).json({
        success: false,
        error: {
          message: '核销单编号不能为空',
          code: 'MISSING_FULFILLMENT_NO'
        }
      });
    }

    const result = await idempotencyService.executeWithIdempotency(
      idempotencyKey,
      'CANCEL_FULFILLMENT',
      async (ctx) => {
        return fulfillmentService.cancelFulfillment(
          { fulfillmentNo, reason },
          operator,
          requestIp
        );
      }
    );

    if (result.isDuplicate) {
      return res.json({
        success: true,
        data: result.data,
        message: '重复请求，返回首次执行结果',
        isDuplicate: true
      });
    }

    res.json({
      success: true,
      data: result.data,
      message: '核销单撤销成功',
      isDuplicate: false
    });
  } catch (error) {
    if (error.name === 'IdempotencyError') {
      return res.status(409).json({
        success: false,
        error: {
          message: error.message,
          code: error.code
        }
      });
    }

    if (error.name === 'FulfillmentError') {
      return res.status(400).json({
        success: false,
        error: {
          message: error.message,
          code: error.code
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        message: error.message,
        code: error.code || 'INTERNAL_ERROR'
      }
    });
  }
});

router.get('/idempotency/:key', (req, res) => {
  try {
    const { key } = req.params;
    const result = idempotencyService.checkIdempotency(key);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        message: error.message,
        code: error.code || 'INTERNAL_ERROR'
      }
    });
  }
});

module.exports = router;
