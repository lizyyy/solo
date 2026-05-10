const express = require('express');
const router = express.Router();
const frequencyService = require('../services/frequencyService');

router.get('/', async (req, res) => {
  try {
    const rules = await frequencyService.getAllRules();
    res.json({
      success: true,
      message: `共${rules.length}条频控规则`,
      data: rules.map(r => ({
        id: r.id,
        规则名称: r.name,
        限制维度: r.type === 'user' ? '用户' : r.type === 'device' ? '设备' : '场景',
        时间范围: r.scope === 'daily' ? '每日' : r.scope === 'hourly' ? '每小时' : r.scope === 'peak' ? '活动高峰' : r.scope,
        限制条数: r.limit_count,
        时间窗口: `${r.time_window}${r.unit === 'day' ? '天' : r.unit === 'hour' ? '小时' : r.unit === 'minute' ? '分钟' : r.unit}`,
        状态: r.is_active ? '启用' : '停用',
        创建时间: r.created_at
      }))
    });
  } catch (e) {
    res.status(500).json({ success: false, message: '获取规则列表失败', error: e.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, type, scope, limit_count, time_window, unit, is_active = true } = req.body;
    
    if (!name || !type || !scope || !limit_count || !time_window || !unit) {
      return res.status(400).json({ success: false, message: '缺少必要参数' });
    }

    const rule = await frequencyService.createRule({
      name,
      type,
      scope,
      limit_count: parseInt(limit_count),
      time_window: parseInt(time_window),
      unit,
      is_active: is_active ? 1 : 0
    });

    res.json({
      success: true,
      message: '规则创建成功',
      data: {
        规则ID: rule.id,
        规则名称: rule.name,
        限制维度: rule.type,
        限制条数: rule.limit_count
      }
    });
  } catch (e) {
    res.status(500).json({ success: false, message: '创建规则失败', error: e.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, type, scope, limit_count, time_window, unit, is_active } = req.body;
    const existing = await frequencyService.getRuleById(req.params.id);
    
    if (!existing) {
      return res.status(404).json({ success: false, message: '规则不存在' });
    }

    const updated = await frequencyService.updateRule(req.params.id, {
      name: name || existing.name,
      type: type || existing.type,
      scope: scope || existing.scope,
      limit_count: limit_count !== undefined ? parseInt(limit_count) : existing.limit_count,
      time_window: time_window !== undefined ? parseInt(time_window) : existing.time_window,
      unit: unit || existing.unit,
      is_active: is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active
    });

    res.json({
      success: true,
      message: '规则更新成功',
      data: updated
    });
  } catch (e) {
    res.status(500).json({ success: false, message: '更新规则失败', error: e.message });
  }
});

router.put('/:id/toggle', async (req, res) => {
  try {
    const { is_active } = req.body;
    const result = await frequencyService.toggleRule(req.params.id, is_active);
    
    res.json({
      success: true,
      message: `规则已${is_active ? '启用' : '停用'}`,
      data: { affected: result.affected }
    });
  } catch (e) {
    res.status(500).json({ success: false, message: '切换规则状态失败', error: e.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const result = await frequencyService.deleteRule(req.params.id);
    
    if (result.affected === 0) {
      return res.status(404).json({ success: false, message: '规则不存在' });
    }

    res.json({
      success: true,
      message: '规则删除成功',
      data: { affected: result.affected }
    });
  } catch (e) {
    res.status(500).json({ success: false, message: '删除规则失败', error: e.message });
  }
});

module.exports = router;
