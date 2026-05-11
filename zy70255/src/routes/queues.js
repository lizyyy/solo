const express = require('express');
const router = express.Router();
const { response, errorResponse } = require('../utils');
const voucherService = require('../services/voucherService');
const exportService = require('../services/exportService');

router.get('/', (req, res) => {
  const { terminal_id, car_type, include_history } = req.query;

  if (!terminal_id || !car_type) {
    return errorResponse(res, '缺少必要参数: terminal_id, car_type');
  }

  try {
    const queue = voucherService.getQueueForTerminal(
      terminal_id, 
      car_type, 
      include_history === 'true'
    );
    response(res, queue);
  } catch (err) {
    errorResponse(res, err.message);
  }
});

router.get('/export', (req, res) => {
  const { terminal_id, car_type } = req.query;

  if (!terminal_id || !car_type) {
    return errorResponse(res, '缺少必要参数: terminal_id, car_type');
  }

  try {
    const csv = exportService.exportQueueForTerminal(terminal_id, car_type);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition', 
      `attachment; filename=queue_${terminal_id}_${car_type}.csv`
    );
    res.send('\ufeff' + csv);
  } catch (err) {
    errorResponse(res, err.message);
  }
});

router.get('/stats', (req, res) => {
  const { terminal_id, from_time, to_time } = req.query;

  try {
    const stats = voucherService.getStatistics(
      terminal_id,
      from_time ? parseInt(from_time) : null,
      to_time ? parseInt(to_time) : null
    );
    response(res, stats);
  } catch (err) {
    errorResponse(res, err.message);
  }
});

module.exports = router;
