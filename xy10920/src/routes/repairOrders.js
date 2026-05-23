const express = require('express');
const router = express.Router();
const repairOrderService = require('../services/repairOrderService');

router.post('/', async (req, res) => {
  try {
    const result = await repairOrderService.createOrder(req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    await repairOrderService.recordException(req.body, 'CREATE_ERROR', error.message);
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      isTimeout: req.query.isTimeout === 'true',
      buildingNo: req.query.buildingNo,
      repairType: req.query.repairType,
      isOutsourced: req.query.isOutsourced === 'true'
    };
    const orders = await repairOrderService.getOrders(filters);
    res.json({ success: true, data: orders });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const order = await repairOrderService.getOrderById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, error: '报修单不存在' });
    }
    res.json({ success: true, data: order });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/:id/history', async (req, res) => {
  try {
    const history = await repairOrderService.getStatusHistory(req.params.id);
    res.json({ success: true, data: history });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.put('/:id/status', async (req, res) => {
  try {
    const { newStatus, changeReason, changedBy } = req.body;
    const result = await repairOrderService.updateStatus(req.params.id, newStatus, changeReason, changedBy);
    res.json({ success: true, data: result });
  } catch (error) {
    await repairOrderService.recordException({ id: req.params.id, ...req.body }, 'STATUS_ERROR', error.message);
    res.status(400).json({ success: false, error: error.message });
  }
});

router.put('/:id/assign', async (req, res) => {
  try {
    const { handlerId } = req.body;
    const result = await repairOrderService.assignHandler(req.params.id, handlerId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:id/outsource', async (req, res) => {
  try {
    const result = await repairOrderService.assignOutsource(req.params.id, req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/:id/outsource', async (req, res) => {
  try {
    const info = await repairOrderService.getOutsourceInfo(req.params.id);
    res.json({ success: true, data: info });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.put('/:id/correct', async (req, res) => {
  try {
    const { updateData, correctedBy } = req.body;
    const result = await repairOrderService.manualCorrect(req.params.id, updateData, correctedBy);
    res.json({ success: true, data: result });
  } catch (error) {
    await repairOrderService.recordException({ id: req.params.id, ...req.body }, 'CORRECT_ERROR', error.message);
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:id/completion-proof', async (req, res) => {
  try {
    const result = await repairOrderService.submitCompletionProof(req.params.id, req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    await repairOrderService.recordException({ id: req.params.id, ...req.body }, 'PROOF_ERROR', error.message);
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/:id/completion-proof', async (req, res) => {
  try {
    const proofs = await repairOrderService.getCompletionProofs(req.params.id);
    res.json({ success: true, data: proofs });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:id/completion-proof/:proofId/verify', async (req, res) => {
  try {
    const { verifiedBy, isVerified, verifyRemark } = req.body;
    const result = await repairOrderService.verifyCompletion(
      req.params.id,
      req.params.proofId,
      verifiedBy,
      isVerified,
      verifyRemark
    );
    res.json({ success: true, data: result });
  } catch (error) {
    await repairOrderService.recordException({ id: req.params.id, proofId: req.params.proofId, ...req.body }, 'VERIFY_ERROR', error.message);
    res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;
