const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { response, errorResponse } = require('../utils');
const voucherService = require('../services/voucherService');
const idempotencyService = require('../services/idempotencyService');
const exportService = require('../services/exportService');

const generateKey = (type, data) => {
  const str = JSON.stringify(data);
  return `${type}:${crypto.createHash('md5').update(str).digest('hex')}`;
};

router.post('/', (req, res) => {
  const { driver_id, terminal_id, car_type, created_by } = req.body;

  if (!driver_id || !terminal_id || !car_type) {
    return errorResponse(res, '缺少必要参数: driver_id, terminal_id, car_type');
  }

  const idempotencyKey = req.headers['x-idempotency-key'] || 
    generateKey('create_voucher', { driver_id, terminal_id, car_type });

  const cached = idempotencyService.checkAndGet(idempotencyKey, 'create_voucher');
  if (cached) {
    return response(res, cached);
  }

  try {
    const voucher = voucherService.createVoucher(driver_id, terminal_id, car_type, created_by);
    idempotencyService.save(idempotencyKey, 'create_voucher', voucher);
    response(res, voucher, 201);
  } catch (err) {
    errorResponse(res, err.message);
  }
});

router.get('/', (req, res) => {
  try {
    const vouchers = voucherService.queryVouchers(req.query);
    response(res, vouchers);
  } catch (err) {
    errorResponse(res, err.message);
  }
});

router.get('/export', (req, res) => {
  try {
    const csv = exportService.exportVouchers(req.query);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=vouchers.csv');
    res.send('\ufeff' + csv);
  } catch (err) {
    errorResponse(res, err.message);
  }
});

router.get('/:id', (req, res) => {
  const voucher = voucherService.getVoucherById(req.params.id);
  if (!voucher) {
    return errorResponse(res, '排队券不存在', 404);
  }
  response(res, voucher);
});

router.post('/:id/advance', (req, res) => {
  const { id } = req.params;
  const idempotencyKey = req.headers['x-idempotency-key'] || 
    generateKey('advance', { voucher_id: id });

  const cached = idempotencyService.checkAndGet(idempotencyKey, 'advance');
  if (cached) {
    return response(res, cached);
  }

  try {
    const voucher = voucherService.advanceVoucher(id);
    idempotencyService.save(idempotencyKey, 'advance', voucher);
    response(res, voucher);
  } catch (err) {
    errorResponse(res, err.message);
  }
});

router.post('/:id/no-show', (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  const idempotencyKey = req.headers['x-idempotency-key'] || 
    generateKey('no_show', { voucher_id: id, reason });

  const cached = idempotencyService.checkAndGet(idempotencyKey, 'no_show');
  if (cached) {
    return response(res, cached);
  }

  try {
    const voucher = voucherService.recordNoShow(id, reason);
    idempotencyService.save(idempotencyKey, 'no_show', voucher);
    response(res, voucher);
  } catch (err) {
    errorResponse(res, err.message);
  }
});

router.post('/:id/revoke', (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  const idempotencyKey = req.headers['x-idempotency-key'] || 
    generateKey('revoke', { voucher_id: id, reason });

  const cached = idempotencyService.checkAndGet(idempotencyKey, 'revoke');
  if (cached) {
    return response(res, cached);
  }

  try {
    const voucher = voucherService.revokeVoucher(id, reason);
    idempotencyService.save(idempotencyKey, 'revoke', voucher);
    response(res, voucher);
  } catch (err) {
    errorResponse(res, err.message);
  }
});

router.put('/:id/correct', (req, res) => {
  const { id } = req.params;
  const { terminal_id, car_type } = req.body;

  const idempotencyKey = req.headers['x-idempotency-key'] || 
    generateKey('correct', { voucher_id: id, terminal_id, car_type });

  const cached = idempotencyService.checkAndGet(idempotencyKey, 'correct');
  if (cached) {
    return response(res, cached);
  }

  try {
    const voucher = voucherService.correctVoucher(id, { terminal_id, car_type });
    idempotencyService.save(idempotencyKey, 'correct', voucher);
    response(res, voucher);
  } catch (err) {
    errorResponse(res, err.message);
  }
});

module.exports = router;
