import express from 'express';
import { BottleService, TaskService, BusinessError } from './services';
import { loadSeedData } from './seed';

const app = express();
const PORT = 3000;

app.use(express.json());

app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '水质采样瓶流转系统运行正常' });
});

app.post('/api/seed', (req, res) => {
  loadSeedData();
  res.json({ success: true, message: '种子数据加载完成' });
});

app.get('/api/tasks', (req, res) => {
  const tasks = TaskService.getAllTasks();
  res.json({ success: true, data: tasks });
});

app.get('/api/tasks/:id', (req, res) => {
  const task = TaskService.getTaskById(req.params.id);
  if (!task) {
    return res.status(404).json({ success: false, error: '任务不存在' });
  }
  res.json({ success: true, data: task });
});

app.get('/api/bottles', (req, res) => {
  const bottles = BottleService.getAllBottles();
  res.json({ success: true, data: bottles });
});

app.get('/api/bottles/:bottleNo', (req, res) => {
  const bottle = BottleService.getBottleByNo(req.params.bottleNo);
  if (!bottle) {
    return res.status(404).json({ success: false, error: '采样瓶不存在' });
  }
  res.json({ success: true, data: bottle });
});

app.get('/api/bottles/:bottleNo/trail', (req, res) => {
  try {
    const trail = BottleService.getBottleTrail(req.params.bottleNo);
    res.json({ success: true, data: trail });
  } catch (error) {
    if (error instanceof BusinessError) {
      return res.status(400).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: '服务器错误' });
  }
});

app.post('/api/bottles/:bottleNo/bind', (req, res) => {
  try {
    const { taskId, handler } = req.body;
    if (!taskId || !handler) {
      return res.status(400).json({ success: false, error: 'taskId 和 handler 是必填项' });
    }
    const bottle = BottleService.bindToTask(req.params.bottleNo, taskId, handler);
    res.json({ success: true, data: bottle, message: '绑定成功' });
  } catch (error) {
    if (error instanceof BusinessError) {
      return res.status(400).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: '服务器错误' });
  }
});

app.post('/api/bottles/:bottleNo/sample', (req, res) => {
  try {
    const { handler } = req.body;
    if (!handler) {
      return res.status(400).json({ success: false, error: 'handler 是必填项' });
    }
    const bottle = BottleService.sample(req.params.bottleNo, handler);
    res.json({ success: true, data: bottle, message: '采样成功' });
  } catch (error) {
    if (error instanceof BusinessError) {
      return res.status(400).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: '服务器错误' });
  }
});

app.post('/api/bottles/:bottleNo/cold-store', (req, res) => {
  try {
    const { handler, temperature } = req.body;
    if (!handler) {
      return res.status(400).json({ success: false, error: 'handler 是必填项' });
    }
    const bottle = BottleService.coldStore(req.params.bottleNo, handler, temperature || 4);
    res.json({ success: true, data: bottle, message: '冷藏成功' });
  } catch (error) {
    if (error instanceof BusinessError) {
      return res.status(400).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: '服务器错误' });
  }
});

app.post('/api/bottles/:bottleNo/transfer', (req, res) => {
  try {
    const { handler } = req.body;
    if (!handler) {
      return res.status(400).json({ success: false, error: 'handler 是必填项' });
    }
    const bottle = BottleService.transfer(req.params.bottleNo, handler);
    res.json({ success: true, data: bottle, message: '交接成功' });
  } catch (error) {
    if (error instanceof BusinessError) {
      return res.status(400).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: '服务器错误' });
  }
});

app.post('/api/bottles/:bottleNo/receive', (req, res) => {
  try {
    const { handler } = req.body;
    if (!handler) {
      return res.status(400).json({ success: false, error: 'handler 是必填项' });
    }
    const bottle = BottleService.receive(req.params.bottleNo, handler);
    res.json({ success: true, data: bottle, message: '接收成功' });
  } catch (error) {
    if (error instanceof BusinessError) {
      return res.status(400).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: '服务器错误' });
  }
});

app.post('/api/bottles/:bottleNo/reject', (req, res) => {
  try {
    const { handler, reason } = req.body;
    if (!handler || !reason) {
      return res.status(400).json({ success: false, error: 'handler 和 reason 是必填项' });
    }
    const bottle = BottleService.reject(req.params.bottleNo, handler, reason);
    res.json({ success: true, data: bottle, message: '退样成功' });
  } catch (error) {
    if (error instanceof BusinessError) {
      return res.status(400).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: '服务器错误' });
  }
});

app.post('/api/bottles/:bottleNo/test', (req, res) => {
  try {
    const { handler } = req.body;
    if (!handler) {
      return res.status(400).json({ success: false, error: 'handler 是必填项' });
    }
    const bottle = BottleService.test(req.params.bottleNo, handler);
    res.json({ success: true, data: bottle, message: '检测完成' });
  } catch (error) {
    if (error instanceof BusinessError) {
      return res.status(400).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: '服务器错误' });
  }
});

app.post('/api/bottles/:bottleNo/return', (req, res) => {
  try {
    const { handler } = req.body;
    if (!handler) {
      return res.status(400).json({ success: false, error: 'handler 是必填项' });
    }
    const bottle = BottleService.returnBottle(req.params.bottleNo, handler);
    res.json({ success: true, data: bottle, message: '归还成功' });
  } catch (error) {
    if (error instanceof BusinessError) {
      return res.status(400).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: '服务器错误' });
  }
});

app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(error);
  res.status(500).json({ success: false, error: '服务器内部错误' });
});

app.listen(PORT, () => {
  console.log(`🚀 水质采样瓶流转系统启动成功！`);
  console.log(`📡 服务地址: http://localhost:${PORT}`);
  console.log(`🔧 健康检查: http://localhost:${PORT}/api/health`);
  console.log(``);
  console.log(`📖 使用说明:`);
  console.log(`  1. 加载种子数据: POST /api/seed`);
  console.log(`  2. 查看所有任务: GET /api/tasks`);
  console.log(`  3. 查看所有瓶子: GET /api/bottles`);
  console.log(`  4. 查看瓶子轨迹: GET /api/bottles/:bottleNo/trail`);
});
