const express = require('express');
const bodyParser = require('body-parser');
const {
  initDatabase,
  createTask,
  updateTaskStatus,
  getTaskById,
  getAllTasks,
  getStatistics,
  getExportData,
  TASK_STATUS
} = require('./database');

const app = express();
const PORT = 3000;

app.use(bodyParser.json());

app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

app.post('/api/tasks', async (req, res) => {
  try {
    const { repairTeam, repairTime, isNightRepair, fittings, valves, tools } = req.body;
    
    if (!repairTeam || !repairTime) {
      return res.status(400).json({
        success: false,
        message: '抢修队名称和抢修时间为必填项'
      });
    }
    
    const result = await createTask({
      repairTeam,
      repairTime,
      isNightRepair: isNightRepair || false,
      fittings: fittings || [],
      valves: valves || [],
      tools: tools || []
    });
    
    if (result.isDuplicate) {
      return res.status(200).json({
        success: true,
        isDuplicate: true,
        message: '检测到重复提交，返回已有记录',
        data: result.task
      });
    }
    
    res.status(201).json({
      success: true,
      isDuplicate: false,
      message: '任务创建成功',
      data: result.task
    });
  } catch (error) {
    console.error('创建任务失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

app.get('/api/tasks', async (req, res) => {
  try {
    const { status, repairTeam } = req.query;
    const filters = {};
    
    if (status) filters.status = status;
    if (repairTeam) filters.repairTeam = repairTeam;
    
    const tasks = await getAllTasks(filters);
    
    res.json({
      success: true,
      data: tasks
    });
  } catch (error) {
    console.error('查询任务列表失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

app.get('/api/tasks/:id', async (req, res) => {
  try {
    const task = await getTaskById(req.params.id);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        message: '任务不存在'
      });
    }
    
    res.json({
      success: true,
      data: task
    });
  } catch (error) {
    console.error('查询任务详情失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

app.put('/api/tasks/:id/status', async (req, res) => {
  try {
    const { status, handler } = req.body;
    
    const validStatuses = Object.values(TASK_STATUS);
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `无效的状态，有效值为: ${validStatuses.join(', ')}`
      });
    }
    
    if (!handler) {
      return res.status(400).json({
        success: false,
        message: '处理人为必填项'
      });
    }
    
    const updatedTask = await updateTaskStatus(req.params.id, status, handler);
    
    if (!updatedTask) {
      return res.status(404).json({
        success: false,
        message: '任务不存在'
      });
    }
    
    res.json({
      success: true,
      message: '状态更新成功',
      data: updatedTask
    });
  } catch (error) {
    console.error('更新任务状态失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

app.get('/api/statistics', async (req, res) => {
  try {
    const stats = await getStatistics();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('获取统计数据失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

app.get('/api/export', async (req, res) => {
  try {
    const tasks = await getExportData();
    
    const exportData = tasks.map(task => ({
      id: task.id,
      抢修队: task.repairTeam,
      抢修时间: task.repairTime,
      是否夜间抢修: task.isNightRepair ? '是' : '否',
      领用管件: task.isNightRepair ? task.fittings.join(', ') : '',
      领用阀门: task.valves.join(', '),
      领用工具: task.tools.join(', '),
      状态: task.status,
      最后处理人: task.lastHandler || '',
      创建时间: task.createdAt,
      更新时间: task.updatedAt
    }));
    
    res.json({
      success: true,
      data: exportData,
      statistics: {
        totalRecords: tasks.length,
        nightRepairCount: tasks.filter(t => t.isNightRepair).length,
        byStatus: tasks.reduce((acc, t) => {
          acc[t.status] = (acc[t.status] || 0) + 1;
          return acc;
        }, {})
      }
    });
  } catch (error) {
    console.error('导出数据失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

app.get('/api/status-options', (req, res) => {
  res.json({
    success: true,
    data: Object.values(TASK_STATUS)
  });
});

async function startServer() {
  try {
    await initDatabase();
    console.log('数据库初始化完成');
    
    app.listen(PORT, () => {
      console.log(`服务器运行在 http://localhost:${PORT}`);
      console.log('API 端点:');
      console.log('  POST   /api/tasks         - 提交物资领用任务');
      console.log('  GET    /api/tasks         - 查询任务列表');
      console.log('  GET    /api/tasks/:id     - 查询任务详情');
      console.log('  PUT    /api/tasks/:id/status - 更新任务状态');
      console.log('  GET    /api/statistics    - 获取统计数据');
      console.log('  GET    /api/export        - 导出数据');
      console.log('  GET    /api/status-options - 获取状态选项');
    });
  } catch (error) {
    console.error('启动服务器失败:', error);
    process.exit(1);
  }
}

startServer();
