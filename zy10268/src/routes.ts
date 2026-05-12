import express from 'express';
import {
  createOrder,
  bindDevice,
  updateConstructionNode,
  confirmActivation,
  changeBandwidth,
  suspendBilling,
  resumeBilling,
  getOrderDetail,
  getAvailableDevices
} from './service';

const router = express.Router();

router.use(express.json());

router.post('/orders', async (req, res) => {
  const { orderNo, customerName, bandwidth, operator, requestId } = req.body;
  const result = await createOrder(orderNo, customerName, bandwidth, operator, requestId);
  res.status(result.success ? 200 : 400).json(result);
});

router.post('/orders/:orderId/bind-device', async (req, res) => {
  const { deviceId, operator, requestId } = req.body;
  const result = await bindDevice(req.params.orderId, deviceId, operator, requestId);
  res.status(result.success ? 200 : 400).json(result);
});

router.post('/orders/:orderId/construction-node', async (req, res) => {
  const { node, status, operator, requestId, remark } = req.body;
  const result = await updateConstructionNode(req.params.orderId, node, status, operator, requestId, remark);
  res.status(result.success ? 200 : 400).json(result);
});

router.post('/orders/:orderId/activate', async (req, res) => {
  const { operator, requestId } = req.body;
  const result = await confirmActivation(req.params.orderId, operator, requestId);
  res.status(result.success ? 200 : 400).json(result);
});

router.post('/orders/:orderId/change-bandwidth', async (req, res) => {
  const { newBandwidth, operator, requestId } = req.body;
  const result = await changeBandwidth(req.params.orderId, newBandwidth, operator, requestId);
  res.status(result.success ? 200 : 400).json(result);
});

router.post('/orders/:orderId/suspend', async (req, res) => {
  const { operator, requestId, reason } = req.body;
  const result = await suspendBilling(req.params.orderId, operator, requestId, reason);
  res.status(result.success ? 200 : 400).json(result);
});

router.post('/orders/:orderId/resume', async (req, res) => {
  const { operator, requestId } = req.body;
  const result = await resumeBilling(req.params.orderId, operator, requestId);
  res.status(result.success ? 200 : 400).json(result);
});

router.get('/orders/:orderId', async (req, res) => {
  const result = await getOrderDetail(req.params.orderId);
  res.status(result.success ? 200 : 404).json(result);
});

router.get('/devices/available', async (req, res) => {
  const result = await getAvailableDevices();
  res.status(200).json(result);
});

export default router;
