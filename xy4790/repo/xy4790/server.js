const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./database');
const toolService = require('./toolService');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/tools', (req, res) => {
  try {
    const tools = toolService.getAllTools();
    res.json({ success: true, data: tools });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/tools/:id', (req, res) => {
  try {
    const tool = toolService.getToolWithDetails(parseInt(req.params.id));
    if (!tool) {
      return res.status(404).json({ success: false, error: '工具不存在' });
    }
    res.json({ success: true, data: tool });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/users', (req, res) => {
  try {
    const users = toolService.getAllUsers();
    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/logs', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const logs = toolService.getRecentLogs(limit);
    res.json({ success: true, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/tools/:id/logs', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const logs = toolService.getToolLogs(parseInt(req.params.id), limit);
    res.json({ success: true, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/tools/:id/action', (req, res) => {
  try {
    const toolId = parseInt(req.params.id);
    const { action, userId, description } = req.body;

    if (!action) {
      return res.status(400).json({ success: false, error: '缺少 action 参数' });
    }

    if (!userId) {
      return res.status(400).json({ success: false, error: '缺少 userId 参数' });
    }

    const result = toolService.performAction(toolId, userId, action, description);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/export/today', (req, res) => {
  try {
    const records = toolService.getTodayBorrowRecords();
    
    const headers = ['ID', '工具名称', '借用人', '借出时间', '归还时间', '状态'];
    const csvContent = [
      headers.join(','),
      ...records.map(r => [
        r.id,
        `"${r.tool_name}"`,
        `"${r.user_name}"`,
        r.borrowed_at,
        r.returned_at || '',
        r.status
      ].join(','))
    ].join('\n');

    const today = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=borrow-records-${today}.csv`);
    res.write('\ufeff');
    res.send(csvContent);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/status', (req, res) => {
  res.json({ 
    success: true, 
    data: {
      statuses: toolService.TOOL_STATUSES,
      actions: toolService.ACTIONS
    }
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

async function startServer() {
  await db.ready;
  app.listen(PORT, () => {
    console.log(`工具柜服务已启动: http://localhost:${PORT}`);
    console.log('按 Ctrl+C 停止服务');
  });
}

startServer().catch(err => {
  console.error('启动服务失败:', err);
  process.exit(1);
});
