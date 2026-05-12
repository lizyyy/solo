const express = require('express');
const router = express.Router();

const parkingSpotService = require('./services/parkingSpotService');
const orderService = require('./services/orderService');
const settlementService = require('./services/settlementService');
const queryService = require('./services/queryService');

function jsonResponse(res, data) {
  res.json({ success: true, data });
}

function jsonError(res, error, status = 400) {
  res.status(status).json({ success: false, error: error.message });
}

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

router.post('/parking-spots', asyncHandler(async (req, res) => {
  const spot = await parkingSpotService.createParkingSpot(req.body);
  jsonResponse(res, spot);
}));

router.get('/parking-spots', asyncHandler(async (req, res) => {
  const spots = await parkingSpotService.listParkingSpots(req.query.status);
  jsonResponse(res, spots);
}));

router.get('/parking-spots/:id', asyncHandler(async (req, res) => {
  const spot = await parkingSpotService.getParkingSpotById(req.params.id);
  if (!spot) {
    return jsonError(res, new Error('车位不存在'), 404);
  }
  jsonResponse(res, spot);
}));

router.put('/parking-spots/:id', asyncHandler(async (req, res) => {
  const spot = await parkingSpotService.updateParkingSpot(req.params.id, req.body);
  jsonResponse(res, spot);
}));

router.get('/parking-spots/:id/availability', asyncHandler(async (req, res) => {
  const { startTime, endTime } = req.query;
  const availability = await queryService.getSpotAvailability(
    req.params.id,
    parseInt(startTime),
    parseInt(endTime)
  );
  jsonResponse(res, availability);
}));

router.post('/orders', asyncHandler(async (req, res) => {
  const order = await orderService.createOrder(req.body);
  jsonResponse(res, order);
}));

router.get('/orders', asyncHandler(async (req, res) => {
  const orders = await orderService.listOrders(req.query);
  jsonResponse(res, orders);
}));

router.get('/orders/:id', asyncHandler(async (req, res) => {
  const order = await orderService.getOrderById(req.params.id);
  if (!order) {
    return jsonError(res, new Error('订单不存在'), 404);
  }
  jsonResponse(res, order);
}));

router.get('/orders/:id/timeline', asyncHandler(async (req, res) => {
  const timeline = await queryService.getOrderTimeline(req.params.id);
  jsonResponse(res, timeline);
}));

router.post('/orders/:id/pay', asyncHandler(async (req, res) => {
  const order = await orderService.payOrder(req.params.id, req.body);
  jsonResponse(res, order);
}));

router.post('/orders/:id/authorize', asyncHandler(async (req, res) => {
  const result = await orderService.authorizeOrder(
    req.params.id,
    req.body.operatorId,
    req.body.operatorName
  );
  jsonResponse(res, result);
}));

router.post('/orders/:id/cancel', asyncHandler(async (req, res) => {
  const order = await orderService.cancelOrder(
    req.params.id,
    req.body.operatorId,
    req.body.operatorName
  );
  jsonResponse(res, order);
}));

router.post('/orders/:id/refund', asyncHandler(async (req, res) => {
  const order = await orderService.refundOrder(req.params.id, req.body);
  jsonResponse(res, order);
}));

router.get('/authorizations', asyncHandler(async (req, res) => {
  const authorizations = await orderService.listAuthorizations(req.query.status);
  jsonResponse(res, authorizations);
}));

router.get('/authorizations/current', asyncHandler(async (req, res) => {
  const authorizations = await queryService.getCurrentAuthorizations();
  jsonResponse(res, authorizations);
}));

router.post('/settlements', asyncHandler(async (req, res) => {
  const settlement = await settlementService.createSettlement(
    req.body.orderId,
    req.body.operatorId,
    req.body.operatorName
  );
  jsonResponse(res, settlement);
}));

router.get('/settlements', asyncHandler(async (req, res) => {
  const settlements = await settlementService.listSettlements(req.query);
  jsonResponse(res, settlements);
}));

router.post('/settlements/:id/settle', asyncHandler(async (req, res) => {
  const settlement = await settlementService.settlePayment(
    req.params.id,
    req.body.operatorId,
    req.body.operatorName
  );
  jsonResponse(res, settlement);
}));

router.get('/owners/:id/summary', asyncHandler(async (req, res) => {
  const summary = await settlementService.getOwnerSummary(req.params.id);
  jsonResponse(res, summary);
}));

router.get('/dashboard/stats', asyncHandler(async (req, res) => {
  const stats = await queryService.getDashboardStats();
  jsonResponse(res, stats);
}));

router.get('/logs', asyncHandler(async (req, res) => {
  const logs = await queryService.getOperationLogs(req.query.orderId, parseInt(req.query.limit) || 50);
  jsonResponse(res, logs);
}));

router.get('/search/license-plate/:plate', asyncHandler(async (req, res) => {
  const orders = await queryService.searchOrdersByLicensePlate(req.params.plate);
  jsonResponse(res, orders);
}));

router.use((err, req, res, next) => {
  jsonError(res, err, 500);
});

module.exports = router;
