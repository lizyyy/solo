const {
  generateId,
  saveBatch,
  getBatch,
  getAllBatches,
  savePond,
  getPond,
  getAllPonds,
  saveTransfer,
  getTransfer,
  getAllTransfers,
  findTransfersByBatch,
  findTransfersByRequestId,
  saveSurvivalRecord,
  findSurvivalRecordsByBatch,
  saveReport,
  findReportsByBatch,
  checkRequestId,
  batchStatus,
  transferStatus
} = require('../store');

const calculator = require('./calculator');

function createBatch(data) {
  const requiredFields = ['species', 'hatchDate', 'initialCount', 'hatcheryPondId'];
  const missing = requiredFields.filter(f => !(f in data));
  if (missing.length > 0) {
    return {
      success: false,
      error: 'MISSING_FIELDS',
      message: `缺少必填字段: ${missing.join(', ')}`,
      missingFields: missing
    };
  }

  const hatcheryPond = getPond(data.hatcheryPondId);
  if (!hatcheryPond) {
    return {
      success: false,
      error: 'POND_NOT_FOUND',
      message: `孵化池不存在: ${data.hatcheryPondId}`
    };
  }

  const densityCheck = calculator.validateDensity(
    data.species,
    hatcheryPond.type,
    data.initialCount,
    hatcheryPond.volume
  );

  if (!densityCheck.valid) {
    return {
      success: false,
      error: densityCheck.reason,
      message: densityCheck.message,
      details: densityCheck
    };
  }

  const tempCheck = calculator.validateWaterTemp(
    data.species,
    hatcheryPond.waterTemp,
    hatcheryPond.type
  );

  if (!tempCheck.valid) {
    return {
      success: false,
      error: tempCheck.reason,
      message: tempCheck.message,
      details: tempCheck
    };
  }

  const batch = {
    id: generateId(),
    species: data.species,
    batchNo: data.batchNo || `BATCH-${Date.now()}`,
    hatchDate: data.hatchDate,
    initialCount: data.initialCount,
    currentCount: data.initialCount,
    hatcheryPondId: data.hatcheryPondId,
    currentPondId: data.hatcheryPondId,
    status: batchStatus.HATCHING,
    transferHistory: [],
    survivalRecords: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  hatcheryPond.currentBatchId = batch.id;
  hatcheryPond.currentCount = data.initialCount;
  savePond(hatcheryPond);

  saveBatch(batch);

  return {
    success: true,
    data: batch,
    warnings: [
      `批次 ${batch.batchNo} 已创建，密度: ${densityCheck.density.toFixed(0)} ${densityCheck.limits.unit}`,
      `水温: ${hatcheryPond.waterTemp}°C (最优: ${calculator.getWaterTempLimit(data.species)?.optimal}°C)`
    ]
  };
}

function prepareForTransfer(batchId) {
  const batch = getBatch(batchId);
  if (!batch) {
    return { success: false, error: 'BATCH_NOT_FOUND', message: '批次不存在' };
  }

  if (batch.status !== batchStatus.HATCHING) {
    return {
      success: false,
      error: 'INVALID_STATUS',
      message: `批次状态 ${batch.status} 不允许准备转移`,
      currentStatus: batch.status,
      requiredStatus: batchStatus.HATCHING
    };
  }

  batch.status = batchStatus.READY_FOR_TRANSFER;
  batch.updatedAt = new Date().toISOString();
  saveBatch(batch);

  return {
    success: true,
    data: batch,
    message: `批次 ${batch.batchNo} 已准备好分池`
  };
}

function executeTransfer(data) {
  const requiredFields = ['requestId', 'batchId', 'sourcePondId', 'targetPondId', 'transferCount', 'waterTempAtTransfer'];
  const missing = requiredFields.filter(f => !(f in data));
  if (missing.length > 0) {
    return {
      success: false,
      error: 'MISSING_FIELDS',
      message: `缺少必填字段: ${missing.join(', ')}`,
      missingFields: missing,
      httpStatus: 400
    };
  }

  if (checkRequestId(data.requestId)) {
    const existingTransfers = findTransfersByRequestId(data.requestId);
    if (existingTransfers.length > 0) {
      return {
        success: false,
        error: 'DUPLICATE_SUBMISSION',
        message: `请求已处理，requestId: ${data.requestId}`,
        existingTransfer: existingTransfers[0],
        httpStatus: 409
      };
    }
    return {
      success: false,
      error: 'DUPLICATE_REQUEST',
      message: `重复请求，requestId: ${data.requestId}`,
      httpStatus: 409
    };
  }

  const batch = getBatch(data.batchId);
  if (!batch) {
    return { success: false, error: 'BATCH_NOT_FOUND', message: '批次不存在', httpStatus: 404 };
  }

  const sourcePond = getPond(data.sourcePondId);
  const targetPond = getPond(data.targetPondId);

  if (!sourcePond || !targetPond) {
    return {
      success: false,
      error: 'POND_NOT_FOUND',
      message: `池塘不存在: source=${!sourcePond ? data.sourcePondId : 'OK'}, target=${!targetPond ? data.targetPondId : 'OK'}`,
      httpStatus: 404
    };
  }

  if (batch.currentPondId !== data.sourcePondId) {
    return {
      success: false,
      error: 'SOURCE_POND_MISMATCH',
      message: `批次当前所在池塘 ${batch.currentPondId} 与来源池塘 ${data.sourcePondId} 不匹配`,
      httpStatus: 400
    };
  }

  const flowCheck = calculator.validateTransferFlow(
    sourcePond.type,
    targetPond.type,
    batch.status
  );

  if (!flowCheck.valid) {
    return {
      success: false,
      error: flowCheck.reason,
      message: flowCheck.message,
      httpStatus: 400
    };
  }

  const validStatuses = [batchStatus.READY_FOR_TRANSFER, batchStatus.TRANSFERRED];
  if (!validStatuses.includes(batch.status)) {
    return {
      success: false,
      error: 'INVALID_BATCH_STATUS',
      message: `批次状态 ${batch.status} 不允许转移`,
      requiredStatuses: validStatuses,
      httpStatus: 400
    };
  }

  if (data.transferCount > batch.currentCount) {
    return {
      success: false,
      error: 'INSUFFICIENT_COUNT',
      message: `转移数量 ${data.transferCount} 超过当前数量 ${batch.currentCount}`,
      httpStatus: 400
    };
  }

  if (targetPond.currentCount > 0) {
    return {
      success: false,
      error: 'TARGET_POND_OCCUPIED',
      message: `目标池塘 ${targetPond.id} 已有苗种 ${targetPond.currentCount}`,
      httpStatus: 400
    };
  }

  const densityCheck = calculator.validateDensity(
    batch.species,
    targetPond.type,
    data.transferCount,
    targetPond.volume
  );

  if (!densityCheck.valid) {
    return {
      success: false,
      error: densityCheck.reason,
      message: densityCheck.message,
      details: densityCheck,
      httpStatus: 400
    };
  }

  const tempCheck = calculator.validateWaterTemp(
    batch.species,
    data.waterTempAtTransfer,
    targetPond.type
  );

  if (!tempCheck.valid) {
    return {
      success: false,
      error: tempCheck.reason,
      message: tempCheck.message,
      details: tempCheck,
      httpStatus: 400
    };
  }

  const survivalCalc = calculator.calculateSurvivalRate(
    batch.species,
    data.waterTempAtTransfer,
    densityCheck.density,
    targetPond.type
  );

  const actualSurvived = calculator.calculateActualSurvived(
    data.transferCount,
    survivalCalc.adjustedRate
  );

  const transfer = {
    id: generateId(),
    requestId: data.requestId,
    batchId: data.batchId,
    sourcePondId: data.sourcePondId,
    targetPondId: data.targetPondId,
    transferCount: data.transferCount,
    actualSurvived: actualSurvived,
    waterTempAtTransfer: data.waterTempAtTransfer,
    densityAtTarget: densityCheck.density,
    survivalRate: survivalCalc.adjustedRate,
    survivalFactors: survivalCalc.factors,
    status: transferStatus.COMPLETED,
    operator: data.operator || 'SYSTEM',
    remarks: data.remarks || '',
    createdAt: new Date().toISOString()
  };

  saveTransfer(transfer);

  batch.currentCount = actualSurvived;
  batch.currentPondId = data.targetPondId;
  batch.status = batchStatus.TRANSFERRED;
  batch.transferHistory.push(transfer.id);
  batch.updatedAt = new Date().toISOString();
  saveBatch(batch);

  sourcePond.currentBatchId = null;
  sourcePond.currentCount = 0;
  savePond(sourcePond);

  targetPond.currentBatchId = batch.id;
  targetPond.currentCount = actualSurvived;
  targetPond.waterTemp = data.waterTempAtTransfer;
  savePond(targetPond);

  const survivalRecord = {
    id: generateId(),
    batchId: batch.id,
    transferId: transfer.id,
    stage: `TRANSFER_${sourcePond.type}_TO_${targetPond.type}`,
    initialCount: data.transferCount,
    finalCount: actualSurvived,
    survivalRate: survivalCalc.adjustedRate,
    factors: {
      waterTemp: data.waterTempAtTransfer,
      density: densityCheck.density,
      survivalFactors: survivalCalc.factors
    },
    recordedAt: new Date().toISOString()
  };
  saveSurvivalRecord(survivalRecord);
  batch.survivalRecords.push(survivalRecord.id);
  saveBatch(batch);

  return {
    success: true,
    data: {
      transfer,
      batch,
      survivalRecord
    },
    warnings: [
      `预计成活率: ${(survivalCalc.adjustedRate * 100).toFixed(2)}%`,
      `实际存活数: ${actualSurvived} (转移数: ${data.transferCount})`,
      `损失数: ${data.transferCount - actualSurvived}`
    ]
  };
}

function correctTransfer(data) {
  const requiredFields = ['transferId', 'correctedSurvivalCount', 'reason'];
  const missing = requiredFields.filter(f => !(f in data));
  if (missing.length > 0) {
    return {
      success: false,
      error: 'MISSING_FIELDS',
      message: `缺少必填字段: ${missing.join(', ')}`,
      missingFields: missing,
      httpStatus: 400
    };
  }

  const transfer = getTransfer(data.transferId);
  if (!transfer) {
    return {
      success: false,
      error: 'TRANSFER_NOT_FOUND',
      message: '分池事务不存在',
      httpStatus: 404
    };
  }

  if (transfer.status === transferStatus.CORRECTED) {
    return {
      success: false,
      error: 'ALREADY_CORRECTED',
      message: '该分池事务已被修正过',
      httpStatus: 400
    };
  }

  if (data.correctedSurvivalCount > transfer.transferCount) {
    return {
      success: false,
      error: 'INVALID_CORRECTION',
      message: `修正后的存活数 ${data.correctedSurvivalCount} 不能超过转移数 ${transfer.transferCount}`,
      httpStatus: 400
    };
  }

  if (data.correctedSurvivalCount < 0) {
    return {
      success: false,
      error: 'INVALID_CORRECTION',
      message: '修正后的存活数不能为负数',
      httpStatus: 400
    };
  }

  const batch = getBatch(transfer.batchId);
  if (!batch) {
    return {
      success: false,
      error: 'BATCH_NOT_FOUND',
      message: '关联批次不存在',
      httpStatus: 404
    };
  }

  const countDiff = data.correctedSurvivalCount - transfer.actualSurvived;
  const newSurvivalRate = data.correctedSurvivalCount / transfer.transferCount;

  const correctionRecord = {
    originalSurvived: transfer.actualSurvived,
    correctedSurvived: data.correctedSurvivalCount,
    difference: countDiff,
    originalRate: transfer.survivalRate,
    correctedRate: parseFloat(newSurvivalRate.toFixed(4)),
    reason: data.reason,
    correctedBy: data.operator || 'MANUAL',
    correctedAt: new Date().toISOString()
  };

  transfer.correction = correctionRecord;
  transfer.status = transferStatus.CORRECTED;
  transfer.actualSurvived = data.correctedSurvivalCount;
  transfer.survivalRate = parseFloat(newSurvivalRate.toFixed(4));
  saveTransfer(transfer);

  batch.currentCount = Math.max(0, batch.currentCount + countDiff);
  batch.updatedAt = new Date().toISOString();
  saveBatch(batch);

  const targetPond = getPond(transfer.targetPondId);
  if (targetPond) {
    targetPond.currentCount = Math.max(0, targetPond.currentCount + countDiff);
    savePond(targetPond);
  }

  const survivalRecords = findSurvivalRecordsByBatch(batch.id);
  const relatedRecord = survivalRecords.find(r => r.transferId === transfer.id);
  if (relatedRecord) {
    relatedRecord.finalCount = data.correctedSurvivalCount;
    relatedRecord.survivalRate = parseFloat(newSurvivalRate.toFixed(4));
    relatedRecord.correction = {
      reason: data.reason,
      correctedBy: data.operator || 'MANUAL',
      correctedAt: new Date().toISOString()
    };
    saveSurvivalRecord(relatedRecord);
  }

  return {
    success: true,
    data: {
      transfer,
      batch,
      correction: correctionRecord
    },
    message: `分池事务已修正: 存活数 ${correctionRecord.originalSurvived} -> ${correctionRecord.correctedSurvived}`,
    warnings: [
      `数量变动: ${countDiff > 0 ? '+' : ''}${countDiff}`,
      `新成活率: ${(newSurvivalRate * 100).toFixed(2)}%`
    ]
  };
}

function generateReport(batchId) {
  const batch = getBatch(batchId);
  if (!batch) {
    return { success: false, error: 'BATCH_NOT_FOUND', message: '批次不存在' };
  }

  const transfers = findTransfersByBatch(batchId);
  const survivalRecords = findSurvivalRecordsByBatch(batchId);

  const totalTransferred = transfers.reduce((sum, t) => sum + t.transferCount, 0);
  const totalSurvived = transfers.reduce((sum, t) => sum + t.actualSurvived, 0);
  const overallSurvivalRate = totalTransferred > 0 
    ? parseFloat((totalSurvived / totalTransferred).toFixed(4))
    : null;

  const avgWaterTemp = transfers.length > 0
    ? parseFloat((transfers.reduce((sum, t) => sum + t.waterTempAtTransfer, 0) / transfers.length).toFixed(2))
    : null;

  const report = {
    id: generateId(),
    batchId: batchId,
    batchInfo: {
      species: batch.species,
      batchNo: batch.batchNo,
      hatchDate: batch.hatchDate,
      initialCount: batch.initialCount,
      currentCount: batch.currentCount,
      status: batch.status
    },
    transferSummary: {
      totalTransfers: transfers.length,
      totalTransferred,
      totalSurvived,
      overallSurvivalRate,
      avgWaterTemp
    },
    transfers: transfers,
    survivalRecords: survivalRecords,
    statusImpact: calculateStatusImpact(overallSurvivalRate, avgWaterTemp),
    generatedAt: new Date().toISOString()
  };

  saveReport(report);

  return {
    success: true,
    data: report
  };
}

function calculateStatusImpact(survivalRate, avgWaterTemp) {
  const warnings = [];
  const status = {
    health: 'UNKNOWN',
    riskLevel: 'LOW',
    recommendations: []
  };

  if (survivalRate !== null) {
    if (survivalRate < 0.70) {
      status.health = 'POOR';
      status.riskLevel = 'HIGH';
      warnings.push(`成活率过低: ${(survivalRate * 100).toFixed(1)}%`);
      status.recommendations.push('建议检查水质参数和养殖密度');
    } else if (survivalRate < 0.85) {
      status.health = 'FAIR';
      status.riskLevel = 'MEDIUM';
      warnings.push(`成活率一般: ${(survivalRate * 100).toFixed(1)}%`);
      status.recommendations.push('建议优化水温控制');
    } else {
      status.health = 'GOOD';
      status.riskLevel = 'LOW';
    }
  }

  if (avgWaterTemp !== null) {
    if (avgWaterTemp < 20) {
      warnings.push(`平均水温偏低: ${avgWaterTemp}°C`);
      status.recommendations.push('考虑升温或推迟下次分池');
    }
  }

  status.warnings = warnings;
  return status;
}

function listBatches() {
  return { success: true, data: getAllBatches() };
}

function listPonds() {
  return { success: true, data: getAllPonds() };
}

function listTransfers() {
  return { success: true, data: getAllTransfers() };
}

function getBatchDetails(batchId) {
  const batch = getBatch(batchId);
  if (!batch) {
    return { success: false, error: 'BATCH_NOT_FOUND', message: '批次不存在' };
  }

  const transfers = findTransfersByBatch(batchId);
  const survivalRecords = findSurvivalRecordsByBatch(batchId);
  const reports = findReportsByBatch(batchId);

  return {
    success: true,
    data: {
      batch,
      transfers,
      survivalRecords,
      reports
    }
  };
}

module.exports = {
  createBatch,
  prepareForTransfer,
  executeTransfer,
  correctTransfer,
  generateReport,
  listBatches,
  listPonds,
  listTransfers,
  getBatchDetails
};