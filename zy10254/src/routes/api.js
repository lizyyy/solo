const express = require('express');
const router = express.Router();
const {
  createRescueOrder,
  matchTechnician,
  technicianDepart,
  technicianArrive,
  completeRescue
} = require('../services/rescueService');
const {
  cancelRescueOrder,
  reassignTechnician,
  getOrderById,
  getOrdersByVehicle,
  getAllTechnicians,
  getMembership,
  getAllOrders
} = require('../services/orderService');

router.post('/rescue/create', (req, res) => {
  try {
    const result = createRescueOrder(req.body);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

router.get('/rescue/:orderId', (req, res) => {
  try {
    const order = getOrderById(req.params.orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: '工单不存在'
      });
    }
    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

router.get('/rescue/vehicle/:vehiclePlate', (req, res) => {
  try {
    const orders = getOrdersByVehicle(req.params.vehiclePlate);
    res.json({
      success: true,
      data: orders
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

router.get('/rescue', (req, res) => {
  try {
    const orders = getAllOrders(req.query.status);
    res.json({
      success: true,
      data: orders
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

router.post('/rescue/:orderId/match', (req, res) => {
  try {
    const result = matchTechnician(req.params.orderId);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

router.post('/rescue/:orderId/depart', (req, res) => {
  try {
    const { technicianId } = req.body;
    const result = technicianDepart(req.params.orderId, technicianId);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

router.post('/rescue/:orderId/arrive', (req, res) => {
  try {
    const { technicianId } = req.body;
    const result = technicianArrive(req.params.orderId, technicianId);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

router.post('/rescue/:orderId/complete', (req, res) => {
  try {
    const { technicianId, actualCost, remark } = req.body;
    const result = completeRescue(req.params.orderId, technicianId, actualCost, remark);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

router.post('/rescue/:orderId/cancel', (req, res) => {
  try {
    const { reason, operatorId } = req.body;
    const result = cancelRescueOrder(req.params.orderId, reason, operatorId);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

router.post('/rescue/:orderId/reassign', (req, res) => {
  try {
    const { reason, operatorId } = req.body;
    const result = reassignTechnician(req.params.orderId, reason, operatorId);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

router.get('/technicians', (req, res) => {
  try {
    const technicians = getAllTechnicians();
    res.json({
      success: true,
      data: technicians
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

router.get('/membership/:membershipId', (req, res) => {
  try {
    const membership = getMembership(req.params.membershipId);
    if (!membership) {
      return res.status(404).json({
        success: false,
        message: '会员不存在'
      });
    }
    res.json({
      success: true,
      data: membership
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;