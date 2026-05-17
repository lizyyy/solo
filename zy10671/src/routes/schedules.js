const express = require('express');
const { Parser } = require('json2csv');
const scheduleService = require('../services/scheduleService');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      channel_id: req.query.channel_id,
      operator: req.query.operator,
      keyword: req.query.keyword
    };
    
    const list = await scheduleService.getScheduleList(filters);
    res.json({
      success: true,
      data: list,
      total: list.length
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/channels', async (req, res) => {
  try {
    const channels = await scheduleService.getChannels();
    res.json({ success: true, data: channels });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/topics', async (req, res) => {
  try {
    const topics = await scheduleService.getTopics();
    res.json({ success: true, data: topics });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/export', async (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      channel_id: req.query.channel_id,
      operator: req.query.operator,
      keyword: req.query.keyword
    };
    
    const list = await scheduleService.getScheduleList(filters);
    
    const exportData = list.map(item => ({
      ID: item.id,
      专题编码: item.topic_code,
      专题名称: item.topic_name,
      内容类型: item.content_type,
      频道编码: item.channel_code,
      频道名称: item.channel_name,
      开始时间: item.start_time,
      结束时间: item.end_time,
      状态: item.status,
      运营人: item.operator,
      备注: item.remark,
      是否冲突: item.conflict_info ? '是' : '否',
      创建时间: item.created_at,
      更新时间: item.updated_at
    }));
    
    const json2csvParser = new Parser();
    const csv = json2csvParser.parse(exportData);
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="schedules_${Date.now()}.csv"`);
    res.send('\uFEFF' + csv);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const detail = await scheduleService.getScheduleDetail(req.params.id);
    if (!detail) {
      return res.status(404).json({ success: false, error: '排期不存在' });
    }
    res.json({ success: true, data: detail });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id/history', async (req, res) => {
  try {
    const history = await scheduleService.getScheduleHistory(req.params.id);
    res.json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const result = await scheduleService.createSchedule(req.body);
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/import', async (req, res) => {
  try {
    const { rows, operator } = req.body;
    if (!Array.isArray(rows)) {
      return res.status(400).json({ success: false, error: 'rows 必须是数组' });
    }
    
    const result = await scheduleService.batchImport(rows, operator || 'system');
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const result = await scheduleService.updateSchedule(req.params.id, req.body);
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.patch('/:id/status', async (req, res) => {
  try {
    const { status, operator, remark } = req.body;
    const result = await scheduleService.updateStatus(req.params.id, status, operator, remark);
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
