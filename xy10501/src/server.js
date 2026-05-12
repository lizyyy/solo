const express = require('express');
const {
  checkIdempotency,
  saveIdempotencyResult,
  createSupplier,
  getSupplier,
  getSuppliers,
  freezeSupplier,
  unfreezeSupplier,
  uploadCertificate,
  getCertificate,
  getCertificatesBySupplier,
  submitRenewalApplication,
  createProject,
  getProject,
  getProjects,
  createProjectAccess,
  getProjectAccess,
  getProjectAccessesBySupplier,
  getProjectAccessesByProject,
  getAllProjectAccesses,
  updateProjectAccessStatus,
  createInspection,
  getInspection,
  getInspections,
  executeInspection,
  getInspectionResults,
  resolveRisk,
  getRiskReport
} = require('./services');

const { store, PROJECT_ACCESS_STATUS } = require('./models');

const app = express();
app.use(express.json());

function getOperator(req) {
  return req.headers['x-operator'] || 'SYSTEM';
}

function getIdempotencyKey(req) {
  return req.headers['x-idempotency-key'];
}

function handleError(res, error) {
  console.error('Error:', error);
  res.status(500).json({
    success: false,
    error: error.message,
    timestamp: new Date().toISOString()
  });
}

app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString()
  });
});

app.post('/api/suppliers', (req, res) => {
  try {
    const idempotencyKey = getIdempotencyKey(req);
    const existing = checkIdempotency(idempotencyKey);
    if (existing) {
      return res.json(existing.result);
    }
    
    const operator = getOperator(req);
    const supplier = createSupplier({
      ...req.body,
      operator
    });
    
    const result = { success: true, data: supplier };
    saveIdempotencyResult(idempotencyKey, result);
    res.json(result);
  } catch (error) {
    handleError(res, error);
  }
});

app.get('/api/suppliers', (req, res) => {
  try {
    const suppliers = getSuppliers();
    res.json({ success: true, data: suppliers });
  } catch (error) {
    handleError(res, error);
  }
});

app.get('/api/suppliers/:id', (req, res) => {
  try {
    const supplier = getSupplier(req.params.id);
    if (!supplier) {
      return res.status(404).json({ success: false, error: '供应商不存在' });
    }
    res.json({ success: true, data: supplier });
  } catch (error) {
    handleError(res, error);
  }
});

app.post('/api/suppliers/:id/freeze', (req, res) => {
  try {
    const idempotencyKey = getIdempotencyKey(req);
    const existing = checkIdempotency(idempotencyKey);
    if (existing) {
      return res.json(existing.result);
    }
    
    const operator = getOperator(req);
    const supplier = freezeSupplier(req.params.id, req.body.reason, operator);
    const result = { success: true, data: supplier };
    saveIdempotencyResult(idempotencyKey, result);
    res.json(result);
  } catch (error) {
    handleError(res, error);
  }
});

app.post('/api/suppliers/:id/unfreeze', (req, res) => {
  try {
    const idempotencyKey = getIdempotencyKey(req);
    const existing = checkIdempotency(idempotencyKey);
    if (existing) {
      return res.json(existing.result);
    }
    
    const operator = getOperator(req);
    const supplier = unfreezeSupplier(req.params.id, req.body.reason, operator);
    const result = { success: true, data: supplier };
    saveIdempotencyResult(idempotencyKey, result);
    res.json(result);
  } catch (error) {
    handleError(res, error);
  }
});

app.post('/api/certificates', (req, res) => {
  try {
    const idempotencyKey = getIdempotencyKey(req);
    const existing = checkIdempotency(idempotencyKey);
    if (existing) {
      return res.json(existing.result);
    }
    
    const operator = getOperator(req);
    const certificate = uploadCertificate({
      ...req.body,
      uploader: operator
    });
    const result = { success: true, data: certificate };
    saveIdempotencyResult(idempotencyKey, result);
    res.json(result);
  } catch (error) {
    handleError(res, error);
  }
});

