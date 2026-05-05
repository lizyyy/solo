const express = require('express');
const router = express.Router();
const { TrafficTrace } = require('../models');

router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
    
    const { count, rows } = await TrafficTrace.findAndCountAll({
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
      attributes: ['id', 'name', 'description', 'source', 'requestCount', 'createdAt', 'updatedAt']
    });
    
    res.json({
      success: true,
      data: rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('获取流量追踪列表失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const trace = await TrafficTrace.findByPk(req.params.id);
    
    if (!trace) {
      return res.status(404).json({ success: false, message: '流量追踪不存在' });
    }
    
    res.json({ success: true, data: trace });
  } catch (error) {
    console.error('获取流量追踪详情失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, description, source, data } = req.body;
    
    if (!name) {
      return res.status(400).json({ success: false, message: '名称不能为空' });
    }
    
    if (!data || !Array.isArray(data)) {
      return res.status(400).json({ success: false, message: '流量数据必须是数组' });
    }
    
    const trace = await TrafficTrace.create({
      name,
      description,
      source: source || 'file',
      requestCount: data.length,
      data
    });
    
    res.status(201).json({ success: true, data: trace });
  } catch (error) {
    console.error('创建流量追踪失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/import', async (req, res) => {
  try {
    const { name, description, format, content } = req.body;
    
    if (!name) {
      return res.status(400).json({ success: false, message: '名称不能为空' });
    }
    
    if (!content) {
      return res.status(400).json({ success: false, message: '内容不能为空' });
    }
    
    let data;
    try {
      if (format === 'json' || !format) {
        data = typeof content === 'string' ? JSON.parse(content) : content;
      } else if (format === 'csv') {
        data = parseCSV(content);
      } else {
        return res.status(400).json({ success: false, message: '不支持的格式' });
      }
    } catch (error) {
      return res.status(400).json({ success: false, message: '数据解析失败: ' + error.message });
    }
    
    if (!Array.isArray(data)) {
      return res.status(400).json({ success: false, message: '数据必须是数组格式' });
    }
    
    const normalizedData = data.map((item, index) => ({
      requestId: item.requestId || item.id || `req_${Date.now()}_${index}`,
      timestamp: item.timestamp || new Date(),
      url: item.url || item.path || '/',
      method: item.method || 'GET',
      headers: item.headers || {},
      body: item.body || null,
      query: item.query || {},
      latency: item.latency || item.responseTime || 0,
      responseInfo: item.responseInfo || item.response || {
        statusCode: item.statusCode || 200,
        body: item.responseBody || null
      }
    }));
    
    const trace = await TrafficTrace.create({
      name,
      description,
      source: 'import',
      requestCount: normalizedData.length,
      data: normalizedData
    });
    
    res.status(201).json({ success: true, data: trace });
  } catch (error) {
    console.error('导入流量追踪失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const trace = await TrafficTrace.findByPk(req.params.id);
    
    if (!trace) {
      return res.status(404).json({ success: false, message: '流量追踪不存在' });
    }
    
    const { name, description, data } = req.body;
    
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (data !== undefined) {
      if (!Array.isArray(data)) {
        return res.status(400).json({ success: false, message: '流量数据必须是数组' });
      }
      updateData.data = data;
      updateData.requestCount = data.length;
    }
    
    await trace.update(updateData);
    
    res.json({ success: true, data: trace });
  } catch (error) {
    console.error('更新流量追踪失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const trace = await TrafficTrace.findByPk(req.params.id);
    
    if (!trace) {
      return res.status(404).json({ success: false, message: '流量追踪不存在' });
    }
    
    await trace.destroy();
    
    res.json({ success: true, message: '流量追踪已删除' });
  } catch (error) {
    console.error('删除流量追踪失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

function parseCSV(content) {
  const lines = content.trim().split('\n');
  if (lines.length < 2) return [];
  
  const headers = lines[0].split(',').map(h => h.trim());
  const data = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    data.push(row);
  }
  
  return data;
}

module.exports = router;
