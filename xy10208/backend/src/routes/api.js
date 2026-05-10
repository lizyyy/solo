const express = require('express');
const router = express.Router();
const cabinetService = require('../services/cabinetService');

router.get('/cabinets', (req, res) => {
  const cabinets = cabinetService.getAllCabinets();
  res.json({ success: true, data: cabinets });
});

router.get('/cabinets/:id', (req, res) => {
  const cabinet = cabinetService.getCabinet(req.params.id);
  if (!cabinet) {
    return res.status(404).json({ success: false, error: '换电柜不存在', code: 'CABINET_NOT_FOUND' });
  }
  res.json({ success: true, data: cabinet });
});

router.post('/cabinets/:id/reservations', async (req, res) => {
  const { riderName, riderPhone, targetSlotNumber } = req.body;
  
  if (!riderName || !riderPhone) {
    return res.status(400).json({
      success: false,
      error: '请提供骑手姓名和手机号',
      code: 'MISSING_PARAMS'
    });
  }

  const result = await cabinetService.createReservation(
    req.params.id,
    riderName,
    riderPhone,
    targetSlotNumber
  );

  if (!result.success) {
    return res.status(400).json(result);
  }

  res.json(result);
});

router.get('/cabinets/:id/reservations', (req, res) => {
  const { status } = req.query;
  const reservations = cabinetService.getReservations(req.params.id, status);
  res.json({ success: true, data: reservations });
});

router.post('/cabinets/:id/reservations/:reservationId/cancel', async (req, res) => {
  const { reason } = req.body;
  const result = await cabinetService.cancelReservation(
    req.params.id,
    req.params.reservationId,
    reason
  );

  if (!result.success) {
    return res.status(400).json(result);
  }

  res.json(result);
});

router.post('/cabinets/:id/reservations/:reservationId/return', async (req, res) => {
  const { slotNumber, batteryCode } = req.body;
  
  if (!slotNumber || !batteryCode) {
    return res.status(400).json({
      success: false,
      error: '请提供槽位号和电池编号',
      code: 'MISSING_PARAMS'
    });
  }

  const result = await cabinetService.insertEmptyBattery(
    req.params.id,
    req.params.reservationId,
    parseInt(slotNumber),
    batteryCode
  );

  if (!result.success) {
    return res.status(400).json(result);
  }

  res.json(result);
});

router.post('/cabinets/:id/reservations/:reservationId/take', async (req, res) => {
  const { slotNumber } = req.body;
  
  if (!slotNumber) {
    return res.status(400).json({
      success: false,
      error: '请提供槽位号',
      code: 'MISSING_PARAMS'
    });
  }

  const result = await cabinetService.takeFullBattery(
    req.params.id,
    req.params.reservationId,
    parseInt(slotNumber)
  );

  if (!result.success) {
    return res.status(400).json(result);
  }

  res.json(result);
});

router.post('/cabinets/:id/reservations/:reservationId/review', async (req, res) => {
  const { action, operator } = req.body;
  
  if (!action || (action !== 'approve' && action !== 'reject')) {
    return res.status(400).json({
      success: false,
      error: '请提供有效的操作类型（approve 或 reject）',
      code: 'MISSING_PARAMS'
    });
  }

  const result = await cabinetService.reviewReservation(
    req.params.id,
    req.params.reservationId,
    action,
    operator || 'operator'
  );

  if (!result.success) {
    return res.status(400).json(result);
  }

  res.json(result);
});

router.get('/cabinets/:id/history', (req, res) => {
  const { slotNumber } = req.query;
  const history = cabinetService.getHistory(
    req.params.id,
    slotNumber ? parseInt(slotNumber) : null
  );
  res.json({ success: true, data: history });
});

router.get('/cabinets/:id/report', (req, res) => {
  const { startDate, endDate } = req.query;
  const report = cabinetService.generateReport(req.params.id, startDate, endDate);
  
  if (!report) {
    return res.status(404).json({ success: false, error: '换电柜不存在', code: 'CABINET_NOT_FOUND' });
  }
  
  res.json({ success: true, data: report });
});

router.post('/cabinets/:id/slots/:slotNumber/fault', async (req, res) => {
  const { reason, operator } = req.body;
  
  if (!reason) {
    return res.status(400).json({
      success: false,
      error: '请提供故障原因',
      code: 'MISSING_PARAMS'
    });
  }

  const result = await cabinetService.markSlotFault(
    req.params.id,
    parseInt(req.params.slotNumber),
    reason,
    operator || 'operator'
  );

  if (!result.success) {
    return res.status(400).json(result);
  }

  res.json(result);
});

router.delete('/cabinets/:id/slots/:slotNumber/fault', async (req, res) => {
  const { operator } = req.body;
  const result = await cabinetService.releaseSlotFault(
    req.params.id,
    parseInt(req.params.slotNumber),
    operator || 'operator'
  );

  if (!result.success) {
    return res.status(400).json(result);
  }

  res.json(result);
});

router.post('/timeout-check', async (req, res) => {
  const { cabinetId } = req.body;
  
  if (!cabinetId) {
    return res.status(400).json({
      success: false,
      error: '请提供换电柜ID',
      code: 'MISSING_PARAMS'
    });
  }

  const expired = await cabinetService.checkTimeout(cabinetId);
  res.json({ success: true, data: { expired } });
});

router.post('/demo/reset', async (req, res) => {
  const result = await cabinetService.resetForDemo();
  res.json(result);
});

router.post('/demo/load', async (req, res) => {
  const { scenario } = req.body;
  const result = await cabinetService.loadDemoData(scenario || 'normal');
  res.json(result);
});

module.exports = router;