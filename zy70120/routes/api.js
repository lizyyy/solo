const express = require('express');
const router = express.Router();
const queueService = require('../services/queueService');
const tableService = require('../services/tableService');
const notificationService = require('../services/notificationService');
const reportService = require('../services/reportService');

const handleError = (res, error) => {
  console.error('[ERROR]', error.message);
  res.status(400).json({
    success: false,
    error: error.message,
    timestamp: new Date().toISOString()
  });
};

router.post('/queue/join', (req, res) => {
  try {
    const { customerName, partySize, phone, isMember, memberLevel } = req.body;
    const ticket = queueService.joinQueue(customerName, partySize, phone, isMember, memberLevel);
    res.json({
      success: true,
      data: ticket,
      message: `成功取号：${ticket.queueNumber}，预计等待${ticket.estimatedWaitTime}分钟`
    });
  } catch (e) {
    handleError(res, e);
  }
});

router.post('/queue/call/:tableType', (req, res) => {
  try {
    const { tableType } = req.params;
    const ticket = queueService.callNext(tableType);
    notificationService.notifyCalling(ticket.id);
    res.json({
      success: true,
      data: ticket,
      message: `已呼叫：${ticket.queueNumber}，请${ticket.customerName}尽快入座`
    });
  } catch (e) {
    handleError(res, e);
  }
});

router.post('/queue/seated/:ticketId', (req, res) => {
  try {
    const { ticketId } = req.params;
    const { tableId, isCombined } = req.body;
    const ticket = queueService.markSeated(ticketId, tableId, isCombined);
    res.json({
      success: true,
      data: ticket,
      message: `${ticket.queueNumber}已入座桌号${tableId}`
    });
  } catch (e) {
    handleError(res, e);
  }
});

router.post('/queue/overtime/:ticketId', (req, res) => {
  try {
    const { ticketId } = req.params;
    const result = queueService.markOvertime(ticketId);
    if (result.action === 'canceled') {
      notificationService.notifyOvertime(ticketId, result.ticket.skipCount);
    }
    res.json({
      success: true,
      data: result.ticket,
      action: result.action,
      message: result.message
    });
  } catch (e) {
    handleError(res, e);
  }
});

router.post('/queue/restore/:ticketId', (req, res) => {
  try {
    const { ticketId } = req.params;
    const ticket = queueService.restoreQueue(ticketId);
    notificationService.notifyRestore(ticketId, ticket.position);
    res.json({
      success: true,
      data: ticket,
      message: `已恢复排队，当前位置：第${ticket.position}位`
    });
  } catch (e) {
    handleError(res, e);
  }
});

router.post('/queue/cancel/:ticketId', (req, res) => {
  try {
    const { ticketId } = req.params;
    const { reason } = req.body;
    const ticket = queueService.cancelQueue(ticketId, reason);
    res.json({
      success: true,
      data: ticket,
      message: `${ticket.queueNumber}已取消排队`
    });
  } catch (e) {
    handleError(res, e);
  }
});

router.get('/queue/status', (req, res) => {
  try {
    const { tableType } = req.query;
    const status = queueService.getQueueStatus(tableType);
    res.json({
      success: true,
      data: status
    });
  } catch (e) {
    handleError(res, e);
  }
});

router.get('/queue/ticket/:ticketId', (req, res) => {
  try {
    const { ticketId } = req.params;
    const ticket = queueService.getTicket(ticketId);
    res.json({
      success: true,
      data: ticket
    });
  } catch (e) {
    handleError(res, e);
  }
});

router.get('/queue/ticket/number/:queueNumber', (req, res) => {
  try {
    const { queueNumber } = req.params;
    const ticket = queueService.getTicketByNumber(queueNumber);
    res.json({
      success: true,
      data: ticket
    });
  } catch (e) {
    handleError(res, e);
  }
});

router.post('/queue/adjust/:ticketId', (req, res) => {
  try {
    const { ticketId } = req.params;
    const { newStatus, reason, operator } = req.body;
    const ticket = queueService.manualAdjustStatus(ticketId, newStatus, reason, operator);
    res.json({
      success: true,
      data: ticket,
      message: `状态已人工调整：${ticket.manualAdjustments[ticket.manualAdjustments.length - 1].from} -> ${newStatus}`
    });
  } catch (e) {
    handleError(res, e);
  }
});

router.get('/tables', (req, res) => {
  try {
    const { tableType } = req.query;
    const tables = tableService.getAvailableTables(tableType);
    res.json({
      success: true,
      data: tables
    });
  } catch (e) {
    handleError(res, e);
  }
});

