const storage = require('./storage');
const assignmentEngine = require('./assignmentEngine');
const validationEngine = require('./validationEngine');

async function processBatch(batchId, goodsList) {
  const results = {
    batchId,
    total: goodsList.length,
    processed: 0,
    success: 0,
    failed: 0,
    items: [],
    risks: {
      CRITICAL: 0,
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0
    }
  };

  const previousAssignments = await storage.getAssignmentsByBatch(batchId);
  assignmentEngine.initEngine(previousAssignments);

  for (const goodsData of goodsList) {
    const itemResult = await processSingleGoods(batchId, goodsData);
    results.items.push(itemResult);
    results.processed++;

    if (itemResult.success) {
      results.success++;
    } else {
      results.failed++;
    }

    if (itemResult.riskLevel) {
      results.risks[itemResult.riskLevel] = (results.risks[itemResult.riskLevel] || 0) + 1;
    }
  }

  const batchGoods = await storage.getGoodsByBatch(batchId);
  const categoryStats = {};
  for (const goods of batchGoods) {
    categoryStats[goods.category] = (categoryStats[goods.category] || 0) + 1;
  }

  await storage.saveStats(batchId, {
    total: results.total,
    processed: results.processed,
    success: results.success,
    failed: results.failed,
    risks: results.risks,
    categoryStats
  });

  await generateExportFiles(batchId, batchGoods);

  return results;
}

async function processSingleGoods(batchId, goodsData) {
  const result = {
    goodsNo: goodsData.goodsNo,
    batchId,
    success: false,
    riskLevel: null,
    errors: [],
    warnings: [],
    assignment: null,
    validation: null,
    job: null
  };

  const dataValidation = await validationEngine.validateGoodsData(goodsData);
  if (!dataValidation.success) {
    result.errors = dataValidation.errors;
    result.riskLevel = dataValidation.riskLevel;
    return result;
  }

  const duplicateCheck = await validationEngine.checkDuplicateSubmission(goodsData, batchId);
  if (duplicateCheck.isDuplicate) {
    result.errors.push({
      type: 'DUPLICATE_SUBMISSION',
      severity: 'MEDIUM',
      message: duplicateCheck.message
    });
    result.success = true;
    result.riskLevel = dataValidation.riskLevel;
    result.duplicate = true;
    
    const existingGoods = duplicateCheck.existing;
    const existingAssignments = await storage.getAssignmentsByBatch(batchId);
    const existingAssignment = existingAssignments.find(a => a.goodsId === existingGoods.id);
    const existingValidations = await storage.getValidationsByBatch(batchId);
    const existingValidation = existingValidations.find(v => v.goodsId === existingGoods.id);
    const existingJobs = await storage.getJobsByBatch(batchId);
    const existingJob = existingJobs.find(j => j.goodsId === existingGoods.id);
    
    result.assignment = existingAssignment;
    result.validation = existingValidation;
    result.job = existingJob;
    return result;
  }

  const savedGoods = await storage.saveGoods({
    ...goodsData,
    batchId
  });

  const batchGoods = await storage.getGoodsByBatch(batchId);
  const assignment = assignmentEngine.assignSlot(savedGoods, batchGoods);

  if (!assignment.success) {
    result.errors.push({
      type: 'ASSIGNMENT_FAILED',
      severity: 'CRITICAL',
      message: assignment.error
    });
    result.riskLevel = dataValidation.riskLevel;
    
    await storage.updateGoodsStatus(savedGoods.id, 'assignment_failed');
    await storage.saveValidation({
      batchId,
      goodsId: savedGoods.id,
      goodsNo: savedGoods.goodsNo,
      valid: false,
      errors: result.errors,
      riskLevel: dataValidation.riskLevel
    });
    
    return result;
  }

  const savedAssignment = await storage.saveAssignment({
    batchId,
    goodsId: savedGoods.id,
    goodsNo: savedGoods.goodsNo,
    category: savedGoods.category,
    zone: assignment.zone,
    zoneName: assignment.zoneName,
    slot: assignment.slot,
    position: assignment.position,
    requiredDistance: assignment.requiredDistance
  });

  result.assignment = savedAssignment;
  result.warnings = assignment.warnings || [];

  const assignmentValidation = await validationEngine.validateAssignment(
    savedGoods,
    savedAssignment,
    batchGoods
  );

  const savedValidation = await storage.saveValidation({
    batchId,
    goodsId: savedGoods.id,
    goodsNo: savedGoods.goodsNo,
    valid: assignmentValidation.valid,
    violations: assignmentValidation.violations,
    warnings: assignment.warnings || [],
    riskLevel: assignmentValidation.riskLevel,
    zone: savedAssignment.zone,
    slot: savedAssignment.slot
  });

  result.validation = savedValidation;
  result.riskLevel = assignmentValidation.riskLevel;

  if (!assignmentValidation.valid) {
    result.errors = assignmentValidation.violations;
    await storage.updateGoodsStatus(savedGoods.id, 'validation_failed');
    return result;
  }

  const job = assignmentEngine.generateJobPlan(savedGoods, savedAssignment, batchId);
  const savedJob = await storage.saveJob(job);
  result.job = savedJob;

  await storage.updateGoodsStatus(savedGoods.id, 'assigned');
  result.success = true;

  return result;
}

