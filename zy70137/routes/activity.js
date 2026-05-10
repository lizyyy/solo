const express = require('express');
const router = express.Router();
const activityService = require('../services/activityService');

router.get('/', async (req, res) => {
  try {
    const activities = await activityService.getAllActivities();
    
    const results = [];
    for (const a of activities) {
      const bucketStats = await activityService.getBucketStats(a.id);
      results.push({
        id: a.id,
        活动名称: a.name,
        所属场景: a.scene,
        优先级: a.priority,
        状态: a.status === 'active' ? '进行中' : '已结束',
        今日入桶用户数: bucketStats ? bucketStats.user_count : 0,
        开始时间: a.start_time,
        结束时间: a.end_time,
        创建时间: a.created_at
      });
    }

    res.json({
      success: true,
      message: `共${activities.length}个活动，按优先级从高到低排序`,
      data: results
    });
  } catch (e) {
    res.status(500).json({ success: false, message: '获取活动列表失败', error: e.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, scene, priority = 0, rule_id, status = 'active', start_time, end_time } = req.body;
    
    if (!name || !scene) {
      return res.status(400).json({ success: false, message: '缺少必要参数：name、scene' });
    }

    const activity = await activityService.createActivity({
      name,
      scene,
      priority: parseInt(priority),
      rule_id,
      status,
      start_time,
      end_time
    });

    res.json({
      success: true,
      message: `活动「${name}」创建成功，优先级${priority}`,
      data: {
        活动ID: activity.id,
        活动名称: activity.name,
        所属场景: activity.scene,
        优先级: activity.priority
      }
    });
  } catch (e) {
    res.status(500).json({ success: false, message: '创建活动失败', error: e.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, scene, priority, rule_id, status, start_time, end_time } = req.body;
    const existing = await activityService.getActivityById(req.params.id);
    
    if (!existing) {
      return res.status(404).json({ success: false, message: '活动不存在' });
    }

    const updated = await activityService.updateActivity(req.params.id, {
      name: name || existing.name,
      scene: scene || existing.scene,
      priority: priority !== undefined ? parseInt(priority) : existing.priority,
      rule_id: rule_id !== undefined ? rule_id : existing.rule_id,
      status: status || existing.status,
      start_time: start_time !== undefined ? start_time : existing.start_time,
      end_time: end_time !== undefined ? end_time : existing.end_time
    });

    res.json({
      success: true,
      message: '活动更新成功',
      data: updated
    });
  } catch (e) {
    res.status(500).json({ success: false, message: '更新活动失败', error: e.message });
  }
});

router.put('/:id/priority', async (req, res) => {
  try {
    const { priority } = req.body;
    const activity = await activityService.getActivityById(req.params.id);
    
    if (!activity) {
      return res.status(404).json({ success: false, message: '活动不存在' });
    }

    await activityService.updatePriority(req.params.id, parseInt(priority));

    res.json({
      success: true,
      message: `活动「${activity.name}」优先级已调整为${priority}`,
      data: { priority: parseInt(priority) }
    });
  } catch (e) {
    res.status(500).json({ success: false, message: '更新优先级失败', error: e.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const result = await activityService.deleteActivity(req.params.id);
    
    if (result.affected === 0) {
      return res.status(404).json({ success: false, message: '活动不存在' });
    }

    res.json({
      success: true,
      message: '活动删除成功',
      data: { affected: result.affected }
    });
  } catch (e) {
    res.status(500).json({ success: false, message: '删除活动失败', error: e.message });
  }
});

router.get('/:id/bucket', async (req, res) => {
  try {
    const { user_id } = req.query;
    const activity = await activityService.getActivityById(req.params.id);
    
    if (!activity) {
      return res.status(404).json({ success: false, message: '活动不存在' });
    }

    const bucketStats = await activityService.getBucketStats(req.params.id);
    let userInBucket = null;
    
    if (user_id) {
      userInBucket = await activityService.getUserBucket(user_id, req.params.id);
    }

    res.json({
      success: true,
      message: `活动「${activity.name}」用户桶统计`,
      data: {
        活动名称: activity.name,
        日期: bucketStats ? bucketStats.date : new Date().toISOString().split('T')[0],
        今日入桶用户数: bucketStats ? bucketStats.user_count : 0,
        查询用户是否在桶中: user_id ? (userInBucket ? '是' : '否') : '未指定用户'
      }
    });
  } catch (e) {
    res.status(500).json({ success: false, message: '查询用户桶失败', error: e.message });
  }
});

module.exports = router;
