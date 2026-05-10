const express = require('express');
const router = express.Router();
const compensationService = require('../services/compensationService');
const messageService = require('../services/messageService');

router.get('/pending', async (req, res) => {
  try {
    const pending = await compensationService.getPendingCompensations();

    res.json({
      success: true,
      message: `当前有${pending.length}条消息待补偿，5分钟内将自动重试`,
      data: pending.map(p => ({
        消息ID: p.message_id,
        用户ID: p.user_id,
        设备ID: p.device_id,
        活动ID: p.activity_id,
        失败原因: p.reason,
        已重试次数: p.retry_count,
        最大重试次数: 3,
        下次重试时间: p.next_retry_at
      }))
    });
  } catch (e) {
    res.status(500).json({ success: false, message: '查询待补偿消息失败', error: e.message });
  }
});

router.post('/manual-retry', async (req, res) => {
  try {
    const { message_id } = req.body;
    
    if (!message_id) {
      return res.status(400).json({ success: false, message: '请提供 message_id' });
    }

    const compensation = await compensationService.getCompensationByMessageId(message_id);
    
    if (!compensation) {
      return res.status(404).json({ 
        success: false, 
        message: `消息ID [${message_id}] 不在补偿队列中（可能已补偿成功或重试次数用完）` 
      });
    }

    const message = await messageService.getMessageById(message_id);
    if (!message) {
      return res.status(404).json({ success: false, message: '消息不存在' });
    }

    const result = await messageService.processSend({
      user_id: message.user_id,
      device_id: message.device_id,
      activity_id: message.activity_id,
      content: message.content,
      priority: message.priority
    });

    if (result.success) {
      await compensationService.updateCompensation(compensation.id, true);
      res.json({
        success: true,
        message: '手动补偿成功',
        data: result
      });
    } else {
      res.json({
        success: false,
        message: '手动补偿失败，请稍后再试或检查网络',
        data: result
      });
    }
  } catch (e) {
    res.status(500).json({ success: false, message: '手动补偿执行失败', error: e.message });
  }
});

router.post('/process-batch', async (req, res) => {
  try {
    const result = await compensationService.processCompensations(async (data) => {
      return await messageService.processSend(data);
    });

    if (result.total_processed === 0) {
      return res.json({
        success: true,
        message: '当前没有待补偿的消息',
        data: result
      });
    }

    res.json({
      success: true,
      message: `批量补偿处理完成，共处理${result.total_processed}条消息`,
      data: result
    });
  } catch (e) {
    res.status(500).json({ success: false, message: '批量补偿执行失败', error: e.message });
  }
});

module.exports = router;
