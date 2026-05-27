const express = require('express');
const bodyParser = require('body-parser');
const { initDatabase } = require('./database');
const {
  createTask,
  getTaskById,
  getTaskList,
  getStatistics,
  exportTask,
  updateTaskStatus,
  TASK_STATUSES
} = require('./processor');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

app.post('/api/tasks', (req, res) => {
  try {
    const { material, handler_id } = req.body;
    
    if (!material || !material.records || !Array.isArray(material.records)) {
      return res.status(400).json({
        code: 400,
        message: '缺少有效的材料数据，material.records 必须是数组',
        data: null
      });
    }

    const result = createTask(material, handler_id);

    if (result.is_duplicate) {
      return res.status(200).json({
        code: 200,
        message: '重复提交，返回已有任务结果',
        data: {
          is_duplicate: true,
          task: {
            id: result.task.id,
            status: result.task.status,
            submit_time: result.task.submit_time,
            total_records: result.task.total_records,
            valid_records: result.task.valid_records,
            error_records: result.task.error_records
          }
        }
      });
    }

    res.status(201).json({
      code: 201,
      message: '提交成功',
      data: {
        is_duplicate: false,
        task: result.task
      }
    });
  } catch (error) {
    console.error('提交任务失败:', error);
    res.status(500).json({
      code: 500,
      message: '服务器内部错误: ' + error.message,
      data: null
    });
  }
});

app.get('/api/tasks', (req, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;
    
    const parsedLimit = Math.min(parseInt(limit) || 50, 100);
    const parsedOffset = parseInt(offset) || 0;

    const tasks = getTaskList(status, parsedLimit, parsedOffset);
    const stats = getStatistics();

    res.status(200).json({
      code: 200,
      message: '获取成功',
      data: {
        tasks,
        statistics: stats,
        pagination: {
          limit: parsedLimit,
          offset: parsedOffset
        }
      }
    });
  } catch (error) {
    console.error('获取任务列表失败:', error);
    res.status(500).json({
      code: 500,
      message: '服务器内部错误: ' + error.message,
      data: null
    });
  }
});

app.get('/api/tasks/:taskId', (req, res) => {
  try {
    const { taskId } = req.params;
    const task = getTaskById(taskId);

    if (!task) {
      return res.status(404).json({
        code: 404,
        message: '任务不存在',
        data: null
      });
    }

    res.status(200).json({
      code: 200,
      message: '获取成功',
      data: {
        id: task.id,
        status: task.status,
        submit_time: task.submit_time,
        export_time: task.export_time,
        total_records: task.total_records,
        valid_records: task.valid_records,
        error_records: task.error_records,
        handler: task.handler,
        records: task.records,
        errors: task.errors
      }
    });
  } catch (error) {
    console.error('获取任务详情失败:', error);
    res.status(500).json({
      code: 500,
      message: '服务器内部错误: ' + error.message,
      data: null
    });
  }
});

app.patch('/api/tasks/:taskId/status', (req, res) => {
  try {
    const { taskId } = req.params;
    const { status, handler_id } = req.body;

    if (!TASK_STATUSES.includes(status)) {
      return res.status(400).json({
        code: 400,
        message: '无效的状态值，允许值: ' + TASK_STATUSES.join(', '),
        data: null
      });
    }

    const success = updateTaskStatus(taskId, status, handler_id);

    if (!success) {
      return res.status(404).json({
        code: 404,
        message: '任务不存在',
        data: null
      });
    }

    res.status(200).json({
      code: 200,
      message: '状态更新成功',
      data: { task_id: taskId, status }
    });
  } catch (error) {
    console.error('更新任务状态失败:', error);
    res.status(500).json({
      code: 500,
      message: '服务器内部错误: ' + error.message,
      data: null
    });
  }
});

app.post('/api/tasks/:taskId/export', (req, res) => {
  try {
    const { taskId } = req.params;
    const { handler_id } = req.body;

    const result = exportTask(taskId, handler_id);

    res.status(200).json({
      code: 200,
      message: '导出成功',
      data: result
    });
  } catch (error) {
    console.error('导出任务失败:', error);
    
    if (error.message === '任务不存在') {
      return res.status(404).json({
        code: 404,
        message: '任务不存在',
        data: null
      });
    }

    res.status(500).json({
      code: 500,
      message: '服务器内部错误: ' + error.message,
      data: null
    });
  }
});

app.get('/api/statistics', (req, res) => {
  try {
    const stats = getStatistics();

    res.status(200).json({
      code: 200,
      message: '获取成功',
      data: stats
    });
  } catch (error) {
    console.error('获取统计数据失败:', error);
    res.status(500).json({
      code: 500,
      message: '服务器内部错误: ' + error.message,
      data: null
    });
  }
});

app.get('/health', (req, res) => {
  res.status(200).json({
    code: 200,
    message: '服务运行正常',
    data: {
      timestamp: Date.now(),
      service: 'smart-streetlight-repair-api'
    }
  });
});

app.use((req, res) => {
  res.status(404).json({
    code: 404,
    message: '接口不存在',
    data: null
  });
});

initDatabase();

app.listen(PORT, () => {
  console.log(`智慧路灯故障派修 API 服务已启动`);
  console.log(`服务地址: http://localhost:${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/health`);
});

module.exports = app;