app.get('/api/certificates/:id', (req, res) => {
  try {
    const certificate = getCertificate(req.params.id);
    if (!certificate) {
      return res.status(404).json({ success: false, error: '证照不存在' });
    }
    res.json({ success: true, data: certificate });
  } catch (error) {
    handleError(res, error);
  }
});

app.get('/api/suppliers/:supplierId/certificates', (req, res) => {
  try {
    const certificates = getCertificatesBySupplier(req.params.supplierId);
    res.json({ success: true, data: certificates });
  } catch (error) {
    handleError(res, error);
  }
});

app.post('/api/certificates/:id/renewal', (req, res) => {
  try {
    const idempotencyKey = getIdempotencyKey(req);
    const existing = checkIdempotency(idempotencyKey);
    if (existing) {
      return res.json(existing.result);
    }
    
    const operator = getOperator(req);
    const certificate = submitRenewalApplication(req.params.id, {
      ...req.body,
      submitter: operator
    });
    const result = { success: true, data: certificate };
    saveIdempotencyResult(idempotencyKey, result);
    res.json(result);
  } catch (error) {
    handleError(res, error);
  }
});

app.post('/api/projects', (req, res) => {
  try {
    const idempotencyKey = getIdempotencyKey(req);
    const existing = checkIdempotency(idempotencyKey);
    if (existing) {
      return res.json(existing.result);
    }
    
    const project = createProject(req.body);
    const result = { success: true, data: project };
    saveIdempotencyResult(idempotencyKey, result);
    res.json(result);
  } catch (error) {
    handleError(res, error);
  }
});

app.get('/api/projects', (req, res) => {
  try {
    const projects = getProjects();
    res.json({ success: true, data: projects });
  } catch (error) {
    handleError(res, error);
  }
});

app.get('/api/projects/:id', (req, res) => {
  try {
    const project = getProject(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, error: '项目不存在' });
    }
    res.json({ success: true, data: project });
  } catch (error) {
    handleError(res, error);
  }
});

app.post('/api/project-accesses', (req, res) => {
  try {
    const idempotencyKey = getIdempotencyKey(req);
    const existing = checkIdempotency(idempotencyKey);
    if (existing) {
      return res.json(existing.result);
    }
    
    const operator = getOperator(req);
    const projectAccess = createProjectAccess({
      ...req.body,
      operator
    });
    const result = { success: true, data: projectAccess };
    saveIdempotencyResult(idempotencyKey, result);
    res.json(result);
  } catch (error) {
    handleError(res, error);
  }
});

app.get('/api/project-accesses', (req, res) => {
  try {
    const projectAccesses = getAllProjectAccesses();
    res.json({ success: true, data: projectAccesses });
  } catch (error) {
    handleError(res, error);
  }
});

app.get('/api/project-accesses/:id', (req, res) => {
  try {
    const projectAccess = getProjectAccess(req.params.id);
    if (!projectAccess) {
      return res.status(404).json({ success: false, error: '项目准入不存在' });
    }
    res.json({ success: true, data: projectAccess });
  } catch (error) {
    handleError(res, error);
  }
});

app.post('/api/project-accesses/:id/approve', (req, res) => {
  try {
    const idempotencyKey = getIdempotencyKey(req);
    const existing = checkIdempotency(idempotencyKey);
    if (existing) {
      return res.json(existing.result);
    }
    
    const operator = getOperator(req);
    const projectAccess = updateProjectAccessStatus(
      req.params.id, 
      PROJECT_ACCESS_STATUS.APPROVED, 
      operator, 
      req.body.reason
    );
    const result = { success: true, data: projectAccess };
    saveIdempotencyResult(idempotencyKey, result);
    res.json(result);
  } catch (error) {
    handleError(res, error);
  }
});

app.post('/api/project-accesses/:id/reject', (req, res) => {
  try {
    const idempotencyKey = getIdempotencyKey(req);
    const existing = checkIdempotency(idempotencyKey);
    if (existing) {
      return res.json(existing.result);
    }
    
    const operator = getOperator(req);
    const projectAccess = updateProjectAccessStatus(
      req.params.id, 
      PROJECT_ACCESS_STATUS.REJECTED, 
      operator, 
      req.body.reason
    );
    const result = { success: true, data: projectAccess };
    saveIdempotencyResult(idempotencyKey, result);
    res.json(result);
  } catch (error) {
    handleError(res, error);
  }
});

