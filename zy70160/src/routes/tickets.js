const express = require('express');
const router = express.Router();
const TicketService = require('../services/ticketService');
const { SLAService, PAUSE_REASONS } = require('../services/slaService');

// 创建工单
router.post('/', async (req, res) => {
  try {
    const result = await TicketService.createTicket(req.body);
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 获取所有工单
router.get('/', async (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      priority: req.query.priority,
      customerId: req.query.customerId
    };
    const tickets = await TicketService.getAllTickets(filters);
    res.json(tickets);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取工单详情
router.get('/:id', async (req, res) => {
  try {
    const ticket = await TicketService.getTicket(req.params.id);
    res.json(ticket);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

// 暂停 SLA
router.post('/:id/pause', async (req, res) => {
  try {
    const { reason, pausedBy, notes } = req.body;
    
    if (!reason) {
      return res.status(400).json({ error: '暂停原因不能为空' });
    }
    
    if (!Object.values(PAUSE_REASONS).includes(reason)) {
      return res.status(400).json({ 
        error: '无效的暂停原因', 
        validReasons: Object.values(PAUSE_REASONS) 
      });
    }

    const result = await SLAService.pauseSLA(req.params.id, reason, pausedBy, notes);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 恢复 SLA
router.post('/:id/resume', async (req, res) => {
  try {
    const { resumedBy, notes } = req.body;
    const result = await SLAService.resumeSLA(req.params.id, resumedBy, notes);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 撤销暂停
router.post('/:id/cancel-pause', async (req, res) => {
  try {
    const { cancelledBy, reason } = req.body;
    const result = await SLAService.cancelPause(req.params.id, cancelledBy, reason);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 关闭工单
router.post('/:id/close', async (req, res) => {
  try {
    const { closedBy } = req.body;
    const result = await TicketService.closeTicket(req.params.id, closedBy);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 获取暂停历史
router.get('/:id/pause-history', async (req, res) => {
  try {
    const history = await SLAService.getPauseHistory(req.params.id);
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
