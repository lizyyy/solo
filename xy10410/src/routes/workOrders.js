const express = require('express');
const router = express.Router();
const workOrderService = require('../services/workOrderService');

router.post('/', (req, res) => {
  try {
    const workOrder = workOrderService.createWorkOrder(req.body);
    res.status(201).json({
      success: true,
      data: workOrder
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/:id/assign', (req, res) => {
  try {
    const { staffId } = req.body;
    const workOrder = workOrderService.assignWorkOrder(req.params.id, staffId);
    res.json({
      success: true,
      data: workOrder
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/:id/complete', (req, res) => {
  try {
    const { remarks } = req.body;
    const workOrder = workOrderService.completeWorkOrder(req.params.id, remarks);
    res.json({
      success: true,
      data: workOrder
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/:id', (req, res) => {
  try {
    const workOrder = workOrderService.getWorkOrder(req.params.id);
    if (!workOrder) {
      return res.status(404).json({
        success: false,
        error: '工单不存在'
      });
    }
    res.json({
      success: true,
      data: workOrder
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/', (req, res) => {
  try {
    const workOrders = workOrderService.getAllWorkOrders();
    res.json({
      success: true,
      data: workOrders
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
