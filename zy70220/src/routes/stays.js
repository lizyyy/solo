const express = require('express');
const router = express.Router();
const stayService = require('../services/stayService');
const { getHistoryByEntity } = require('../utils/history');
const { handleError } = require('../utils/errors');

router.get('/', (req, res) => {
  try {
    const stays = stayService.getAllActiveStays();
    res.json({
      success: true,
      data: stays
    });
  } catch (err) {
    handleError(err, res);
  }
});

router.post('/checkin', (req, res) => {
  try {
    const { room_number, guest_count, check_in_time, operator } = req.body;
    const result = stayService.checkIn(
      room_number,
      guest_count,
      check_in_time,
      operator
    );
    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    handleError(err, res);
  }
});

router.get('/:stayId', (req, res) => {
  try {
    const stay = stayService.getStayWithUsage(req.params.stayId);
    res.json({
      success: true,
      data: stay
    });
  } catch (err) {
    handleError(err, res);
  }
});

router.post('/:stayId/checkout', (req, res) => {
  try {
    const { check_out_time, operator } = req.body;
    const result = stayService.checkOut(
      req.params.stayId,
      check_out_time,
      operator
    );
    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    handleError(err, res);
  }
});

router.patch('/:stayId', (req, res) => {
  try {
    const { operator } = req.body;
    const updates = { ...req.body };
    delete updates.operator;
    
    const result = stayService.updateStay(
      req.params.stayId,
      updates,
      operator
    );
    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    handleError(err, res);
  }
});

router.post('/:stayId/cancel', (req, res) => {
  try {
    const { reason, operator } = req.body;
    const result = stayService.cancelCheckIn(
      req.params.stayId,
      reason,
      operator
    );
    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    handleError(err, res);
  }
});

router.get('/:stayId/history', (req, res) => {
  try {
    const history = getHistoryByEntity('room_stay', req.params.stayId);
    res.json({
      success: true,
      data: history
    });
  } catch (err) {
    handleError(err, res);
  }
});

module.exports = router;
