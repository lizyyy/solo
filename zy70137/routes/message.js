const express = require('express');
const router = express.Router();
const messageService = require('../services/messageService');
const activityService = require('../services/activityService');
const statisticsService = require('../services/statisticsService');

router.post('/send', async (req, res) => {
  try {
    const { user_id, device_id, activity_id, content, priority } = req.body;
    
    if (!user_id || !device_id || !activity_id) {
      return res.status(400).json({ 
        success: false, 
        message: '缺少必要参数：user_id、device_id、activity_id' 
      });
    }

    const activity = await activityService.getActivityById(activity_id);
    
    if (!activity) {
      return res.status(404).json({ 
        success: false, 
        message: `活动ID [${activity_id}] 不存在，请先创建活动` 
      });
    }

    const isInBucket = await activityService.getUserBucket(user_id, activity_id);
    if (!isInBucket) {
      await activityService.addUserToBucket(user_id, activity_id);
    }

    const result = await messageService.processSend({
      user_id,
      device_id,
      activity_id,
      activity_name: activity.name,
      scene: activity.scene,
      content,
      priority: priority || activity.priority
    });

    res.json(result);
  } catch (e) {
    res.status(500).json({ success: false, message: '发送处理失败', error: e.message });
  }
});

router.get('/history', async (req, res) => {
  try {
    const { user_id, device_id, limit = 20 } = req.query;
    
    if (!user_id && !device_id) {
      return res.status(400).json({ 
        success: false, 
        message: '请提供 user_id 或 device_id 查询历史' 
      });
    }

    const history = await statisticsService.getSendHistory(user_id, device_id, parseInt(limit));
    
    res.json({
      success: true,
      message: `查询到${history.length}条发送历史记录`,
      data: history.map(h => ({
        消息ID: h.id,
        用户ID: h.user_id,
        设备ID: h.device_id,
        活动ID: h.activity_id,
        状态: h.status === 'success' ? '发送成功' : 
              h.status === 'blocked' ? '被频控拦截' :
              h.status === 'failed' ? '发送失败' :
              h.status === 'pending' ? '待处理' : h.status,
        失败原因: h.failed_reason,
        创建时间: h.created_at,
        发送时间: h.sent_at
      }))
    });
  } catch (e) {
    res.status(500).json({ success: false, message: '查询历史失败', error: e.message });
  }
});

router.get('/block-point', async (req, res) => {
  try {
    const { user_id, device_id, activity_id } = req.query;
    
    if (!user_id || !device_id || !activity_id) {
      return res.status(400).json({ 
        success: false, 
        message: '请提供 user_id、device_id、activity_id 查询卡点' 
      });
    }

    const attempts = await statisticsService.getBlockPointDetails(user_id, device_id, activity_id);
    
    if (attempts.length === 0) {
      return res.json({
        success: true,
        message: '未找到该用户在该活动下的处理记录',
        data: null
      });
    }

    const latest = attempts[0];
    const secondLatest = attempts[1];

    let parsedDetails = {};
    try {
      parsedDetails = JSON.parse(latest.details);
    } catch (e) {
      parsedDetails = {};
    }

    res.json({
      success: true,
      message: `共查询到${attempts.length}条处理记录，最近一条状态：${latest.check_result}`,
      当前卡点: latest.check_result === '频控拦截' ? {
        卡点时间: latest.check_time,
        卡点状态: latest.check_result,
        频控检查结果: latest.frequency_check,
        限制详情: latest.frequency_limit ? JSON.parse(latest.frequency_limit) : null,
        检查明细: parsedDetails.check_details || []
      } : null,
      上一次处理: secondLatest ? {
        处理时间: secondLatest.check_time,
        处理结果: secondLatest.check_result,
        状态: secondLatest.status
      } : '无更早处理记录',
      历史记录数: attempts.length
    });
  } catch (e) {
    res.status(500).json({ success: false, message: '查询卡点失败', error: e.message });
  }
});

module.exports = router;
