const express = require('express');
const router = express.Router();

const { 
  createBooking, 
  rescheduleBooking, 
  cancelBooking, 
  getBooking,
  getAvailableHalls,
  getAvailableWaiters
} = require('../services/booking-service');

const {
  OPERATION_TYPES,
  checkAndRecordOperation,
  updateOperationResult,
  markOperationFailed
} = require('../services/idempotency-service');

const { initSampleData } = require('../models');

initSampleData();

router.get('/available-halls', async (req, res) => {
  try {
    const { startTime, endTime } = req.query;
    
    if (!startTime || !endTime) {
      return res.status(400).json({
        error: '缺少必要参数：startTime 和 endTime'
      });
    }
    
    const availableHalls = getAvailableHalls(startTime, endTime);
    
    res.json({
      success: true,
      data: availableHalls
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/available-waiters', async (req, res) => {
  try {
    const { startTime, endTime } = req.query;
    
    if (!startTime || !endTime) {
      return res.status(400).json({
        error: '缺少必要参数：startTime 和 endTime'
      });
    }
    
    const availableWaiters = getAvailableWaiters(startTime, endTime);
    
    res.json({
      success: true,
      data: availableWaiters
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/create', async (req, res) => {
  const operationId = req.headers['x-operation-id'];
  
  if (!operationId) {
    return res.status(400).json({
      success: false,
      error: '缺少操作ID：请在请求头中提供 x-operation-id'
    });
  }
  
  try {
    const { isDuplicate, operation } = await checkAndRecordOperation(
      operationId,
      OPERATION_TYPES.CREATE_BOOKING,
      req.body
    );
    
    if (isDuplicate) {
      if (operation.status === 'success') {
        return res.json({
          success: true,
          data: operation.result,
          message: '重复操作，返回上次成功结果'
        });
      } else if (operation.status === 'processing') {
        return res.status(409).json({
          success: false,
          error: '操作正在处理中，请稍后再试'
        });
      } else if (operation.status === 'failed') {
        return res.status(400).json({
          success: false,
          error: `上次操作失败：${operation.error}`
        });
      }
    }
    
    const bookingData = req.body;
    const booking = await createBooking(bookingData, operationId);
    
    await updateOperationResult(operationId, booking);
    
    res.status(201).json({
      success: true,
      data: booking
    });
  } catch (error) {
    await markOperationFailed(operationId, error);
    
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/:bookingId/reschedule', async (req, res) => {
  const operationId = req.headers['x-operation-id'];
  const { bookingId } = req.params;
  
  if (!operationId) {
    return res.status(400).json({
      success: false,
      error: '缺少操作ID：请在请求头中提供 x-operation-id'
    });
  }
  
  try {
    const { isDuplicate, operation } = await checkAndRecordOperation(
      operationId,
      OPERATION_TYPES.RESCHEDULE_BOOKING,
      { bookingId, ...req.body }
    );
    
    if (isDuplicate) {
      if (operation.status === 'success') {
        return res.json({
          success: true,
          data: operation.result,
          message: '重复操作，返回上次成功结果'
        });
      } else if (operation.status === 'processing') {
        return res.status(409).json({
          success: false,
          error: '操作正在处理中，请稍后再试'
        });
      } else if (operation.status === 'failed') {
        return res.status(400).json({
          success: false,
          error: `上次操作失败：${operation.error}`
        });
      }
    }
    
    const { newStartTime, newEndTime } = req.body;
    const updatedBooking = await rescheduleBooking(bookingId, newStartTime, newEndTime, operationId);
    
    await updateOperationResult(operationId, updatedBooking);
    
    res.json({
      success: true,
      data: updatedBooking
    });
  } catch (error) {
    await markOperationFailed(operationId, error);
    
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/:bookingId/cancel', async (req, res) => {
  const operationId = req.headers['x-operation-id'];
  const { bookingId } = req.params;
  
  if (!operationId) {
    return res.status(400).json({
      success: false,
      error: '缺少操作ID：请在请求头中提供 x-operation-id'
    });
  }
  
  try {
    const { isDuplicate, operation } = await checkAndRecordOperation(
      operationId,
      OPERATION_TYPES.CANCEL_BOOKING,
      { bookingId }
    );
    
    if (isDuplicate) {
      if (operation.status === 'success') {
        return res.json({
          success: true,
          data: operation.result,
          message: '重复操作，返回上次成功结果'
        });
      } else if (operation.status === 'processing') {
        return res.status(409).json({
          success: false,
          error: '操作正在处理中，请稍后再试'
        });
      } else if (operation.status === 'failed') {
        return res.status(400).json({
          success: false,
          error: `上次操作失败：${operation.error}`
        });
      }
    }
    
    const cancelledBooking = await cancelBooking(bookingId, operationId);
    
    await updateOperationResult(operationId, cancelledBooking);
    
    res.json({
      success: true,
      data: cancelledBooking
    });
  } catch (error) {
    await markOperationFailed(operationId, error);
    
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/:bookingId', async (req, res) => {
  try {
    const { bookingId } = req.params;
    const booking = getBooking(bookingId);
    
    res.json({
      success: true,
      data: booking
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
