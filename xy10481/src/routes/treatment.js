const express = require('express');
const router = express.Router();
const service = require('../services/treatmentService');
const moment = require('moment');

const handleError = (res, error) => {
  console.error(error);
  res.status(400).json({
    success: false,
    error: error.message || '操作失败'
  });
};

router.post('/purchase', (req, res) => {
  try {
    const { customerId, serviceId, packageName, count, unitPrice } = req.body;
    
    if (!customerId || !serviceId || !count || count <= 0) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数: customerId, serviceId, count'
      });
    }
    
    const result = service.purchasePackage(
      customerId,
      serviceId,
      packageName || '疗程包',
      count,
      unitPrice || 0
    );
    
    res.json(result);
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/gift', (req, res) => {
  try {
    const { customerId, serviceId, count, reason } = req.body;
    
    if (!customerId || !serviceId || !count || count <= 0) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数: customerId, serviceId, count'
      });
    }
    
    const result = service.giftSessions(customerId, serviceId, count, reason);
    res.json(result);
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/appointment', (req, res) => {
  try {
    const { customerId, serviceId, doctorId, scheduledAt, notes } = req.body;
    
    if (!customerId || !serviceId || !doctorId || !scheduledAt) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数: customerId, serviceId, doctorId, scheduledAt'
      });
    }
    
    const result = service.createAppointment(
      customerId,
      serviceId,
      doctorId,
      scheduledAt,
      notes
    );
    
    res.json(result);
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/consume', (req, res) => {
  try {
    const { appointmentId, doctorId } = req.body;
    
    if (!appointmentId) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数: appointmentId'
      });
    }
    
    const result = service.confirmConsumption(appointmentId, doctorId);
    res.json(result);
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/refund', (req, res) => {
  try {
    const { customerId, serviceId, count, reason } = req.body;
    
    if (!customerId || !serviceId || !count || count <= 0) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数: customerId, serviceId, count'
      });
    }
    
    const result = service.processRefund(customerId, serviceId, count, reason);
    res.json(result);
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/remaining/:customerId', (req, res) => {
  try {
    const { customerId } = req.params;
    const result = service.getCustomerRemaining(customerId);
    
    res.json({
      success: true,
      customerId,
      packages: result
    });
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/transactions', (req, res) => {
  try {
    const { customerId, transactionType, startDate, endDate, limit } = req.query;
    
    const start = startDate || moment().subtract(30, 'days').format('YYYY-MM-DD HH:mm:ss');
    const end = endDate || moment().format('YYYY-MM-DD HH:mm:ss');
    const limitNum = limit ? parseInt(limit) : 100;
    
    const result = service.getTransactionHistory(
      customerId,
      transactionType,
      start,
      end,
      limitNum
    );
    
    res.json({
      success: true,
      period: { startDate: start, endDate: end },
      total: result.length,
      transactions: result
    });
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/stats/doctor/:doctorId', (req, res) => {
  try {
    const { doctorId } = req.params;
    const { startDate, endDate } = req.query;
    
    const start = startDate || moment().startOf('month').format('YYYY-MM-DD HH:mm:ss');
    const end = endDate || moment().endOf('month').format('YYYY-MM-DD HH:mm:ss');
    
    const result = service.getDoctorPerformance(doctorId, start, end);
    res.json(result);
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/stats/refund-impact', (req, res) => {
  try {
    const { customerId, startDate, endDate } = req.query;
    
    const start = startDate || moment().startOf('month').format('YYYY-MM-DD HH:mm:ss');
    const end = endDate || moment().endOf('month').format('YYYY-MM-DD HH:mm:ss');
    
    const result = service.getRefundImpact(customerId, start, end);
    res.json(result);
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/stats/abnormal', (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const start = startDate || moment().subtract(7, 'days').format('YYYY-MM-DD HH:mm:ss');
    const end = endDate || moment().format('YYYY-MM-DD HH:mm:ss');
    
    const result = service.getAbnormalTransactions(start, end);
    
    res.json({
      success: true,
      period: { startDate: start, endDate: end },
      total: result.length,
      transactions: result
    });
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/services', (req, res) => {
  try {
    const { category } = req.query;
    const result = service.listServices(category);
    
    res.json({
      success: true,
      total: result.length,
      services: result
    });
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/doctors', (req, res) => {
  try {
    const result = service.listDoctors();
    
    res.json({
      success: true,
      total: result.length,
      doctors: result
    });
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/customers', (req, res) => {
  try {
    const result = service.listCustomers();
    
    res.json({
      success: true,
      total: result.length,
      customers: result
    });
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/reset', (req, res) => {
  try {
    const result = service.resetStore();
    res.json(result);
  } catch (error) {
    handleError(res, error);
  }
});

module.exports = router;
