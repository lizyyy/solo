const express = require('express');
const { TicketService } = require('../services');
const { successHandler, asyncHandler } = require('../middleware/error');
const { ERROR_CODES, BusinessError } = require('../utils');

const router = express.Router();

router.get('/rules', asyncHandler(async (req, res) => {
  const rules = TicketService.getRefundRules();
  res.json(successHandler(rules, '获取退票规则成功'));
}));

router.get('/', asyncHandler(async (req, res) => {
  const { schedule_id } = req.query;
  
  if (schedule_id) {
    const tickets = TicketService.getBySchedule(schedule_id);
    res.json(successHandler(tickets, '获取班次票务列表成功'));
  } else {
    res.json(successHandler([], '请提供 schedule_id 参数'));
  }
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const ticket = TicketService.getById(id);
  
  if (!ticket) {
    throw new BusinessError(
      ERROR_CODES.TICKET_NOT_FOUND,
      `票务不存在：${id}`
    );
  }
  
  res.json(successHandler(ticket, '获取票务成功'));
}));

router.post('/', asyncHandler(async (req, res) => {
  const { schedule_id, passenger_name, passenger_phone, price } = req.body;
  
  const ticket = TicketService.create({
    scheduleId: schedule_id,
    passengerName: passenger_name,
    passengerPhone: passenger_phone,
    price
  });
  
  res.status(201).json(successHandler(ticket, '购票成功'));
}));

router.put('/:id/refundable', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const ticket = TicketService.enableRefund(id);
  res.json(successHandler(ticket, '开启退款通道成功'));
}));

router.post('/:id/refund', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { refund_amount } = req.body;
  
  const ticket = TicketService.processRefund(id, refund_amount);
  res.json(successHandler(ticket, '退票成功'));
}));

router.post('/:id/unlock', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { restore_status = 'PURCHASED' } = req.body;
  const ticket = TicketService.updateStatus(id, restore_status);
  res.json(successHandler(ticket, '解锁票务成功'));
}));

module.exports = router;
