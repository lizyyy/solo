const express = require('express');
const bodyParser = require('body-parser');
const db = require('./database');
const engine = require('./engine');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());

db.initMockData();

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/api/v1/tickets', (req, res) => {
  try {
    const required = ['title', 'creator', 'repair_actions'];
    for (const field of required) {
      if (!req.body[field]) {
        return res.status(400).json({ error: `缺少必填字段: ${field}` });
      }
    }
    const ticket = engine.createTicket(req.body);
    res.status(201).json(ticket);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/v1/tickets', (req, res) => {
  const tickets = engine.listTickets();
  res.json(tickets);
});

app.get('/api/v1/tickets/:ticketId', (req, res) => {
  const details = engine.getTicketDetails(req.params.ticketId);
  if (!details) {
    return res.status(404).json({ error: '工单不存在' });
  }
  res.json(details);
});

app.post('/api/v1/tickets/:ticketId/repair-actions', (req, res) => {
  try {
    const ticket = engine.updateRepairActions(req.params.ticketId, req.body.repair_actions);
    res.json(ticket);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/v1/tickets/:ticketId/precheck', (req, res) => {
  try {
    const precheck = engine.runPrecheck(req.params.ticketId);
    res.json(precheck);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/v1/tickets/:ticketId/approve', (req, res) => {
  try {
    const approval = engine.approveTicket(req.params.ticketId, req.body);
    res.json(approval);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/v1/tickets/:ticketId/reject', (req, res) => {
  try {
    const approval = engine.rejectTicket(req.params.ticketId, req.body);
    res.json(approval);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/v1/tickets/:ticketId/execute', (req, res) => {
  try {
    const execution = engine.executeTicket(req.params.ticketId, req.body);
    res.json(execution);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/v1/tickets/:ticketId/rollback', (req, res) => {
  try {
    const rollback = engine.rollbackTicket(req.params.ticketId, req.body);
    res.json(rollback);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/v1/tickets/:ticketId/close', (req, res) => {
  try {
    const ticket = engine.closeTicket(req.params.ticketId, req.body);
    res.json(ticket);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/v1/audits/:auditId', (req, res) => {
  const report = engine.getAuditReport(req.params.auditId);
  if (!report) {
    return res.status(404).json({ error: '审计报告不存在' });
  }
  res.json(report);
});

app.get('/api/v1/data/orders/:id', (req, res) => {
  const order = db.orders.get(req.params.id);
  if (!order) return res.status(404).json({ error: '订单不存在' });
  res.json(order);
});

app.get('/api/v1/data/members/:id', (req, res) => {
  const member = db.members.get(req.params.id);
  if (!member) return res.status(404).json({ error: '会员不存在' });
  res.json(member);
});

app.get('/api/v1/data/invoices/:id', (req, res) => {
  const invoice = db.invoices.get(req.params.id);
  if (!invoice) return res.status(404).json({ error: '发票不存在' });
  res.json(invoice);
});

app.listen(PORT, () => {
  console.log(`数据修复工单 API 运行在 http://localhost:${PORT}`);
  console.log(`\n可用接口:`);
  console.log(`  GET  /health - 健康检查`);
  console.log(`  POST /api/v1/tickets - 创建工单`);
  console.log(`  GET  /api/v1/tickets - 工单列表`);
  console.log(`  GET  /api/v1/tickets/:ticketId - 工单详情`);
  console.log(`  POST /api/v1/tickets/:ticketId/repair-actions - 修改修复动作(仅草稿)`);
  console.log(`  POST /api/v1/tickets/:ticketId/precheck - 执行预检`);
  console.log(`  POST /api/v1/tickets/:ticketId/approve - 审批`);
  console.log(`  POST /api/v1/tickets/:ticketId/reject - 驳回`);
  console.log(`  POST /api/v1/tickets/:ticketId/execute - 执行修复`);
  console.log(`  POST /api/v1/tickets/:ticketId/rollback - 回滚`);
  console.log(`  POST /api/v1/tickets/:ticketId/close - 关闭工单`);
  console.log(`  GET  /api/v1/audits/:auditId - 审计报告`);
  console.log(`\n数据查询(用于验证):`);
  console.log(`  GET  /api/v1/data/orders/:id - 查询订单`);
  console.log(`  GET  /api/v1/data/members/:id - 查询会员`);
  console.log(`  GET  /api/v1/data/invoices/:id - 查询发票`);
});
