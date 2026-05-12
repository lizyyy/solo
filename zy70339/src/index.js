const express = require('express');
const fs = require('fs');
const path = require('path');
const { initDb } = require('./database');
const {
  evaluateChange,
  createFreezeWindow,
  getFreezeWindow,
  getAllFreezeWindows,
  updateFreezeWindow,
  deleteFreezeWindow,
  createChangeRequest,
  getChangeRequest,
  getAllChangeRequests,
  approveException,
  rejectException,
  exportToICal
} = require('./freezeEngine');

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'change-freeze-calendar-api' });
});

app.get('/api/v1/freeze-windows', (req, res) => {
  res.json({
    data: getAllFreezeWindows(),
    count: getAllFreezeWindows().length
  });
});

app.get('/api/v1/freeze-windows/:id', (req, res) => {
  const window = getFreezeWindow(req.params.id);
  if (!window) {
    return res.status(404).json({ error: 'NOT_FOUND', message: '冻结窗口不存在' });
  }
  res.json({ data: window });
});

app.post('/api/v1/freeze-windows', (req, res) => {
  const { name, description, start_time, end_time, scope, affected_services, risk_level, allow_readonly } = req.body;
  
  if (!name || !start_time || !end_time || !scope || !risk_level) {
    return res.status(400).json({ 
      error: 'BAD_REQUEST', 
      message: '缺少必填字段: name, start_time, end_time, scope, risk_level' 
    });
  }
  
  if (!['global', 'service'].includes(scope)) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'scope 必须是 global 或 service' });
  }
  
  if (!['low', 'medium', 'high'].includes(risk_level)) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'risk_level 必须是 low, medium 或 high' });
  }
  
  if (scope === 'service' && (!affected_services || affected_services.length === 0)) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: '服务级冻结必须指定 affected_services' });
  }
  
  const result = createFreezeWindow({
    name, description, start_time, end_time, scope, affected_services, risk_level, allow_readonly
  });
  
  res.status(201).json({ data: result });
});

app.put('/api/v1/freeze-windows/:id', (req, res) => {
  const existing = getFreezeWindow(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'NOT_FOUND', message: '冻结窗口不存在' });
  }
  
  const result = updateFreezeWindow(req.params.id, req.body);
  res.json({ data: result });
});

app.delete('/api/v1/freeze-windows/:id', (req, res) => {
  const existing = getFreezeWindow(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'NOT_FOUND', message: '冻结窗口不存在' });
  }
  
  deleteFreezeWindow(req.params.id);
  res.status(204).send();
});

app.post('/api/v1/evaluate', (req, res) => {
  const { change_id, service, change_type, risk_level, planned_start, planned_end } = req.body;
  
  if (!change_id || !service || !change_type || !risk_level || !planned_start || !planned_end) {
    return res.status(400).json({ 
      error: 'BAD_REQUEST', 
      message: '缺少必填字段: change_id, service, change_type, risk_level, planned_start, planned_end' 
    });
  }
  
  if (!['normal', 'readonly', 'emergency'].includes(change_type)) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'change_type 必须是 normal, readonly 或 emergency' });
  }
  
  if (!['low', 'medium', 'high'].includes(risk_level)) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'risk_level 必须是 low, medium 或 high' });
  }
  
  const result = evaluateChange({ change_id, service, change_type, risk_level, planned_start, planned_end });
  res.json({ data: result });
});

app.post('/api/v1/change-requests', (req, res) => {
  const { change_id, service, change_type, risk_level, planned_start, planned_end, description } = req.body;
  
  if (!change_id || !service || !change_type || !risk_level || !planned_start || !planned_end) {
    return res.status(400).json({ 
      error: 'BAD_REQUEST', 
      message: '缺少必填字段: change_id, service, change_type, risk_level, planned_start, planned_end' 
    });
  }
  
  if (!['normal', 'readonly', 'emergency'].includes(change_type)) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'change_type 必须是 normal, readonly 或 emergency' });
  }
  
  if (!['low', 'medium', 'high'].includes(risk_level)) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'risk_level 必须是 low, medium 或 high' });
  }
  
  const result = createChangeRequest({ change_id, service, change_type, risk_level, planned_start, planned_end, description });
  
  if (result.error === 'DUPLICATE_CHANGE_ID') {
    return res.status(409).json(result);
  }
  
  res.status(201).json({ data: result });
});

app.get('/api/v1/change-requests', (req, res) => {
  res.json({
    data: getAllChangeRequests(),
    count: getAllChangeRequests().length
  });
});

app.get('/api/v1/change-requests/:id', (req, res) => {
  const request = getChangeRequest(req.params.id);
  if (!request) {
    return res.status(404).json({ error: 'NOT_FOUND', message: '变更申请不存在' });
  }
  res.json({ data: request });
});

app.post('/api/v1/change-requests/:id/approve-exception', (req, res) => {
  const { approver, reason, valid_from, valid_until, applicable_services } = req.body;
  
  if (!approver) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: '缺少必填字段: approver' });
  }
  
  const existing = getChangeRequest(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'NOT_FOUND', message: '变更申请不存在' });
  }
  
  const result = approveException(req.params.id, approver, reason, valid_from, valid_until, applicable_services);
  res.json({ data: result });
});

app.post('/api/v1/change-requests/:id/reject-exception', (req, res) => {
  const { approver, reason } = req.body;
  
  if (!approver) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: '缺少必填字段: approver' });
  }
  
  const existing = getChangeRequest(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'NOT_FOUND', message: '变更申请不存在' });
  }
  
  const result = rejectException(req.params.id, approver, reason);
  res.json({ data: result });
});

app.get('/api/v1/calendar.ics', (req, res) => {
  const ics = exportToICal();
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=freeze-calendar.ics');
  res.send(ics);
});

async function startServer() {
  await initDb();
  
  app.listen(PORT, () => {
    console.log(`变更冻结日历 API 已启动: http://localhost:${PORT}`);
    console.log('API 端点:');
    console.log('  GET  /health                           - 健康检查');
    console.log('  GET  /api/v1/freeze-windows          - 列表所有冻结窗口');
    console.log('  POST /api/v1/freeze-windows          - 创建冻结窗口');
    console.log('  GET  /api/v1/freeze-windows/:id      - 获取单个冻结窗口');
    console.log('  PUT  /api/v1/freeze-windows/:id      - 更新冻结窗口');
    console.log('  DELETE /api/v1/freeze-windows/:id    - 删除冻结窗口');
    console.log('  POST /api/v1/evaluate                - 评估变更是否可发布');
    console.log('  POST /api/v1/change-requests         - 创建变更申请');
    console.log('  GET  /api/v1/change-requests         - 列表所有变更申请');
    console.log('  GET  /api/v1/change-requests/:id     - 获取单个变更申请');
    console.log('  POST /api/v1/change-requests/:id/approve-exception - 审批例外通过');
    console.log('  POST /api/v1/change-requests/:id/reject-exception  - 审批例外拒绝');
    console.log('  GET  /api/v1/calendar.ics            - 导出 iCal 日历');
  });
}

startServer().catch(err => {
  console.error('启动失败:', err);
  process.exit(1);
});
