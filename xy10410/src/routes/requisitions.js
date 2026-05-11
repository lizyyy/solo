const express = require('express');
const router = express.Router();
const requisitionService = require('../services/requisitionService');

router.post('/', (req, res) => {
  try {
    const requisition = requisitionService.createRequisition(req.body);
    res.status(201).json({
      success: true,
      data: requisition
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.put('/:id', (req, res) => {
  try {
    const requisition = requisitionService.updateRequisition(req.params.id, req.body);
    res.json({
      success: true,
      data: requisition
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/:id/approve', (req, res) => {
  try {
    const requisition = requisitionService.approveRequisition(req.params.id, req.body);
    res.json({
      success: true,
      data: requisition
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/:id/issue', (req, res) => {
  try {
    const { issuedBy } = req.body;
    const requisition = requisitionService.issueRequisition(req.params.id, issuedBy);
    res.json({
      success: true,
      data: requisition
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/:id/consume', (req, res) => {
  try {
    const { consumedQuantity } = req.body;
    const requisition = requisitionService.consumeRequisition(req.params.id, consumedQuantity);
    res.json({
      success: true,
      data: requisition
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/:id/return', (req, res) => {
  try {
    const { returnRemark } = req.body;
    const requisition = requisitionService.returnRequisition(req.params.id, returnRemark);
    res.json({
      success: true,
      data: requisition
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/workorder/:workOrderId', (req, res) => {
  try {
    const requisitions = requisitionService.getRequisitionsByWorkOrder(req.params.workOrderId);
    res.json({
      success: true,
      data: requisitions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/:id', (req, res) => {
  try {
    const requisition = requisitionService.getRequisition(req.params.id);
    if (!requisition) {
      return res.status(404).json({
        success: false,
        error: '领用记录不存在'
      });
    }
    res.json({
      success: true,
      data: requisition
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
    const requisitions = requisitionService.getAllRequisitions();
    res.json({
      success: true,
      data: requisitions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
