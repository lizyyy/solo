const express = require('express');
const { Parser } = require('json2csv');
const { initDatabase } = require('./database');
const approvalService = require('./approvalService');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

app.post('/api/approvals', async (req, res) => {
  try {
    const result = await approvalService.createApproval(req.body);
    if (!result.success) {
      return res.status(result.code).json(result);
    }
    res.status(201).json(result);
  } catch (err) {
    console.error('Create approval error:', err);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: '服务器内部错误，请稍后重试或联系管理员'
    });
  }
});

app.get('/api/approvals', async (req, res) => {
  try {
    const result = await approvalService.listApprovals(req.query);
    res.json(result);
  } catch (err) {
    console.error('List approvals error:', err);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: '服务器内部错误，请稍后重试或联系管理员'
    });
  }
});

app.get('/api/approvals/:id', async (req, res) => {
  try {
    const result = await approvalService.getApproval(req.params.id);
    if (!result.success) {
      return res.status(result.code).json(result);
    }
    res.json(result);
  } catch (err) {
    console.error('Get approval error:', err);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: '服务器内部错误，请稍后重试或联系管理员'
    });
  }
});

app.get('/api/approvals/:id/history', async (req, res) => {
  try {
    const result = await approvalService.getHistory(req.params.id);
    if (!result.success) {
      return res.status(result.code).json(result);
    }
    res.json(result);
  } catch (err) {
    console.error('Get history error:', err);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: '服务器内部错误，请稍后重试或联系管理员'
    });
  }
});

app.patch('/api/approvals/:id/status', async (req, res) => {
  try {
    const { status, operator, comment } = req.body;
    if (!status || !operator) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'status 和 operator 不能为空',
        details: ['status 不能为空', 'operator 不能为空']
      });
    }
    const result = await approvalService.updateStatus(req.params.id, status, operator, comment);
    if (!result.success) {
      return res.status(result.code).json(result);
    }
    res.json(result);
  } catch (err) {
    console.error('Update status error:', err);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: '服务器内部错误，请稍后重试或联系管理员'
    });
  }
});

app.post('/api/approvals/:id/recall', async (req, res) => {
  try {
    const { operator, comment } = req.body;
    if (!operator) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'operator 不能为空',
        details: ['operator 不能为空']
      });
    }
    const result = await approvalService.recallApproval(req.params.id, operator, comment);
    if (!result.success) {
      return res.status(result.code).json(result);
    }
    res.json(result);
  } catch (err) {
    console.error('Recall approval error:', err);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: '服务器内部错误，请稍后重试或联系管理员'
    });
  }
});

app.post('/api/approvals/:id/resubmit', async (req, res) => {
  try {
    const { operator, ...data } = req.body;
    if (!operator) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'operator 不能为空',
        details: ['operator 不能为空']
      });
    }
    const result = await approvalService.resubmitApproval(req.params.id, data, operator);
    if (!result.success) {
      return res.status(result.code).json(result);
    }
    res.json(result);
  } catch (err) {
    console.error('Resubmit approval error:', err);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: '服务器内部错误，请稍后重试或联系管理员'
    });
  }
});

app.get('/api/approvals/export/csv', async (req, res) => {
  try {
    const result = await approvalService.exportApprovals(req.query);
    if (!result.success) {
      return res.status(result.code || 500).json(result);
    }

    if (result.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'NO_DATA',
        message: '没有可导出的数据'
      });
    }

    const parser = new Parser();
    const csv = parser.parse(result.data);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="firmware-approvals-${Date.now()}.csv"`);
    res.send('\uFEFF' + csv);
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: '服务器内部错误，请稍后重试或联系管理员'
    });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

async function startServer() {
  const fs = require('fs');
  const path = require('path');
  const dataDir = path.join(__dirname, '../data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  await initDatabase();
  console.log('Database initialized');

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log('API Endpoints:');
    console.log('  POST   /api/approvals              - 创建审批单');
    console.log('  GET    /api/approvals              - 审批单列表');
    console.log('  GET    /api/approvals/:id          - 审批单详情');
    console.log('  GET    /api/approvals/:id/history  - 审批单历史');
    console.log('  PATCH  /api/approvals/:id/status   - 更新状态');
    console.log('  POST   /api/approvals/:id/recall   - 撤回审批');
    console.log('  POST   /api/approvals/:id/resubmit - 重新提交');
    console.log('  GET    /api/approvals/export/csv   - 导出 CSV');
    console.log('  GET    /api/health                 - 健康检查');
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