router.get('/tables/match', (req, res) => {
  try {
    const { partySize, preferCombined } = req.query;
    const match = tableService.findMatchingTable(
      parseInt(partySize),
      preferCombined === 'true'
    );
    res.json({
      success: true,
      data: match
    });
  } catch (e) {
    handleError(res, e);
  }
});

router.post('/tables/combine', (req, res) => {
  try {
    const { tableIds } = req.body;
    const combined = tableService.combineTables(tableIds);
    res.json({
      success: true,
      data: combined,
      message: `成功合桌：${tableIds.join(' + ')} -> ${combined.id}，总容量${combined.capacity}人`
    });
  } catch (e) {
    handleError(res, e);
  }
});

router.post('/tables/split/:combinedId', (req, res) => {
  try {
    const { combinedId } = req.params;
    const result = tableService.splitTable(combinedId);
    res.json({
      success: true,
      data: result,
      message: `成功拆桌：${combinedId}`
    });
  } catch (e) {
    handleError(res, e);
  }
});

router.post('/tables/release/:tableId', (req, res) => {
  try {
    const { tableId } = req.params;
    const result = tableService.releaseTable(tableId);
    res.json({
      success: true,
      data: result,
      message: `桌号${tableId}已释放`
    });
  } catch (e) {
    handleError(res, e);
  }
});

router.post('/notifications/send', (req, res) => {
  try {
    const { ticketId, type, message, extraData } = req.body;
    const result = notificationService.sendNotification(ticketId, type, message, extraData);
    res.json({
      success: result.success,
      duplicate: result.duplicate,
      data: result.notification,
      message: result.duplicate ? '通知已去重，未重复发送' : '通知发送成功'
    });
  } catch (e) {
    handleError(res, e);
  }
});

router.get('/notifications', (req, res) => {
  try {
    const notifications = notificationService.getNotifications(req.query);
    res.json({
      success: true,
      data: notifications
    });
  } catch (e) {
    handleError(res, e);
  }
});

router.get('/notifications/stats', (req, res) => {
  try {
    const stats = notificationService.getNotificationStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (e) {
    handleError(res, e);
  }
});

router.get('/reports/daily', (req, res) => {
  try {
    const { date } = req.query;
    const report = reportService.generateDailyReport(date);
    res.json({
      success: true,
      data: report
    });
  } catch (e) {
    handleError(res, e);
  }
});

router.get('/reports/status', (req, res) => {
  try {
    const status = reportService.getCurrentStatusSummary();
    res.json({
      success: true,
      data: status
    });
  } catch (e) {
    handleError(res, e);
  }
});

router.get('/history', (req, res) => {
  try {
    const history = reportService.getHistory(req.query);
    res.json({
      success: true,
      data: history
    });
  } catch (e) {
    handleError(res, e);
  }
});

router.get('/history/ticket/:ticketId', (req, res) => {
  try {
    const { ticketId } = req.params;
    const history = reportService.getTicketHistory(ticketId);
    res.json({
      success: true,
      data: history
    });
  } catch (e) {
    handleError(res, e);
  }
});

router.get('/', (req, res) => {
  res.json({
    name: '餐厅拼桌排号服务',
    version: '1.0.0',
    endpoints: {
      queue: [
        'POST /api/queue/join - 取号',
        'POST /api/queue/call/:tableType - 叫号',
        'POST /api/queue/seated/:ticketId - 入座',
        'POST /api/queue/overtime/:ticketId - 标记过号',
        'POST /api/queue/restore/:ticketId - 恢复排队',
        'POST /api/queue/cancel/:ticketId - 取消排队',
        'GET /api/queue/status - 查询队列状态',
        'GET /api/queue/ticket/:ticketId - 查询号码详情',
        'POST /api/queue/adjust/:ticketId - 人工调整状态'
      ],
      tables: [
        'GET /api/tables - 查询所有桌位',
        'GET /api/tables/match?partySize= - 桌型匹配',
        'POST /api/tables/combine - 合桌',
        'POST /api/tables/split/:combinedId - 拆桌',
        'POST /api/tables/release/:tableId - 释放桌位'
      ],
      notifications: [
        'POST /api/notifications/send - 发送通知',
        'GET /api/notifications - 查询通知记录',
        'GET /api/notifications/stats - 通知统计'
      ],
      reports: [
        'GET /api/reports/daily - 日报',
        'GET /api/reports/status - 当前状态汇总',
        'GET /api/history - 历史记录',
        'GET /api/history/ticket/:ticketId - 号码历史'
      ]
    }
  });
});

module.exports = router;
