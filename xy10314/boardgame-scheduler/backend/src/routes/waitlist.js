const express = require('express');
const WaitlistModel = require('../models/WaitlistModel');
const ReservationService = require('../services/ReservationService');

const router = express.Router();

router.get('/', async (req, res) => {
  const { date } = req.query;
  const waitlist = date ? await WaitlistModel.getByDate(date) : await WaitlistModel.getAll();
  res.json({ success: true, data: waitlist });
});

router.get('/:id', async (req, res) => {
  const item = await WaitlistModel.getById(req.params.id);
  if (!item) {
    return res.status(404).json({ success: false, errors: ['候补记录不存在'] });
  }
  res.json({ success: true, data: item });
});

router.post('/', async (req, res) => {
  const { idempotency_key, ...data } = req.body;
  const result = await ReservationService.addToWaitlist(data, idempotency_key, 'operator');

  if (result.idempotent) {
    return res.status(200).json({
      success: true,
      idempotent: true,
      message: result.message,
      data: result.waitlist
    });
  }

  if (!result.success) {
    return res.status(400).json({
      success: false,
      errors: result.errors
    });
  }

  res.status(201).json({
    success: true,
    data: result.waitlist
  });
});

router.post('/:id/convert', async (req, res) => {
  const { idempotency_key, ...data } = req.body;
  const result = await ReservationService.convertWaitlistToReservation(
    req.params.id, data, idempotency_key, 'operator'
  );

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

router.delete('/:id', async (req, res) => {
  await WaitlistModel.delete(req.params.id);
  res.json({ success: true });
});

module.exports = router;
