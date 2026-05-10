const express = require('express');
const router = express.Router();
const statisticsService = require('../services/statisticsService');

router.get('/overview', async (req, res) => {
  try {
    const overview = await statisticsService.getOverview();
    
    const formatStat = (s, isOverall = false) => ({
      统计维度: isOverall ? '全站汇总' : `活动: ${s.activity_name || '未命名'}`,
      场景: s.activity_scene || '-',
      优先级: s.activity_priority !== undefined ? s.activity_priority : '-',
      日期: s.date,
      总尝试数: s.total_attempts,
      发送成功: s.success_count,
      频控拦截: s.blocked_count,
      发送失败: s.failed_count,
      补偿成功: s.compensation_count,
      成功率: s.total_attempts > 0 ? 
        `${((s.success_count + s.compensation_count) / s.total_attempts * 100).toFixed(1)}%` : '0%',
      拦截率: s.total_attempts > 0 ? 
        `${(s.blocked_count / s.total_attempts * 100).toFixed(1)}%` : '0%'
    });

    const overall = overview.find(s => s.activity_id === null);
    const activities = overview.filter(s => s.activity_id !== null);

    res.json({
      success: true,
      message: '今日发送统计概览',
      全站汇总: overall ? formatStat(overall, true) : {
        总尝试数: 0, 发送成功: 0, 频控拦截: 0, 发送失败: 0, 补偿成功: 0
      },
      各活动统计: activities.map(a => formatStat(a))
    });
  } catch (e) {
    res.status(500).json({ success: false, message: '获取统计概览失败', error: e.message });
  }
});

router.get('/daily/:date', async (req, res) => {
  try {
    const { date } = req.params;
    const stats = await statisticsService.getDailyStatistics(date);

    res.json({
      success: true,
      message: `${date} 发送统计`,
      data: stats.map(s => ({
        统计日期: s.date,
        活动ID: s.activity_id || '全站',
        总尝试数: s.total_attempts,
        发送成功: s.success_count,
        频控拦截: s.blocked_count,
        发送失败: s.failed_count,
        补偿成功: s.compensation_count
      }))
    });
  } catch (e) {
    res.status(500).json({ success: false, message: '获取日统计失败', error: e.message });
  }
});

module.exports = router;
