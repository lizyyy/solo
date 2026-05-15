const express = require('express');
const { body, validationResult } = require('express-validator');
const TaskService = require('../services/TaskService');
const TaskQueue = require('../services/TaskQueue');
const AuthService = require('../services/AuthService');
const db = require('../config/database');

const router = express.Router();

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

router.post('/create',
  body('templateId').notEmpty().withMessage('模板ID不能为空'),
  body('taskName').notEmpty().withMessage('任务名称不能为空'),
  body('parameters').isObject().withMessage('参数必须是对象'),
  validate,
  async (req, res) => {
    try {
      const { templateId, taskName, parameters, createdBy } = req.body;
      
      const result = await TaskService.createTask(templateId, taskName, parameters, createdBy);
      
      if (result.isNew) {
        TaskQueue.addTask(result.taskId);
      }
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('创建任务失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

router.get('/list', async (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      templateId: req.query.templateId,
      keyword: req.query.keyword,
      limit: req.query.limit ? parseInt(req.query.limit) : null,
      offset: req.query.offset ? parseInt(req.query.offset) : null
    };
    
    const tasks = await TaskService.getTaskList(filters);
    
    res.json({
      success: true,
      data: tasks
    });
  } catch (error) {
    console.error('获取任务列表失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    const task = await TaskService.getTaskDetail(taskId);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        error: '任务不存在'
      });
    }
    
    res.json({
      success: true,
      data: task
    });
  } catch (error) {
    console.error('获取任务详情失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/:taskId/progress', async (req, res) => {
  try {
    const { taskId } = req.params;
    const progress = await TaskService.getTaskProgress(taskId);
    
    if (!progress) {
      return res.status(404).json({
        success: false,
        error: '任务不存在'
      });
    }
    
    res.json({
      success: true,
      data: progress
    });
  } catch (error) {
    console.error('获取任务进度失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/:taskId/retry', async (req, res) => {
  try {
    const { taskId } = req.params;
    const result = await TaskService.retryTask(taskId);
    
    TaskQueue.addTask(taskId);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('重试任务失败:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/:taskId/authorize-download', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { authorizedBy } = req.body;
    
    const auth = await AuthService.createDownloadAuthorization(taskId, authorizedBy);
    
    res.json({
      success: true,
      data: auth
    });
  } catch (error) {
    console.error('创建下载授权失败:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/queue/status', async (req, res) => {
  try {
    const status = TaskQueue.getQueueStatus();
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/batch/import', async (req, res) => {
  try {
    const { tasks, createdBy } = req.body;
    
    if (!Array.isArray(tasks) || tasks.length === 0) {
      return res.status(400).json({
        success: false,
        error: '任务列表不能为空'
      });
    }

    const results = [];
    for (const task of tasks) {
      try {
        const result = await TaskService.createTask(
          task.templateId,
          task.taskName,
          task.parameters,
          createdBy
        );
        if (result.isNew) {
          TaskQueue.addTask(result.taskId);
        }
        results.push({ ...result, taskData: task, success: true });
      } catch (error) {
        results.push({ taskData: task, success: false, error: error.message });
      }
    }

    const successCount = results.filter(r => r.success).length;
    
    res.json({
      success: true,
      data: {
        total: tasks.length,
        successCount,
        failedCount: tasks.length - successCount,
        results
      }
    });
  } catch (error) {
    console.error('批量导入失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/templates/list', async (req, res) => {
  try {
    db.all(
      `SELECT * FROM report_templates WHERE is_active = 1 ORDER BY created_at DESC`,
      (err, templates) => {
        if (err) throw err;
        res.json({
          success: true,
          data: templates.map(t => ({
            ...t,
            template_config: JSON.parse(t.template_config)
          }))
        });
      }
    );
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
