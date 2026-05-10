const express = require('express');
const router = express.Router();
const reservationService = require('../services/reservationService');
const equipmentService = require('../services/equipmentService');
const historyService = require('../services/historyService');
const scheduleService = require('../services/scheduleService');

router.get('/', async (req, res) => {
  try {
    const { status, kitchen_id } = req.query;
    const reservations = await reservationService.getAllReservations({ status, kitchen_id });
    res.json(reservations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/teams', async (req, res) => {
  try {
    const teams = await scheduleService.getTeams();
    res.json(teams);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/teams', async (req, res) => {
  try {
    const { name, contact } = req.body;
    if (!name) {
      return res.status(400).json({ error: '团队名称不能为空' });
    }
    const id = await scheduleService.createTeam({ name, contact });
    res.json({ id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { kitchen_id, team_id, start_time, end_time } = req.body;
    if (!kitchen_id || !team_id || !start_time || !end_time) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    
    const id = await reservationService.createReservation({
      kitchen_id,
      team_id,
      start_time,
      end_time
    });
    res.json({ id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const reservation = await reservationService.getReservation(req.params.id);
    if (!reservation) {
      return res.status(404).json({ error: '预约记录不存在' });
    }
    
    const equipmentBookings = await equipmentService.getEquipmentBookingsByReservation(req.params.id);
    const history = await historyService.getHistory(historyService.entityTypes.RESERVATION, req.params.id);
    const blockPoints = reservationService.getBlockPoints(reservation);
    
    res.json({
      ...reservation,
      equipment_bookings: equipmentBookings,
      history,
      block_points: blockPoints
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/equipments', async (req, res) => {
  try {
    const { equipment_id, start_time, end_time } = req.body;
    if (!equipment_id || !start_time || !end_time) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    
    const id = await equipmentService.createEquipmentBooking({
      reservation_id: parseInt(req.params.id),
      equipment_id,
      start_time,
      end_time
    });
    res.json({ id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id/equipments/:equipmentBookingId', async (req, res) => {
  try {
    await equipmentService.cancelEquipmentBooking(req.params.equipmentBookingId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/submit', async (req, res) => {
  try {
    const result = await reservationService.submitReservation(req.params.id);
    res.json(result);
  } catch (err) {
    if (err.message.includes('重复提交')) {
      return res.status(409).json({ error: err.message });
    }
    if (err.message.includes('状态冲突')) {
      return res.status(400).json({ error: err.message });
    }
    if (err.message.includes('来源记录缺失')) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/approve', async (req, res) => {
  try {
    const { approver, comments } = req.body;
    const result = await reservationService.approveReservation(req.params.id, approver || 'admin', comments || '');
    res.json(result);
  } catch (err) {
    if (err.message.includes('状态冲突')) {
      return res.status(400).json({ error: err.message });
    }
    if (err.message.includes('来源记录缺失')) {
      return res.status(404).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/reject', async (req, res) => {
  try {
    const { approver, comments } = req.body;
    const result = await reservationService.rejectReservation(req.params.id, approver || 'admin', comments || '');
    res.json(result);
  } catch (err) {
    if (err.message.includes('状态冲突')) {
      return res.status(400).json({ error: err.message });
    }
    if (err.message.includes('来源记录缺失')) {
      return res.status(404).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/history', async (req, res) => {
  try {
    const history = await historyService.getHistory(historyService.entityTypes.RESERVATION, req.params.id);
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
