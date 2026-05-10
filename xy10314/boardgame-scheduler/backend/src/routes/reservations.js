const express = require('express');
const ReservationModel = require('../models/ReservationModel');
const ReservationService = require('../services/ReservationService');
const XLSX = require('xlsx');

const router = express.Router();

router.get('/', async (req, res) => {
  const { date } = req.query;
  if (!date) {
    return res.status(400).json({ success: false, errors: ['请提供日期参数'] });
  }
  const reservations = await ReservationModel.getByDate(date);
  res.json({ success: true, data: reservations });
});

router.get('/:id', async (req, res) => {
  const reservation = await ReservationModel.getById(req.params.id);
  if (!reservation) {
    return res.status(404).json({ success: false, errors: ['预约不存在'] });
  }
  res.json({ success: true, data: reservation });
});

router.get('/:id/history', async (req, res) => {
  const history = await ReservationModel.getHistory(req.params.id);
  res.json({ success: true, data: history });
});

router.post('/validate', async (req, res) => {
  const validation = await ReservationService.validateReservation(req.body);
  res.json({
    success: validation.valid,
    errors: validation.errors,
    conflicts: validation.conflicts
  });
});

router.post('/', async (req, res) => {
  const { idempotency_key, ...data } = req.body;
  const result = await ReservationService.createReservation(data, idempotency_key, 'operator');

  if (result.idempotent) {
    return res.status(200).json({
      success: true,
      idempotent: true,
      message: result.message,
      data: result.reservation
    });
  }

  if (!result.success) {
    return res.status(400).json({
      success: false,
      errors: result.errors,
      conflicts: result.conflicts
    });
  }

  res.status(201).json({
    success: true,
    data: result.reservation
  });
});

router.put('/:id', async (req, res) => {
  const result = await ReservationService.updateReservation(req.params.id, req.body, 'operator');

  if (!result.success) {
    return res.status(400).json({
      success: false,
      errors: result.errors,
      conflicts: result.conflicts
    });
  }

  res.json({
    success: true,
    data: result.reservation,
    changes: result.changes
  });
});

router.post('/:id/cancel', async (req, res) => {
  const result = await ReservationService.cancelReservation(req.params.id, 'operator');
  if (!result.success) {
    return res.status(400).json({ success: false, errors: result.errors });
  }
  res.json({ success: true, data: result.reservation });
});

router.get('/stats/revenue', async (req, res) => {
  const { start_date, end_date } = req.query;
  const stats = await ReservationModel.getRevenueStats(start_date, end_date);
  res.json({ success: true, data: stats });
});

router.get('/export/daily', async (req, res) => {
  const { date } = req.query;
  if (!date) {
    return res.status(400).json({ success: false, errors: ['请提供日期参数'] });
  }

  const schedule = await ReservationModel.getDailySchedule(date);
  
  const exportData = schedule.map(r => ({
    '桌位': r.table_name,
    '剧本': r.script_name,
    '主持人': r.host_name || '未安排',
    '顾客': r.customer_name,
    '联系方式': r.customer_phone,
    '类型': r.reservation_type === 'private' ? '包场' : '拼桌',
    '人数': r.player_count,
    '开始时间': r.start_time,
    '预计结束时间': r.end_time,
    '金额': r.total_amount,
    '状态': r.status === 'confirmed' ? '已确认' : r.status === 'cancelled' ? '已取消' : '待确认',
    '备注': r.notes || ''
  }));

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(exportData);
  
  const colWidths = [
    { wch: 10 }, { wch: 20 }, { wch: 10 }, { wch: 12 }, { wch: 15 },
    { wch: 8 }, { wch: 6 }, { wch: 10 }, { wch: 12 }, { wch: 10 },
    { wch: 10 }, { wch: 20 }
  ];
  worksheet['!cols'] = colWidths;
  
  XLSX.utils.book_append_sheet(workbook, worksheet, `当天安排_${date}`);

  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=schedule_${date}.xlsx`);
  res.send(buffer);
});

module.exports = router;
