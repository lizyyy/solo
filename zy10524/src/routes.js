const express = require('express');
const router = express.Router();
const service = require('./service');
const moment = require('moment');

router.post('/unsubscribe/batch', async (req, res) => {
  try {
    const { phones, channel, unsubscribeTime, marketingBatch, sourceData, createdBy } = req.body;
    
    if (!phones || !Array.isArray(phones) || phones.length === 0) {
      return res.status(400).json({ error: '请提供手机号列表' });
    }
    if (!channel) {
      return res.status(400).json({ error: '请提供退订渠道' });
    }

    const result = await service.processUnsubscribe(
      phones,
      channel,
      unsubscribeTime || moment().format('YYYY-MM-DD HH:mm:ss'),
      marketingBatch,
      sourceData,
      createdBy || 'system'
    );

    res.json({
      success: true,
      message: '批量退订处理完成',
      data: result
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/unsubscribe/check-block', async (req, res) => {
  try {
    const { phone, campaignId, marketingBatch } = req.body;
    
    if (!phone) {
      return res.status(400).json({ error: '请提供手机号' });
    }

    const result = await service.checkBlock(phone, campaignId, marketingBatch);
    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/unsubscribe/query', async (req, res) => {
  try {
    const result = await service.queryUnsubscribe(req.query);
    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/unsubscribe/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, operator, reason } = req.body;
    
    if (!status || !operator || !reason) {
      return res.status(400).json({ error: '请提供状态、操作人和原因' });
    }

    await service.updateStatus(id, status, operator, reason);
    res.json({
      success: true,
      message: '状态更新成功'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/exceptions', async (req, res) => {
  try {
    const result = await service.getExceptions(req.query);
    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/exceptions/:id/handle', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, operator } = req.body;
    
    if (!status || !operator) {
      return res.status(400).json({ error: '请提供状态和操作人' });
    }

    await service.handleException(id, status, operator);
    res.json({
      success: true,
      message: '异常处理完成'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/report/summary', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: '请提供起止日期' });
    }

    const result = await service.getBatchReport(startDate, endDate);
    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/export/unsubscribe', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: '请提供起止日期' });
    }

    const data = await service.getAllUnsubscribeForExport(startDate, endDate);
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=unsubscribe_${moment().format('YYYYMMDD')}.csv`);
    
    res.write('\uFEFF');
    
    if (data.length > 0) {
      const headers = Object.keys(data[0]);
      res.write(headers.join(',') + '\n');
      
      data.forEach(row => {
        const values = headers.map(h => {
          const val = row[h] || '';
          return `"${val.toString().replace(/"/g, '""')}"`;
        });
        res.write(values.join(',') + '\n');
      });
    }
    
    res.end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
