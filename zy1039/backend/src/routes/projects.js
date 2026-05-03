const express = require('express');
const router = express.Router();
const LocalStorage = require('../storage/localStorage');
const { parser, checker, StateMachineExecutor, validate } = require('../engine');

const storage = new LocalStorage();

// 获取项目列表
router.get('/', async (req, res) => {
  try {
    const result = await storage.listProjects();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 创建新项目
router.post('/', async (req, res) => {
  try {
    const projectData = req.body;
    const result = await storage.saveProject(projectData);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取项目详情
router.get('/:id', async (req, res) => {
  try {
    const result = await storage.loadProject(req.params.id);
    if (!result.success) {
      res.status(404).json(result);
      return;
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 更新项目
router.put('/:id', async (req, res) => {
  try {
    const projectData = { ...req.body, id: req.params.id };
    const result = await storage.saveProject(projectData);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 删除项目
router.delete('/:id', async (req, res) => {
  try {
    const result = await storage.deleteProject(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 导入状态机
router.post('/import', async (req, res) => {
  try {
    const { content, name } = req.body;
    if (!content) {
      res.status(400).json({ success: false, error: '缺少状态机内容' });
      return;
    }
    
    const result = await storage.importMachine(content, name || '导入的状态机');
    res.json(result);
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// 解析状态机定义（不保存）
router.post('/parse', async (req, res) => {
  try {
    const { content } = req.body;
    if (!content) {
      res.status(400).json({ success: false, error: '缺少状态机内容' });
      return;
    }
    
    const machine = parser.parse(content);
    const validationResult = validate(machine);
    
    res.json({
      success: true,
      machine,
      validation: validationResult
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// 运行状态机检查
router.post('/:id/check', async (req, res) => {
  try {
    const loadResult = await storage.loadProject(req.params.id);
    if (!loadResult.success) {
      res.status(404).json(loadResult);
      return;
    }
    
    const project = loadResult.project;
    if (!project.machine) {
      res.status(400).json({ success: false, error: '项目中没有状态机定义' });
      return;
    }
    
    const checkResults = checker.checkAll(project.machine);
    
    // 保存检查结果到项目
    project.checkResults = checkResults;
    await storage.saveProject(project);
    
    res.json({
      success: true,
      checkResults
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 执行事件序列
router.post('/:id/execute', async (req, res) => {
  try {
    const { eventSequence, context = {}, stopOnError = true } = req.body;
    
    const loadResult = await storage.loadProject(req.params.id);
    if (!loadResult.success) {
      res.status(404).json(loadResult);
      return;
    }
    
    const project = loadResult.project;
    if (!project.machine) {
      res.status(400).json({ success: false, error: '项目中没有状态机定义' });
      return;
    }
    
    const executor = new StateMachineExecutor(project.machine, context);
    const result = executor.executeSequence(eventSequence || [], stopOnError);
    
    // 保存执行历史到项目
    project.executionHistory = {
      eventSequence,
      context,
      timeline: result.timeline,
      finalState: result.finalState,
      success: result.success,
      firstFailureIndex: result.firstFailureIndex,
      executedAt: new Date().toISOString()
    };
    await storage.saveProject(project);
    
    res.json({
      success: true,
      executionResult: result
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 导出状态机定义
router.get('/:id/export', async (req, res) => {
  try {
    const format = req.query.format || 'json';
    const result = await storage.exportMachine(req.params.id, format);
    
    if (!result.success) {
      res.status(400).json(result);
      return;
    }
    
    res.setHeader('Content-Type', format === 'yaml' ? 'text/yaml' : 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.content);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
