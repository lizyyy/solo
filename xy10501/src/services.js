const { 
  store, 
  SUPPLIER_STATUS, 
  CERTIFICATE_STATUS, 
  PROJECT_ACCESS_STATUS, 
  INSPECTION_STATUS 
} = require('./models');

const EXPIRING_SOON_DAYS = 30;

function now() {
  return new Date();
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function daysDiff(date1, date2) {
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.floor((new Date(date2) - new Date(date1)) / oneDay);
}

function checkIdempotency(idempotencyKey) {
  if (!idempotencyKey) return null;
  return store.idempotencyKeys.get(idempotencyKey) || null;
}

function saveIdempotencyResult(idempotencyKey, result) {
  if (!idempotencyKey) return;
  store.idempotencyKeys.set(idempotencyKey, {
    result,
    createdAt: now().toISOString()
  });
}

function createSupplier(data) {
  const id = store.generateId();
  const supplier = {
    id,
    name: data.name,
    code: data.code,
    contact: data.contact || '',
    phone: data.phone || '',
    status: SUPPLIER_STATUS.ACTIVE,
    createdAt: now().toISOString(),
    updatedAt: now().toISOString(),
    history: [{
      action: 'CREATE',
      timestamp: now().toISOString(),
      operator: data.operator || 'SYSTEM',
      before: null,
      after: { name: data.name, code: data.code, status: SUPPLIER_STATUS.ACTIVE }
    }]
  };
  store.suppliers.set(id, supplier);
  return supplier;
}

function getSupplier(id) {
  return store.suppliers.get(id) || null;
}

function getSuppliers() {
  return Array.from(store.suppliers.values());
}

function freezeSupplier(supplierId, reason, operator) {
  const supplier = getSupplier(supplierId);
  if (!supplier) throw new Error('供应商不存在');
  
  const beforeStatus = supplier.status;
  supplier.status = SUPPLIER_STATUS.FROZEN;
  supplier.updatedAt = now().toISOString();
  supplier.history.push({
    action: 'FREEZE',
    timestamp: now().toISOString(),
    operator: operator || 'SYSTEM',
    reason,
    before: { status: beforeStatus },
    after: { status: SUPPLIER_STATUS.FROZEN }
  });
  
  const freezeLog = {
    id: store.generateId(),
    supplierId,
    action: 'FREEZE',
    reason,
    operator: operator || 'SYSTEM',
    timestamp: now().toISOString()
  };
  store.freezeLogs.set(freezeLog.id, freezeLog);
  
  return supplier;
}

function unfreezeSupplier(supplierId, reason, operator) {
  const supplier = getSupplier(supplierId);
  if (!supplier) throw new Error('供应商不存在');
  
  const beforeStatus = supplier.status;
  supplier.status = SUPPLIER_STATUS.ACTIVE;
  supplier.updatedAt = now().toISOString();
  supplier.history.push({
    action: 'UNFREEZE',
    timestamp: now().toISOString(),
    operator: operator || 'SYSTEM',
    reason,
    before: { status: beforeStatus },
    after: { status: SUPPLIER_STATUS.ACTIVE }
  });
  
  const freezeLog = {
    id: store.generateId(),
    supplierId,
    action: 'UNFREEZE',
    reason,
    operator: operator || 'SYSTEM',
    timestamp: now().toISOString()
  };
  store.freezeLogs.set(freezeLog.id, freezeLog);
  
  return supplier;
}

function uploadCertificate(data) {
  const supplier = getSupplier(data.supplierId);
  if (!supplier) throw new Error('供应商不存在');
  
  const existingCertificates = getCertificatesBySupplierAndType(data.supplierId, data.type);
  const isVersion = existingCertificates.length > 0;
  const version = isVersion ? existingCertificates.length + 1 : 1;
  
  const id = store.generateId();
  const certificate = {
    id,
    supplierId: data.supplierId,
    type: data.type,
    certificateNo: data.certificateNo,
    name: data.name,
    issueDate: data.issueDate,
    expiryDate: data.expiryDate,
    status: CERTIFICATE_STATUS.VALID,
    version,
    isLatest: true,
    uploader: data.uploader || 'SYSTEM',
    createdAt: now().toISOString(),
    updatedAt: now().toISOString(),
    renewalApplication: null,
    history: [{
      action: 'UPLOAD',
      timestamp: now().toISOString(),
      operator: data.uploader || 'SYSTEM',
      before: null,
      after: {
        type: data.type,
        certificateNo: data.certificateNo,
        expiryDate: data.expiryDate,
        status: CERTIFICATE_STATUS.VALID,
        version
      }
    }]
  };
  
  if (isVersion) {
    existingCertificates.forEach(cert => {
      cert.isLatest = false;
      cert.updatedAt = now().toISOString();
      cert.history.push({
        action: 'SUPERSEDED',
        timestamp: now().toISOString(),
        operator: 'SYSTEM',
        before: { isLatest: true },
        after: { isLatest: false }
      });
    });
  }
  
  store.certificates.set(id, certificate);
  return certificate;
}

function getCertificate(id) {
  return store.certificates.get(id) || null;
}

function getCertificatesBySupplierAndType(supplierId, type) {
  return Array.from(store.certificates.values()).filter(
    c => c.supplierId === supplierId && c.type === type
  ).sort((a, b) => b.version - a.version);
}

function getCertificatesBySupplier(supplierId) {
  return Array.from(store.certificates.values()).filter(c => c.supplierId === supplierId);
}

function submitRenewalApplication(certificateId, data) {
  const certificate = getCertificate(certificateId);
  if (!certificate) throw new Error('证照不存在');
  
  certificate.renewalApplication = {
    submittedAt: now().toISOString(),
    submitter: data.submitter || 'SYSTEM',
    expectedExpiryDate: data.expectedExpiryDate,
    status: 'PENDING'
  };
  certificate.status = CERTIFICATE_STATUS.PENDING_RENEWAL;
  certificate.updatedAt = now().toISOString();
  certificate.history.push({
    action: 'SUBMIT_RENEWAL',
    timestamp: now().toISOString(),
    operator: data.submitter || 'SYSTEM',
    before: { status: certificate.status, renewalApplication: null },
    after: { status: CERTIFICATE_STATUS.PENDING_RENEWAL, renewalApplication: certificate.renewalApplication }
  });
  
  return certificate;
}

function updateCertificateStatus(certificateId) {
  const certificate = getCertificate(certificateId);
  if (!certificate) throw new Error('证照不存在');
  
  const currentDate = now();
  const expiryDate = new Date(certificate.expiryDate);
  const daysToExpiry = daysDiff(currentDate, expiryDate);
  
  let newStatus;
  const beforeStatus = certificate.status;
  
  if (daysToExpiry < 0) {
    newStatus = CERTIFICATE_STATUS.EXPIRED;
  } else if (daysToExpiry <= EXPIRING_SOON_DAYS) {
    if (certificate.renewalApplication && certificate.renewalApplication.status === 'PENDING') {
      newStatus = CERTIFICATE_STATUS.PENDING_RENEWAL;
    } else {
      newStatus = CERTIFICATE_STATUS.EXPIRING_SOON;
    }
  } else {
    newStatus = CERTIFICATE_STATUS.VALID;
  }
  
  if (newStatus !== beforeStatus) {
    certificate.status = newStatus;
    certificate.updatedAt = now().toISOString();
    certificate.history.push({
      action: 'STATUS_CHANGE',
      timestamp: now().toISOString(),
      operator: 'SYSTEM',
      before: { status: beforeStatus },
      after: { status: newStatus },
      reason: `到期天数: ${daysToExpiry}`
    });
  }
  
  return certificate;
}

function createProject(data) {
  const id = store.generateId();
  const project = {
    id,
    name: data.name,
    code: data.code,
    requiredCertificateTypes: data.requiredCertificateTypes || [],
    status: data.status || 'ACTIVE',
    createdAt: now().toISOString(),
    updatedAt: now().toISOString()
  };
  store.projects.set(id, project);
  return project;
}

function getProject(id) {
  return store.projects.get(id) || null;
}

function getProjects() {
  return Array.from(store.projects.values());
}

function createProjectAccess(data) {
  const supplier = getSupplier(data.supplierId);
  if (!supplier) throw new Error('供应商不存在');
  
  const project = getProject(data.projectId);
  if (!project) throw new Error('项目不存在');
  
  const id = store.generateId();
  const projectAccess = {
    id,
    supplierId: data.supplierId,
    projectId: data.projectId,
    status: PROJECT_ACCESS_STATUS.PENDING,
    approver: null,
    approvedAt: null,
    createdAt: now().toISOString(),
    updatedAt: now().toISOString(),
    history: [{
      action: 'CREATE',
      timestamp: now().toISOString(),
      operator: data.operator || 'SYSTEM',
      before: null,
      after: { status: PROJECT_ACCESS_STATUS.PENDING }
    }]
  };
  store.projectAccesses.set(id, projectAccess);
  return projectAccess;
}

function getProjectAccess(id) {
  return store.projectAccesses.get(id) || null;
}

function getProjectAccessesBySupplier(supplierId) {
  return Array.from(store.projectAccesses.values()).filter(pa => pa.supplierId === supplierId);
}

function getProjectAccessesByProject(projectId) {
  return Array.from(store.projectAccesses.values()).filter(pa => pa.projectId === projectId);
}

function getAllProjectAccesses() {
  return Array.from(store.projectAccesses.values());
}

function updateProjectAccessStatus(projectAccessId, status, operator, reason) {
  const projectAccess = getProjectAccess(projectAccessId);
  if (!projectAccess) throw new Error('项目准入不存在');
  
  const beforeStatus = projectAccess.status;
  projectAccess.status = status;
  projectAccess.updatedAt = now().toISOString();
  
  if (status === PROJECT_ACCESS_STATUS.APPROVED) {
    projectAccess.approver = operator;
    projectAccess.approvedAt = now().toISOString();
  }
  
  projectAccess.history.push({
    action: 'STATUS_CHANGE',
    timestamp: now().toISOString(),
    operator: operator || 'SYSTEM',
    reason,
    before: { status: beforeStatus },
    after: { status }
  });
  
  return projectAccess;
}

function checkSupplierCertificates(supplier, requiredTypes) {
  const results = [];
  const supplierCertificates = getCertificatesBySupplier(supplier.id);
  
  for (const certType of requiredTypes) {
    const typeCerts = supplierCertificates.filter(c => c.type === certType && c.isLatest);
    const latestCert = typeCerts.length > 0 ? typeCerts[0] : null;
    
    if (!latestCert) {
      results.push({
        type: certType,
        status: 'MISSING',
        message: `缺少证照类型: ${certType}`,
        certificate: null
      });
      continue;
    }
    
    updateCertificateStatus(latestCert.id);
    const updatedCert = getCertificate(latestCert.id);
    
    if (updatedCert.status === CERTIFICATE_STATUS.EXPIRED) {
      results.push({
        type: certType,
        status: 'EXPIRED',
        message: `证照已过期: ${certType}`,
        certificate: updatedCert
      });
    } else if (updatedCert.status === CERTIFICATE_STATUS.EXPIRING_SOON) {
      results.push({
        type: certType,
        status: 'EXPIRING_SOON',
        message: `证照即将到期: ${certType}`,
        certificate: updatedCert
      });
    } else if (updatedCert.status === CERTIFICATE_STATUS.PENDING_RENEWAL) {
      results.push({
        type: certType,
        status: 'PENDING_RENEWAL',
        message: `证照续期审核中: ${certType}`,
        certificate: updatedCert
      });
    } else {
      results.push({
        type: certType,
        status: 'VALID',
        message: `证照有效: ${certType}`,
        certificate: updatedCert
      });
    }
  }
  
  return results;
}

function createInspection(data) {
  const id = store.generateId();
  const inspection = {
    id,
    name: data.name || `巡检-${now().toISOString()}`,
    type: data.type || 'FULL',
    filters: data.filters || {},
    status: INSPECTION_STATUS.PENDING,
    createdAt: now().toISOString(),
    updatedAt: now().toISOString(),
    startedAt: null,
    completedAt: null,
    resultSummary: null,
    history: [{
      action: 'CREATE',
      timestamp: now().toISOString(),
      operator: data.operator || 'SYSTEM',
      before: null,
      after: { status: INSPECTION_STATUS.PENDING, type: data.type || 'FULL' }
    }]
  };
  store.inspections.set(id, inspection);
  return inspection;
}

function getInspection(id) {
  return store.inspections.get(id) || null;
}

function getInspections() {
  return Array.from(store.inspections.values());
}

function updateInspectionStatus(inspectionId, status, operator, reason, resultSummary) {
  const inspection = getInspection(inspectionId);
  if (!inspection) throw new Error('巡检不存在');
  
  const beforeStatus = inspection.status;
  inspection.status = status;
  inspection.updatedAt = now().toISOString();
  
  if (status === INSPECTION_STATUS.IN_PROGRESS) {
    inspection.startedAt = now().toISOString();
  }
  if (status === INSPECTION_STATUS.COMPLETED || status === INSPECTION_STATUS.FAILED) {
    inspection.completedAt = now().toISOString();
  }
  if (resultSummary) {
    inspection.resultSummary = resultSummary;
  }
  
  inspection.history.push({
    action: 'STATUS_CHANGE',
    timestamp: now().toISOString(),
    operator: operator || 'SYSTEM',
    reason,
    before: { status: beforeStatus },
    after: { status }
  });
  
  return inspection;
}

function executeInspection(inspectionId, operator) {
  const inspection = getInspection(inspectionId);
  if (!inspection) throw new Error('巡检不存在');
  if (inspection.status !== INSPECTION_STATUS.PENDING) {
    throw new Error(`巡检状态不正确，当前状态: ${inspection.status}`);
  }
  
  updateInspectionStatus(inspectionId, INSPECTION_STATUS.IN_PROGRESS, operator, '开始执行巡检');
  
  const risks = [];
  const projectAccesses = getAllProjectAccesses();
  const passedCount = { total: 0, approved: 0, failed: 0, warnings: 0 };
  
  for (const projectAccess of projectAccesses) {
    const supplier = getSupplier(projectAccess.supplierId);
    const project = getProject(projectAccess.projectId);
    
    if (!supplier || !project) continue;
    
    passedCount.total++;
    
    if (supplier.status === SUPPLIER_STATUS.FROZEN) {
      const risk = {
        id: store.generateId(),
        inspectionId,
        supplierId: supplier.id,
        supplierName: supplier.name,
        projectId: project.id,
        projectName: project.name,
        certificateType: null,
        riskType: 'SUPPLIER_FROZEN',
        severity: 'HIGH',
        message: `供应商已被冻结: ${supplier.name}`,
        projectAccessStatus: projectAccess.status,
        intercepted: projectAccess.status === PROJECT_ACCESS_STATUS.APPROVED,
        createdAt: now().toISOString()
      };
      store.inspectionResults.set(risk.id, risk);
      risks.push(risk);
      
      if (projectAccess.status === PROJECT_ACCESS_STATUS.APPROVED) {
        updateProjectAccessStatus(
          projectAccess.id, 
          PROJECT_ACCESS_STATUS.SUSPENDED, 
          'SYSTEM', 
          `供应商已冻结: ${supplier.name}`
        );
        passedCount.failed++;
      } else {
        passedCount.failed++;
      }
      continue;
    }
    
    const certResults = checkSupplierCertificates(supplier, project.requiredCertificateTypes);
    
    for (const certResult of certResults) {
      if (certResult.status === 'MISSING' || certResult.status === 'EXPIRED') {
        const risk = {
          id: store.generateId(),
          inspectionId,
          supplierId: supplier.id,
          supplierName: supplier.name,
          projectId: project.id,
          projectName: project.name,
          certificateType: certResult.type,
          certificateNo: certResult.certificate?.certificateNo,
          riskType: certResult.status,
          severity: 'HIGH',
          message: certResult.message,
          projectAccessStatus: projectAccess.status,
          intercepted: false,
          createdAt: now().toISOString()
        };
        
        if (projectAccess.status === PROJECT_ACCESS_STATUS.APPROVED) {
          risk.intercepted = true;
          updateProjectAccessStatus(
            projectAccess.id, 
            PROJECT_ACCESS_STATUS.SUSPENDED, 
            'SYSTEM', 
            certResult.message
          );
        }
        
        store.inspectionResults.set(risk.id, risk);
        risks.push(risk);
        passedCount.failed++;
      } else if (certResult.status === 'EXPIRING_SOON' || certResult.status === 'PENDING_RENEWAL') {
        const risk = {
          id: store.generateId(),
          inspectionId,
          supplierId: supplier.id,
          supplierName: supplier.name,
          projectId: project.id,
          projectName: project.name,
          certificateType: certResult.type,
          certificateNo: certResult.certificate?.certificateNo,
          riskType: certResult.status,
          severity: 'MEDIUM',
          message: certResult.message,
          projectAccessStatus: projectAccess.status,
          intercepted: false,
          createdAt: now().toISOString()
        };
        store.inspectionResults.set(risk.id, risk);
        risks.push(risk);
        passedCount.warnings++;
      }
    }
    
    const hasHighRisk = certResults.some(r => r.status === 'MISSING' || r.status === 'EXPIRED');
    if (!hasHighRisk) {
      passedCount.approved++;
    }
  }
  
  const resultSummary = {
    total: passedCount.total,
    passed: passedCount.approved,
    failed: passedCount.failed,
    warnings: passedCount.warnings,
    highRiskCount: risks.filter(r => r.severity === 'HIGH').length,
    mediumRiskCount: risks.filter(r => r.severity === 'MEDIUM').length
  };
  
  const finalStatus = passedCount.failed > 0 ? INSPECTION_STATUS.FAILED : 
                       passedCount.warnings > 0 ? INSPECTION_STATUS.PASSED : INSPECTION_STATUS.COMPLETED;
  
  updateInspectionStatus(inspectionId, finalStatus, operator, '巡检完成', resultSummary);
  
  return {
    inspection: getInspection(inspectionId),
    risks
  };
}

function getInspectionResults(inspectionId) {
  return Array.from(store.inspectionResults.values()).filter(r => r.inspectionId === inspectionId);
}

function createManualReview(data) {
  const id = store.generateId();
  const review = {
    id,
    inspectionResultId: data.inspectionResultId,
    action: data.action,
    reason: data.reason,
    operator: data.operator || 'SYSTEM',
    before: data.before,
    after: data.after,
    createdAt: now().toISOString()
  };
  store.manualReviews.set(id, review);
  return review;
}

function resolveRisk(riskId, resolution, operator) {
  const risk = store.inspectionResults.get(riskId);
  if (!risk) throw new Error('风险记录不存在');
  
  const before = { ...risk };
  risk.resolved = true;
  risk.resolution = resolution.action;
  risk.resolvedAt = now().toISOString();
  risk.resolvedBy = operator;
  
  createManualReview({
    inspectionResultId: riskId,
    action: resolution.action,
    reason: resolution.reason,
    operator,
    before,
    after: { ...risk }
  });
  
  if (resolution.action === 'APPROVE_EXCEPTION' && risk.intercepted) {
    const projectAccesses = getProjectAccessesBySupplier(risk.supplierId)
      .filter(pa => pa.projectId === risk.projectId);
    
    for (const pa of projectAccesses) {
      if (pa.status === PROJECT_ACCESS_STATUS.SUSPENDED) {
        updateProjectAccessStatus(pa.id, PROJECT_ACCESS_STATUS.APPROVED, operator, 
          `人工复核通过: ${resolution.reason}`);
      }
    }
  }
  
  store.inspectionResults.set(riskId, risk);
  return risk;
}

function getRiskReport(filters = {}) {
  let results = Array.from(store.inspectionResults.values());
  
  if (filters.projectId) {
    results = results.filter(r => r.projectId === filters.projectId);
  }
  if (filters.supplierId) {
    results = results.filter(r => r.supplierId === filters.supplierId);
  }
  if (filters.certificateType) {
    results = results.filter(r => r.certificateType === filters.certificateType);
  }
  if (filters.severity) {
    results = results.filter(r => r.severity === filters.severity);
  }
  
  const projects = new Map();
  const suppliers = new Map();
  const certificateTypes = new Map();
  
  for (const risk of results) {
    if (!projects.has(risk.projectId)) {
      projects.set(risk.projectId, {
        projectId: risk.projectId,
        projectName: risk.projectName,
        risks: [],
        highCount: 0,
        mediumCount: 0,
        interceptedCount: 0
      });
    }
    const projectData = projects.get(risk.projectId);
    projectData.risks.push(risk);
    if (risk.severity === 'HIGH') projectData.highCount++;
    if (risk.severity === 'MEDIUM') projectData.mediumCount++;
    if (risk.intercepted) projectData.interceptedCount++;
    
    if (!suppliers.has(risk.supplierId)) {
      suppliers.set(risk.supplierId, {
        supplierId: risk.supplierId,
        supplierName: risk.supplierName,
        risks: [],
        highCount: 0,
        mediumCount: 0,
        interceptedCount: 0
      });
    }
    const supplierData = suppliers.get(risk.supplierId);
    supplierData.risks.push(risk);
    if (risk.severity === 'HIGH') supplierData.highCount++;
    if (risk.severity === 'MEDIUM') supplierData.mediumCount++;
    if (risk.intercepted) supplierData.interceptedCount++;
    
    if (risk.certificateType) {
      const key = `${risk.projectId}-${risk.supplierId}-${risk.certificateType}`;
      if (!certificateTypes.has(key)) {
        certificateTypes.set(key, {
          projectId: risk.projectId,
          projectName: risk.projectName,
          supplierId: risk.supplierId,
          supplierName: risk.supplierName,
          certificateType: risk.certificateType,
          risks: [],
          highCount: 0,
          mediumCount: 0,
          interceptedCount: 0
        });
      }
      const certData = certificateTypes.get(key);
      certData.risks.push(risk);
      if (risk.severity === 'HIGH') certData.highCount++;
      if (risk.severity === 'MEDIUM') certData.mediumCount++;
      if (risk.intercepted) certData.interceptedCount++;
    }
  }
  
  return {
    summary: {
      totalRisks: results.length,
      highRisk: results.filter(r => r.severity === 'HIGH').length,
      mediumRisk: results.filter(r => r.severity === 'MEDIUM').length,
      intercepted: results.filter(r => r.intercepted).length,
      resolved: results.filter(r => r.resolved).length
    },
    byProject: Array.from(projects.values()),
    bySupplier: Array.from(suppliers.values()),
    byCertificateType: Array.from(certificateTypes.values()),
    allRisks: results
  };
}

module.exports = {
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
  getCertificatesBySupplierAndType,
  submitRenewalApplication,
  updateCertificateStatus,
  createProject,
  getProject,
  getProjects,
  createProjectAccess,
  getProjectAccess,
  getProjectAccessesBySupplier,
  getProjectAccessesByProject,
  getAllProjectAccesses,
  updateProjectAccessStatus,
  checkSupplierCertificates,
  createInspection,
  getInspection,
  getInspections,
  updateInspectionStatus,
  executeInspection,
  getInspectionResults,
  createManualReview,
  resolveRisk,
  getRiskReport,
  addDays,
  now,
  EXPIRING_SOON_DAYS
};
