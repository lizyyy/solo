const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const service = require('./service');
const storage = require('./storage');

const app = express();
const PORT = 8080;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../public')));

storage.ensureDataDir();

function getOperator(req) {
  return {
    user: req.headers['x-operator'] || 'anonymous',
    ip: req.ip || req.connection.remoteAddress
  };
}

app.get('/api/stats', (req, res) => {
  const result = service.getDashboardStats();
  res.json(result);
});

app.post('/api/invitations', (req, res) => {
  const { inviterEmail, inviteeEmail, roleId, projectId } = req.body;
  const operator = getOperator(req);
  const result = service.createInvitation(inviterEmail, inviteeEmail, roleId, projectId, operator);
  res.status(result.success ? 200 : 400).json(result);
});

app.get('/api/invitations', (req, res) => {
  const result = service.getInvitations(req.query);
  res.json(result);
});

app.get('/api/invitations/:id', (req, res) => {
  const result = service.getInvitationById(req.params.id);
  res.status(result.success ? 200 : 404).json(result);
});

app.post('/api/invitations/:id/revoke', (req, res) => {
  const { reason } = req.body;
  const operator = getOperator(req);
  const result = service.revokeInvitation(req.params.id, reason, operator);
  res.status(result.success ? 200 : 400).json(result);
});

app.post('/api/invitations/use/:token', (req, res) => {
  const { userEmail } = req.body;
  const operator = getOperator(req);
  const result = service.useInvitation(req.params.token, userEmail, operator);
  res.status(result.success ? 200 : 400).json(result);
});

app.get('/api/approvals', (req, res) => {
  const result = service.getApprovals(req.query);
  res.json(result);
});

app.post('/api/approvals/:id', (req, res) => {
  const { action, approver, reason } = req.body;
  const result = service.processApproval(req.params.id, action, approver, reason);
  res.status(result.success ? 200 : 400).json(result);
});

app.get('/api/roles', (req, res) => {
  const result = service.getRoles();
  res.json(result);
});

app.get('/api/domains', (req, res) => {
  const result = service.getDomains();
  res.json(result);
});

app.post('/api/domains', (req, res) => {
  const { domain } = req.body;
  const operator = getOperator(req);
  const result = service.addDomain(domain, operator);
  res.status(result.success ? 200 : 400).json(result);
});

app.get('/api/audit', (req, res) => {
  const result = service.getAuditLogs(req.query);
  res.json(result);
});

app.get('/api/export', (req, res) => {
  const result = service.exportAllData();
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename=invitation-export-${new Date().toISOString().split('T')[0]}.json`);
  res.json(result);
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, () => {
  console.log(`团队邀请权限 API 服务已启动: http://localhost:${PORT}`);
  console.log(`前端控制台: http://localhost:${PORT}`);
});
