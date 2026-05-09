const express = require('express');
const { initDb } = require('./db');
const service = require('./service');

const app = express();
app.use(express.json());

const PORT = 3001;

function jsonResponse(res, result, statusCode = 200) {
  if (result.success) {
    res.status(statusCode).json({
      成功: true,
      提示: result.message || null,
      数据: result.data || null
    });
  } else {
    res.status(result.duplicate ? 200 : 400).json({
      成功: false,
      重复操作: result.duplicate || false,
      原因: result.reason || '操作失败',
      已有数据: result.data || null
    });
  }
}

app.post('/api/offboarding-forms', (req, res) => {
  const { employee_id, employee_name, department, last_day, operator } = req.body;
  
  if (!employee_id || !employee_name || !department || !last_day || !operator) {
    return res.status(400).json({
      成功: false,
      原因: '缺少必填信息：员工工号、姓名、部门、最后工作日、操作人'
    });
  }

  const result = service.createOffboardingForm(req.body, operator);
  jsonResponse(res, result, 201);
});

app.get('/api/offboarding-forms', (req, res) => {
  const forms = service.getAllForms();
  res.json({
    成功: true,
    数据: forms
  });
});

app.get('/api/offboarding-forms/:id', (req, res) => {
  const form = service.getFormById(req.params.id);
  if (!form) {
    return res.status(404).json({ 成功: false, 原因: '找不到该离职单' });
  }
  
  const permissions = service.getPermissionsByForm(req.params.id);
  res.json({
    成功: true,
    数据: {
      离职单: form,
      权限清单: permissions
    }
  });
});

app.post('/api/offboarding-forms/:id/generate-inventory', (req, res) => {
  const { operator } = req.body;
  if (!operator) {
    return res.status(400).json({ 成功: false, 原因: '请提供操作人' });
  }
  
  const result = service.generatePermissionInventory(req.params.id, operator);
  jsonResponse(res, result);
});

app.post('/api/offboarding-forms/:id/create-tasks', (req, res) => {
  const { operator } = req.body;
  if (!operator) {
    return res.status(400).json({ 成功: false, 原因: '请提供操作人' });
  }
  
  const result = service.createReclamationTasks(req.params.id, operator);
  jsonResponse(res, result);
});

app.post('/api/reclamation-tasks/:taskId/execute', (req, res) => {
  const { operator } = req.body;
  if (!operator) {
    return res.status(400).json({ 成功: false, 原因: '请提供操作人' });
  }
  
  const result = service.executeReclamationTask(req.params.taskId, operator);
  jsonResponse(res, result);
});

app.post('/api/reclamation-tasks/:taskId/retry', (req, res) => {
  const { operator } = req.body;
  if (!operator) {
    return res.status(400).json({ 成功: false, 原因: '请提供操作人' });
  }
  
  const result = service.retryFailedTask(req.params.taskId, operator);
  jsonResponse(res, result);
});

app.post('/api/exemptions', (req, res) => {
  const { form_id, inventory_id, reason, applicant } = req.body;
  if (!form_id || !inventory_id || !reason || !applicant) {
    return res.status(400).json({
      成功: false,
      原因: '缺少必填信息：离职单号、权限项ID、豁免原因、申请人'
    });
  }
  
  const result = service.applyExemption(form_id, inventory_id, reason, applicant);
  jsonResponse(res, result, 201);
});

app.post('/api/exemptions/:exemptionId/approve', (req, res) => {
  const { approver } = req.body;
  if (!approver) {
    return res.status(400).json({ 成功: false, 原因: '请提供审批人' });
  }
  
  const result = service.approveExemption(req.params.exemptionId, approver);
  jsonResponse(res, result);
});

app.get('/api/audit-report/:formId', (req, res) => {
  const result = service.getAuditReport(req.params.formId);
  jsonResponse(res, result);
});

async function start() {
  await initDb();
  
  app.listen(PORT, () => {
    console.log(`员工离职权限回收服务已启动，端口：${PORT}`);
    console.log(`服务地址：http://localhost:${PORT}`);
    console.log('');
    console.log('可用接口：');
    console.log('  POST /api/offboarding-forms              - 创建离职单');
    console.log('  GET  /api/offboarding-forms              - 查看所有离职单');
    console.log('  GET  /api/offboarding-forms/:id          - 查看离职单详情');
    console.log('  POST /api/offboarding-forms/:id/generate-inventory  - 生成权限清单');
    console.log('  POST /api/offboarding-forms/:id/create-tasks        - 创建回收任务');
    console.log('  POST /api/reclamation-tasks/:id/execute  - 执行单个回收任务');
    console.log('  POST /api/reclamation-tasks/:id/retry    - 重试失败任务');
    console.log('  POST /api/exemptions                     - 申请豁免');
    console.log('  POST /api/exemptions/:id/approve         - 审批通过豁免');
    console.log('  GET  /api/audit-report/:formId           - 查看审计报告');
    console.log('');
  });
}

start();
