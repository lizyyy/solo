const express = require('express');
const router = express.Router();
const db = require('./database');
const PermissionService = require('./services/permissionService');
const { v4: uuidv4 } = require('uuid');
const { Parser } = require('json2csv');

router.get('/tenants', (req, res) => {
  db.all(`SELECT * FROM tenants`, (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows);
  });
});

router.post('/tenants', (req, res) => {
  const { name } = req.body;
  const id = uuidv4();
  db.run(`INSERT INTO tenants (id, name) VALUES (?, ?)`, [id, name], (err) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json({ id, name });
  });
});

router.get('/tenants/:tenantId/departments', (req, res) => {
  db.all(`SELECT * FROM departments WHERE tenant_id = ?`, [req.params.tenantId], (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows);
  });
});

router.post('/tenants/:tenantId/departments', (req, res) => {
  const { name, parent_id } = req.body;
  const id = uuidv4();
  db.run(
    `INSERT INTO departments (id, tenant_id, name, parent_id) VALUES (?, ?, ?, ?)`,
    [id, req.params.tenantId, name, parent_id],
    (err) => {
      if (err) res.status(500).json({ error: err.message });
      else res.json({ id, name, tenant_id: req.params.tenantId, parent_id });
    }
  );
});

router.get('/departments/:departmentId/roles', (req, res) => {
  db.all(`SELECT * FROM roles WHERE department_id = ?`, [req.params.departmentId], (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows);
  });
});

router.post('/departments/:departmentId/roles', (req, res) => {
  const { name, description } = req.body;
  const id = uuidv4();
  db.run(
    `INSERT INTO roles (id, department_id, name, description) VALUES (?, ?, ?, ?)`,
    [id, req.params.departmentId, name, description],
    (err) => {
      if (err) res.status(500).json({ error: err.message });
      else res.json({ id, name, description, department_id: req.params.departmentId });
    }
  );
});

router.get('/api-resources', (req, res) => {
  db.all(`SELECT * FROM api_resources`, (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows);
  });
});

router.post('/api-resources', (req, res) => {
  const { name, path, method, description, sensitivity_level } = req.body;
  const id = uuidv4();
  db.run(
    `INSERT INTO api_resources (id, name, path, method, description, sensitivity_level) VALUES (?, ?, ?, ?, ?, ?)`,
    [id, name, path, method, description, sensitivity_level || 'normal'],
    (err) => {
      if (err) res.status(500).json({ error: err.message });
      else res.json({ id, name, path, method, description, sensitivity_level });
    }
  );
});

router.get('/tenants/:tenantId/permission-packages', (req, res) => {
  db.all(`SELECT * FROM permission_packages WHERE tenant_id = ?`, [req.params.tenantId], (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows);
  });
});

router.post('/tenants/:tenantId/permission-packages', (req, res) => {
  const { name, description, is_inheritable } = req.body;
  const id = uuidv4();
  db.run(
    `INSERT INTO permission_packages (id, tenant_id, name, description, is_inheritable) VALUES (?, ?, ?, ?, ?)`,
    [id, req.params.tenantId, name, description, is_inheritable !== false ? 1 : 0],
    (err) => {
      if (err) res.status(500).json({ error: err.message });
      else res.json({ id, name, description, tenant_id: req.params.tenantId, is_inheritable });
    }
  );
});

router.post('/permission-packages/:packageId/permissions', (req, res) => {
  const { api_resource_id, access_level } = req.body;
  const id = uuidv4();
  db.run(
    `INSERT INTO package_permissions (id, package_id, api_resource_id, access_level) VALUES (?, ?, ?, ?)`,
    [id, req.params.packageId, api_resource_id, access_level || 'read'],
    (err) => {
      if (err) res.status(500).json({ error: err.message });
      else res.json({ id, package_id: req.params.packageId, api_resource_id, access_level });
    }
  );
});

