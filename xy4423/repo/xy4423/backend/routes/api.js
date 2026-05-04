const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const fileParser = require('../utils/fileParser');
const eventService = require('../services/eventService');
const dataExporter = require('../utils/dataExporter');

// 配置文件上传
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}_${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ storage: storage });

// 数据导入接口
router.post('/import', upload.array('files'), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: '没有上传文件' });
    }

    const importResults = [];

    for (const file of req.files) {
      const result = await fileParser.parseFile(file.path, file.originalname);
      importResults.push(result);
      // 删除临时文件
      fs.unlinkSync(file.path);
    }

    // 处理导入的数据，合并事件
    const mergedEvents = await eventService.processImportedData(importResults);

    res.json({ 
      success: true, 
      message: `成功导入 ${req.files.length} 个文件`,
      data: {
        importResults,
        mergedEvents
      }
    });
  } catch (error) {
    console.error('导入数据失败:', error);
    res.status(500).json({ success: false, message: '导入数据失败', error: error.message });
  }
});

// 获取所有事件
router.get('/events', async (req, res) => {
  try {
    const events = await eventService.getAllEvents();
    res.json({ success: true, data: events });
  } catch (error) {
    console.error('获取事件失败:', error);
    res.status(500).json({ success: false, message: '获取事件失败', error: error.message });
  }
});

// 获取单个事件详情
router.get('/events/:id', async (req, res) => {
  try {
    const event = await eventService.getEventById(req.params.id);
    if (!event) {
      return res.status(404).json({ success: false, message: '事件不存在' });
    }
    res.json({ success: true, data: event });
  } catch (error) {
    console.error('获取事件详情失败:', error);
    res.status(500).json({ success: false, message: '获取事件详情失败', error: error.message });
  }
});

// 更新事件（改判、添加备注）
router.put('/events/:id', async (req, res) => {
  try {
    const { status, notes, adminComment } = req.body;
    const updatedEvent = await eventService.updateEvent(req.params.id, {
      status,
      notes,
      adminComment,
      updatedAt: new Date().toISOString()
    });
    
    if (!updatedEvent) {
      return res.status(404).json({ success: false, message: '事件不存在' });
    }
    
    res.json({ success: true, message: '事件已更新', data: updatedEvent });
  } catch (error) {
    console.error('更新事件失败:', error);
    res.status(500).json({ success: false, message: '更新事件失败', error: error.message });
  }
});

// 批量更新事件状态
router.post('/events/batch-update', async (req, res) => {
  try {
    const { eventIds, status, adminComment } = req.body;
    if (!eventIds || !Array.isArray(eventIds) || eventIds.length === 0) {
      return res.status(400).json({ success: false, message: '请选择要更新的事件' });
    }
    
    const results = await eventService.batchUpdateEvents(eventIds, {
      status,
      adminComment,
      updatedAt: new Date().toISOString()
    });
    
    res.json({ 
      success: true, 
      message: `成功更新 ${results.updatedCount} 个事件`,
      data: results 
    });
  } catch (error) {
    console.error('批量更新事件失败:', error);
    res.status(500).json({ success: false, message: '批量更新事件失败', error: error.message });
  }
});

// 导出 Markdown 复盘报告
router.get('/export/markdown', async (req, res) => {
  try {
    const { eventIds, includeDetails } = req.query;
    const events = eventIds ? JSON.parse(eventIds) : null;
    
    const markdownContent = await dataExporter.generateMarkdownReport(events, includeDetails === 'true');
    
    res.setHeader('Content-Type', 'text/markdown');
    res.setHeader('Content-Disposition', `attachment; filename="observation-review-${Date.now()}.md"`);
    res.send(markdownContent);
  } catch (error) {
    console.error('导出 Markdown 报告失败:', error);
    res.status(500).json({ success: false, message: '导出 Markdown 报告失败', error: error.message });
  }
});

// 导出 JSON 审计包
router.get('/export/json', async (req, res) => {
  try {
    const { eventIds } = req.query;
    const events = eventIds ? JSON.parse(eventIds) : null;
    
    const jsonContent = await dataExporter.generateJSONAudit(events);
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="observation-audit-${Date.now()}.json"`);
    res.json(jsonContent);
  } catch (error) {
    console.error('导出 JSON 审计包失败:', error);
    res.status(500).json({ success: false, message: '导出 JSON 审计包失败', error: error.message });
  }
});

// 清除所有数据（用于测试）
router.delete('/clear', async (req, res) => {
  try {
    await eventService.clearAllData();
    res.json({ success: true, message: '所有数据已清除' });
  } catch (error) {
    console.error('清除数据失败:', error);
    res.status(500).json({ success: false, message: '清除数据失败', error: error.message });
  }
});

module.exports = router;
