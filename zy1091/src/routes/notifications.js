const express = require('express');
const router = express.Router();
const { NotificationController } = require('../controllers');

// 获取我的通知
router.get('/', NotificationController.getMyNotifications);

// 获取通知摘要
router.get('/summary', NotificationController.getSummary);

// 批量标记为已读
router.post('/mark-all-read', NotificationController.markAllAsRead);

// 删除已读通知
router.delete('/read', NotificationController.deleteRead);

// 根据ID获取通知
router.get('/:id', NotificationController.getById);

// 标记为已读
router.post('/:id/mark-read', NotificationController.markAsRead);

// 删除通知
router.delete('/:id', NotificationController.delete);

module.exports = router;
