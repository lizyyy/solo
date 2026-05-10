const express = require('express');
const router = express.Router();
const NotificationService = require('../services/NotificationService');

router.get('/', async (req, res) => {
  try {
    const { type, status, authorizationId, materialId, limit = 50, offset = 0 } = req.query;
    const notificationService = new NotificationService();

    const filters = {};
    if (type) filters.type = type;
    if (status) filters.status = status;
    if (authorizationId) filters.authorizationId = authorizationId;
    if (materialId) filters.materialId = materialId;

    const notifications = await notificationService.getNotifications(filters, parseInt(limit), parseInt(offset));

    res.json({
      success: true,
      data: notifications
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/send-expiration-warnings', async (req, res) => {
  try {
    const { daysThreshold = 7, recipient } = req.body;
    
    if (!recipient) {
      return res.status(400).json({
        success: false,
        error: '必须指定通知接收人'
      });
    }

    const notificationService = new NotificationService();
    const result = await notificationService.sendExpirationWarnings(parseInt(daysThreshold), recipient);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/:id/mark-sent', async (req, res) => {
  try {
    const notificationService = new NotificationService();
    const result = await notificationService.markAsSent(req.params.id);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