app.post('/api/inspections', (req, res) => {
  try {
    const idempotencyKey = getIdempotencyKey(req);
    const existing = checkIdempotency(idempotencyKey);
    if (existing) {
      return res.json(existing.result);
    }
    
    const operator = getOperator(req);
    const inspection = createInspection({
      ...req.body,
      operator
    });
    const result = { success: true, data: inspection };
    saveIdempotencyResult(idempotencyKey, result);
    res.json(result);
  } catch (error) {
    handleError(res, error);
  }
});

app.get('/api/inspections', (req, res) => {
  try {
    const inspections = getInspections();
    res.json({ success: true, data: inspections });
  } catch (error) {
    handleError(res, error);
  }
});

app.get('/api/inspections/:id', (req, res) => {
  try {
    const inspection = getInspection(req.params.id);
    if (!inspection) {
      return res.status(404).json({ success: false, error: '巡检不存在' });
    }
    res.json({ success: true, data: inspection });
  } catch (error) {
    handleError(res, error);
  }
});

app.post('/api/inspections/:id/execute', (req, res) => {
  try {
    const operator = getOperator(req);
    const result = executeInspection(req.params.id, operator);
    res.json({ success: true, data: result });
  } catch (error) {
    handleError(res, error);
  }
});

app.get('/api/inspections/:id/results', (req, res) => {
  try {
    const results = getInspectionResults(req.params.id);
    res.json({ success: true, data: results });
  } catch (error) {
    handleError(res, error);
  }
});

app.post('/api/risks/:id/resolve', (req, res) => {
  try {
    const idempotencyKey = getIdempotencyKey(req);
    const existing = checkIdempotency(idempotencyKey);
    if (existing) {
      return res.json(existing.result);
    }
    
    const operator = getOperator(req);
    const risk = resolveRisk(req.params.id, req.body, operator);
    const result = { success: true, data: risk };
    saveIdempotencyResult(idempotencyKey, result);
    res.json(result);
  } catch (error) {
    handleError(res, error);
  }
});

app.get('/api/reports/risks', (req, res) => {
  try {
    const report = getRiskReport(req.query);
    res.json({ success: true, data: report });
  } catch (error) {
    handleError(res, error);
  }
});

app.get('/api/manual-reviews', (req, res) => {
  try {
    const reviews = Array.from(store.manualReviews.values());
    res.json({ success: true, data: reviews });
  } catch (error) {
    handleError(res, error);
  }
});

app.get('/api/freeze-logs', (req, res) => {
  try {
    const logs = Array.from(store.freezeLogs.values());
    res.json({ success: true, data: logs });
  } catch (error) {
    handleError(res, error);
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`供应商资质巡检 API 服务已启动`);
  console.log(`服务地址: http://localhost:${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/health`);
  console.log('');
  console.log('API 端点:');
  console.log('  POST /api/suppliers          - 创建供应商');
  console.log('  GET  /api/suppliers          - 获取供应商列表');
  console.log('  POST /api/suppliers/:id/freeze    - 冻结供应商');
  console.log('  POST /api/suppliers/:id/unfreeze  - 解冻供应商');
  console.log('  POST /api/certificates       - 上传证照');
  console.log('  POST /api/projects           - 创建项目');
  console.log('  POST /api/project-accesses   - 创建项目准入');
  console.log('  POST /api/project-accesses/:id/approve - 审批准入');
  console.log('  POST /api/inspections        - 创建巡检');
  console.log('  POST /api/inspections/:id/execute - 执行巡检');
  console.log('  GET  /api/inspections/:id/results - 获取巡检结果');
  console.log('  POST /api/risks/:id/resolve  - 人工处理风险');
  console.log('  GET  /api/reports/risks      - 获取风险报告');
});
