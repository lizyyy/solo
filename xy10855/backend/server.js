const express = require('express');
const cors = require('cors');
const path = require('path');

const tasksRouter = require('./routes/tasks');
const downloadRouter = require('./routes/download');
const TaskService = require('./services/TaskService');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, '../frontend/build')));

app.use('/api/tasks', tasksRouter);
app.use('/api/download', downloadRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/api/cleanup-stuck', async (req, res) => {
  try {
    const result = await TaskService.cleanupStuckTasks();
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/build/index.html'));
});

setInterval(async () => {
  try {
    const result = await TaskService.cleanupStuckTasks();
    if (result.cleanedCount > 0) {
      console.log(`自动清理了 ${result.cleanedCount} 个卡住的任务`);
    }
  } catch (error) {
    console.error('自动清理任务失败:', error);
  }
}, 60 * 1000);

app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({
    success: false,
    error: '内部服务器错误'
  });
});

app.listen(PORT, () => {
  console.log(`报表生成任务 API 服务已启动`);
  console.log(`后端服务地址: http://localhost:${PORT}`);
  console.log(`API 文档: http://localhost:${PORT}/api/health`);
});

module.exports = app;