router.post('/roles/:roleId/assign-package', (req, res) => {
  const { package_id, assigned_by } = req.body;
  const id = uuidv4();
  db.run(
    `INSERT INTO role_permissions (id, role_id, package_id, assigned_by) VALUES (?, ?, ?, ?)`,
    [id, req.params.roleId, package_id, assigned_by],
    (err) => {
      if (err) res.status(500).json({ error: err.message });
      else res.json({ id, role_id: req.params.roleId, package_id, assigned_by });
    }
  );
});

router.get('/roles/:roleId/permissions', async (req, res) => {
  try {
    const { role_id, department_id, tenant_id } = req.query;
    const permissions = await PermissionService.getRolePermissionsWithInheritance(
      role_id || req.params.roleId,
      department_id,
      tenant_id
    );
    res.json(permissions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/call-api', async (req, res) => {
  try {
    const { tenant_id, department_id, role_id, api_resource_id, requester, input } = req.body;
    const result = await PermissionService.callApi(
      tenant_id,
      department_id,
      role_id,
      api_resource_id,
      requester,
      input
    );
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/approvals', (req, res) => {
  const { tenant_id, status } = req.query;
  let query = `SELECT * FROM approval_records WHERE 1=1`;
  const params = [];
  
  if (tenant_id) {
    query += ` AND tenant_id = ?`;
    params.push(tenant_id);
  }
  if (status) {
    query += ` AND status = ?`;
    params.push(status);
  }
  query += ` ORDER BY created_at DESC`;
  
  db.all(query, params, (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows);
  });
});

router.post('/approvals', async (req, res) => {
  try {
    const { tenant_id, department_id, role_id, package_id, requester, request_type, request_data } = req.body;
    const approvalId = await PermissionService.createApproval(
      tenant_id,
      department_id,
      role_id,
      package_id,
      requester,
      request_type,
      request_data
    );
    res.json({ id: approvalId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/approvals/:approvalId/approve', async (req, res) => {
  try {
    const { approver, comment } = req.body;
    await PermissionService.approveApproval(req.params.approvalId, approver, comment);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/approvals/:approvalId/reject', async (req, res) => {
  try {
    const { approver, comment } = req.body;
    await PermissionService.rejectApproval(req.params.approvalId, approver, comment);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/rejections', (req, res) => {
  const { tenant_id, resolved } = req.query;
  let query = `SELECT * FROM call_rejections WHERE 1=1`;
  const params = [];
  
  if (tenant_id) {
    query += ` AND tenant_id = ?`;
    params.push(tenant_id);
  }
  if (resolved !== undefined) {
    query += ` AND resolved = ?`;
    params.push(resolved ? 1 : 0);
  }
  query += ` ORDER BY created_at DESC`;
  
  db.all(query, params, (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows);
  });
});

router.post('/rejections/:rejectionId/resolve', async (req, res) => {
  try {
    const { resolved_by } = req.body;
    await PermissionService.resolveRejection(req.params.rejectionId, resolved_by);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/request-logs', (req, res) => {
  const { tenant_id, limit = 100 } = req.query;
  let query = `SELECT * FROM request_logs WHERE 1=1`;
  const params = [];
  
  if (tenant_id) {
    query += ` AND tenant_id = ?`;
    params.push(tenant_id);
  }
  query += ` ORDER BY created_at DESC LIMIT ?`;
  params.push(parseInt(limit));
  
  db.all(query, params, (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows);
  });
});

router.get('/tenants/:tenantId/permission-matrix', async (req, res) => {
  try {
    const matrix = await PermissionService.getPermissionMatrix(req.params.tenantId);
    res.json(matrix);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/tenants/:tenantId/permission-matrix/export', async (req, res) => {
  try {
    const matrix = await PermissionService.getPermissionMatrix(req.params.tenantId);
    const parser = new Parser();
    const csv = parser.parse(matrix);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="permission-matrix-${req.params.tenantId}.csv"`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/check-permission', async (req, res) => {
  try {
    const { tenant_id, department_id, role_id, api_resource_id, required_access_level } = req.body;
    const result = await PermissionService.checkPermission(
      tenant_id,
      department_id,
      role_id,
      api_resource_id,
      required_access_level || 'read'
    );
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
