const express = require('express');
const cron = require('node-cron');
const config = require('./config');
const { initDatabase } = require('./database');
const routes = require('./routes');
const services = require('./services');
const models = require('./models');

const app = express();

initDatabase();

app.use('/api', routes);

let paymentTimeoutJob = null;
let queueTimeoutJob = null;
let notificationJob = null;

function startCronJobs() {
  paymentTimeoutJob = cron.schedule(config.cronPaymentTimeout, () => {
    console.log(`[${new Date().toISOString()}] 执行支付超时检查...`);
    try {
      const result = services.processPaymentTimeouts();
      if (result.processedCount > 0) {
        console.log(`  处理了 ${result.processedCount} 个超时支付`);
      }
    } catch (err) {
      console.error('支付超时处理失败:', err.message);
    }
  });

  queueTimeoutJob = cron.schedule(config.cronQueueProcess, () => {
    console.log(`[${new Date().toISOString()}] 执行候补队列超时检查...`);
    try {
      const result = services.processQueueTimeouts();
      if (result.processedCount > 0) {
        console.log(`  处理了 ${result.processedCount} 个超时候补`);
      }
    } catch (err) {
      console.error('候补队列超时处理失败:', err.message);
    }
  });

  notificationJob = cron.schedule('*/1 * * * *', () => {
    processNotifications();
  });

  console.log('定时任务已启动');
  console.log(`  - 支付超时检查: ${config.cronPaymentTimeout}`);
  console.log(`  - 候补超时检查: ${config.cronQueueProcess}`);
  console.log(`  - 通知发送: 每分钟`);
}

function processNotifications() {
  const pending = models.getPendingNotifications();
  
  for (const notification of pending) {
    try {
      sendNotification(notification);
      models.updateNotificationStatus(notification.id, models.NotificationStatus.SENT);
    } catch (err) {
      console.error(`通知发送失败 [${notification.id}]:`, err.message);
      models.updateNotificationStatus(notification.id, models.NotificationStatus.FAILED, err.message);
    }
  }
}

function sendNotification(notification) {
  const messages = {
    [models.NotificationType.TICKET_OFFER]: 
      `您有一张候补票待支付，请在${config.paymentWindowSeconds}秒内完成支付`,
    [models.NotificationType.PAYMENT_SUCCESS]:
      '支付成功，您已获得该票',
    [models.NotificationType.PAYMENT_EXPIRED]:
      '支付超时，订单已取消',
    [models.NotificationType.REFUND_SUCCESS]:
      '退票成功，款项将原路退回',
    [models.NotificationType.QUEUE_SKIPPED]:
      '您已放弃候补资格，名额已递补给下一位用户',
  };

  console.log(`[通知] 用户:${notification.user_id} 类型:${notification.type} 消息:${messages[notification.type] || notification.type}`);
}

function stopCronJobs() {
  if (paymentTimeoutJob) paymentTimeoutJob.stop();
  if (queueTimeoutJob) queueTimeoutJob.stop();
  if (notificationJob) notificationJob.stop();
  console.log('定时任务已停止');
}

process.on('SIGINT', () => {
  console.log('\n正在关闭服务...');
  stopCronJobs();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n正在关闭服务...');
  stopCronJobs();
  process.exit(0);
});

const server = app.listen(config.port, () => {
  console.log(`票务候补递补服务已启动`);
  console.log(`  端口: ${config.port}`);
  console.log(`  支付窗口: ${config.paymentWindowSeconds} 秒`);
  console.log(`  数据库: ${config.dbPath}`);
  console.log(`\nAPI 端点:`);
  console.log(`  GET  /api/health               - 健康检查`);
  console.log(`  POST /api/tickets              - 创建票`);
  console.log(`  GET  /api/tickets/available    - 查询可用票`);
  console.log(`  POST /api/purchase             - 购票`);
  console.log(`  POST /api/payments/confirm     - 确认支付`);
  console.log(`  POST /api/queue/join           - 加入候补`);
  console.log(`  GET  /api/queue/status         - 查询候补状态`);
  console.log(`  GET  /api/queue/list           - 查询候补队列`);
  console.log(`  POST /api/queue/reject         - 拒绝候补offer`);
  console.log(`  POST /api/refunds              - 退票`);
  console.log(`  POST /api/admin/process-timeouts - 手动处理超时`);
  console.log(`  GET  /api/admin/failed-tasks   - 查询失败任务`);
  console.log(`  POST /api/admin/retry-task     - 重试失败任务`);
  console.log(`  GET  /api/admin/reports        - 查询递补报告`);
  
  startCronJobs();
});

module.exports = { app, server, stopCronJobs };
