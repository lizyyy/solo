const express = require('express');
const router = express.Router();

// 导入路由模块
const flatmatesRouter = require('./flatmates');
const billsRouter = require('./bills');
const paymentsRouter = require('./payments');
const choresRouter = require('./chores');
const disputesRouter = require('./disputes');
const notificationsRouter = require('./notifications');
const exportRouter = require('./export');

// 健康检查端点
router.get('/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    },
  });
});

// API 版本信息
router.get('/info', (req, res) => {
  res.json({
    success: true,
    data: {
      app_name: 'Flatmate Manager API',
      version: '1.0.0',
      description: '合租室友管理系统后端API - 账单分摊、家务轮值、积分管理、争议处理',
      features: [
        '账单管理（均摊、按比例、指定人员、垫付报销）',
        '付款记录（待确认、部分确认、已结清、逾期）',
        '家务任务（周期生成、积分奖励）',
        '积分系统（抵扣公共费用）',
        '争议处理（管理员审核、余额重算）',
        '通知系统',
        'JSON/Markdown 导出',
      ],
    },
  });
});

// 注册路由
router.use('/flatmates', flatmatesRouter);
router.use('/bills', billsRouter);
router.use('/payments', paymentsRouter);
router.use('/chores', choresRouter);
router.use('/disputes', disputesRouter);
router.use('/notifications', notificationsRouter);
router.use('/export', exportRouter);

module.exports = router;