async function generateExportFiles(batchId, batchGoods) {
  const assignments = await storage.getAssignmentsByBatch(batchId);
  const validations = await storage.getValidationsByBatch(batchId);
  const jobs = await storage.getJobsByBatch(batchId);
  const stats = await storage.getStatsByBatch(batchId);

  const assignmentReport = {
    batchId,
    generatedAt: new Date().toISOString(),
    type: 'ASSIGNMENT_REPORT',
    data: assignments.map(a => ({
      goodsNo: a.goodsNo,
      category: a.category,
      zone: a.zone,
      zoneName: a.zoneName,
      slot: a.slot,
      position: a.position,
      requiredDistance: a.requiredDistance
    }))
  };
  await storage.saveExport(batchId, 'ASSIGNMENT_REPORT', assignmentReport);

  const validationReport = {
    batchId,
    generatedAt: new Date().toISOString(),
    type: 'VALIDATION_REPORT',
    data: validations.map(v => ({
      goodsNo: v.goodsNo,
      valid: v.valid,
      violations: v.violations,
      warnings: v.warnings,
      riskLevel: v.riskLevel
    }))
  };
  await storage.saveExport(batchId, 'VALIDATION_REPORT', validationReport);

  const jobPlan = {
    batchId,
    generatedAt: new Date().toISOString(),
    type: 'JOB_PLAN',
    data: jobs.map(j => ({
      jobNo: j.jobNo,
      goodsNo: j.goodsNo,
      categoryName: j.categoryName,
      operationType: j.operationType,
      zoneName: j.zoneName,
      slot: j.slot,
      priority: j.priority,
      status: j.status,
      plannedTime: j.plannedTime,
      requiredEquipment: j.requiredEquipment
    }))
  };
  await storage.saveExport(batchId, 'JOB_PLAN', jobPlan);

  const riskSummary = {
    batchId,
    generatedAt: new Date().toISOString(),
    type: 'RISK_SUMMARY',
    data: {
      stats: stats,
      criticalItems: validations.filter(v => v.riskLevel === 'CRITICAL').map(v => v.goodsNo),
      highRiskItems: validations.filter(v => v.riskLevel === 'HIGH').map(v => v.goodsNo)
    }
  };
  await storage.saveExport(batchId, 'RISK_SUMMARY', riskSummary);
}

async function manualCorrect(batchId, goodsNo, correctionData, operator) {
  const batchGoods = await storage.getGoodsByBatch(batchId);
  const goods = batchGoods.find(g => g.goodsNo === goodsNo);

  if (!goods) {
    return {
      success: false,
      error: `未找到危险品 ${goodsNo}`
    };
  }

  const correction = {
    batchId,
    goodsId: goods.id,
    goodsNo,
    operator,
    originalData: {
      category: goods.category,
      weight: goods.weight,
      operationType: goods.operationType
    },
    newData: correctionData,
    reason: correctionData.reason || '人工修正'
  };

  const savedCorrection = await storage.saveCorrection(correction);

  if (correctionData.category) {
    goods.category = correctionData.category;
  }
  if (correctionData.weight) {
    goods.weight = correctionData.weight;
  }
  if (correctionData.operationType) {
    goods.operationType = correctionData.operationType;
  }

  await storage.saveGoods(goods);

  return {
    success: true,
    correction: savedCorrection,
    message: `危险品 ${goodsNo} 已修正，需要重新运行批次处理`
  };
}

async function getBatchStatus(batchId) {
  const goods = await storage.getGoodsByBatch(batchId);
  const assignments = await storage.getAssignmentsByBatch(batchId);
  const validations = await storage.getValidationsByBatch(batchId);
  const jobs = await storage.getJobsByBatch(batchId);
  const corrections = await storage.getCorrectionsByBatch(batchId);
  const stats = await storage.getStatsByBatch(batchId);

  const statusCounts = {};
  for (const g of goods) {
    statusCounts[g.status] = (statusCounts[g.status] || 0) + 1;
  }

  return {
    batchId,
    goods: {
      total: goods.length,
      byStatus: statusCounts
    },
    assignments: {
      total: assignments.length
    },
    validations: {
      total: validations.length,
      valid: validations.filter(v => v.valid).length,
      invalid: validations.filter(v => !v.valid).length
    },
    jobs: {
      total: jobs.length
    },
    corrections: {
      total: corrections.length
    },
    stats,
    updatedAt: stats?.updatedAt || null
  };
}

module.exports = {
  processBatch,
  processSingleGoods,
  manualCorrect,
  getBatchStatus,
  generateExportFiles
};
