const express = require('express');
const router = express.Router();
const db = require('./database');
const timeService = require('./timeService');
const { initSampleData } = require('./sampleData');

router.get('/tickets', (req, res) => {
  try {
    const {
      filter_mode = 'hq-timezone',
      range_type = 'today',
      custom_start,
      custom_end,
      store_id
    } = req.query;

    let query = 'SELECT * FROM tickets WHERE 1=1';
    const params = [];

    if (store_id) {
      query += ' AND store_id = ?';
      params.push(store_id);
    }

    const stmt = db.prepare(query);
    const tickets = params.length > 0 ? stmt.all(...params) : stmt.all();

    const filteredTickets = timeService.filterTicketsByTimezone(
      tickets,
      filter_mode,
      range_type,
      custom_start,
      custom_end
    );

    const summary = timeService.generateSummary(filteredTickets);

    res.json({
      success: true,
      data: {
        tickets: filteredTickets,
        summary
      }
    });
  } catch (error) {
    console.error('获取工单列表失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/tickets/:id', (req, res) => {
  try {
    const { id } = req.params;
    const stmt = db.prepare('SELECT * FROM tickets WHERE id = ?');
    const ticket = stmt.get(id);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        error: '工单不存在'
      });
    }

    res.json({
      success: true,
      data: ticket
    });
  } catch (error) {
    console.error('获取工单详情失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/stores', (req, res) => {
  try {
    const stmt = db.prepare(`
      SELECT DISTINCT store_id, store_name, store_timezone 
      FROM tickets 
      ORDER BY store_name
    `);
    const stores = stmt.all();

    res.json({
      success: true,
      data: stores
    });
  } catch (error) {
    console.error('获取门店列表失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/report/markdown', (req, res) => {
  try {
    const {
      filter_mode = 'hq-timezone',
      range_type = 'today',
      custom_start,
      custom_end
    } = req.body;

    const stmt = db.prepare('SELECT * FROM tickets');
    const tickets = stmt.all();

    const filteredTickets = timeService.filterTicketsByTimezone(
      tickets,
      filter_mode,
      range_type,
      custom_start,
      custom_end
    );

    const summary = timeService.generateSummary(filteredTickets);
    const markdown = timeService.generateMarkdownReport(summary, filteredTickets);

    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="ticket-report-${Date.now()}.md"`);
    res.send(markdown);
  } catch (error) {
    console.error('生成Markdown报告失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/reset-data', (req, res) => {
  try {
    db.exec('DELETE FROM tickets');
    initSampleData();
    
    res.json({
      success: true,
      message: '数据已重置'
    });
  } catch (error) {
    console.error('重置数据失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/timezones', (req, res) => {
  res.json({
    success: true,
    data: {
      hq_timezone: timeService.HQ_TIMEZONE,
      filter_modes: [
        { value: 'store-local', label: '门店本地时间', description: '每个工单按其所属门店的时区计算' },
        { value: 'hq-timezone', label: '总部时区', description: `统一使用总部时区 (${timeService.HQ_TIMEZONE}) 计算` },
        { value: 'utc', label: 'UTC时间', description: '统一使用UTC时间计算' }
      ],
      range_types: [
        { value: 'today', label: '今天' },
        { value: 'week', label: '本周' },
        { value: 'month', label: '本月' },
        { value: 'custom', label: '自定义' }
      ]
    }
  });
});

module.exports = router;
