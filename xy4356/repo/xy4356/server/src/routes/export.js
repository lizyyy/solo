import express from 'express';
import { getMissionById } from '../utils/dataStore.js';
import { generateChecklistMarkdown, generateAuditPackage } from '../utils/export.js';

const router = express.Router();

router.get('/checklist/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { format = 'markdown' } = req.query;
    
    const mission = getMissionById(id);
    
    if (!mission) {
      return res.status(404).json({ error: '任务不存在' });
    }
    
    const markdown = generateChecklistMarkdown(mission);
    
    if (format === 'json') {
      res.json({
        success: true,
        content: markdown,
        format: 'markdown'
      });
    } else if (format === 'download') {
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="checklist-${mission.id}.md"`);
      res.send(markdown);
    } else {
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.send(markdown);
    }
  } catch (error) {
    console.error('生成检查单失败:', error);
    res.status(500).json({ error: '生成检查单失败: ' + error.message });
  }
});

router.get('/audit/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { download = 'false' } = req.query;
    
    const mission = getMissionById(id);
    
    if (!mission) {
      return res.status(404).json({ error: '任务不存在' });
    }
    
    const auditPackage = generateAuditPackage(mission);
    
    if (download === 'true') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="audit-${mission.id}.json"`);
      res.send(JSON.stringify(auditPackage, null, 2));
    } else {
      res.json(auditPackage);
    }
  } catch (error) {
    console.error('生成审计包失败:', error);
    res.status(500).json({ error: '生成审计包失败: ' + error.message });
  }
});

export default router;
