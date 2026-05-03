const express = require('express');
const router = express.Router();
const LocalStorage = require('../storage/localStorage');
const reporter = require('../export/reporter');

const storage = new LocalStorage();

// 生成报告
router.get('/:projectId', async (req, res) => {
  try {
    const format = req.query.format || 'html';
    const { projectId } = req.params;
    
    const loadResult = await storage.loadProject(projectId);
    if (!loadResult.success) {
      res.status(404).json(loadResult);
      return;
    }
    
    const project = loadResult.project;
    
    const options = {
      project,
      machine: project.machine,
      timeline: project.executionHistory?.timeline || [],
      checkResults: project.checkResults
    };
    
    let content;
    let contentType;
    let filename;
    
    if (format === 'markdown' || format === 'md') {
      content = reporter.generateMarkdown(options);
      contentType = 'text/markdown';
      filename = `${project.name || 'report'}.md`;
    } else {
      content = reporter.generateHTML(options);
      contentType = 'text/html';
      filename = `${project.name || 'report'}.html`;
    }
    
    if (req.query.download === 'true') {
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    }
    
    res.setHeader('Content-Type', `${contentType}; charset=utf-8`);
    res.send(content);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 从临时数据生成报告（不依赖存储项目）
router.post('/generate', async (req, res) => {
  try {
    const { machine, timeline, checkResults, project, format = 'html' } = req.body;
    
    const options = {
      project: project || { name: '临时报告' },
      machine,
      timeline: timeline || [],
      checkResults
    };
    
    let content;
    let contentType;
    
    if (format === 'markdown' || format === 'md') {
      content = reporter.generateMarkdown(options);
      contentType = 'text/markdown';
    } else {
      content = reporter.generateHTML(options);
      contentType = 'text/html';
    }
    
    res.setHeader('Content-Type', `${contentType}; charset=utf-8`);
    res.send(content);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
