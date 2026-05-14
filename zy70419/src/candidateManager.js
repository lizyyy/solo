import fs from 'fs/promises';
import path from 'path';

function getAnomalies(auditResult) {
  return auditResult.allAnomalies || auditResult.anomalies || [];
}

function generateCleanupCandidates(auditResult, options = {}) {
  const {
    includeSwallowed = true,
    includeMalformed = true,
    includeDataAnomalies = false,
    minSeverity = 'medium'
  } = options;
  
  const candidates = [];
  const allAnomalies = getAnomalies(auditResult);
  
  for (const anomaly of allAnomalies) {
    let shouldInclude = false;
    let severity = 'low';
    let action = 'review';
    
    if (anomaly.type === 'swallowed' && includeSwallowed) {
      shouldInclude = true;
      severity = 'critical';
      action = 'delete';
    } else if (anomaly.type === 'malformed' && includeMalformed) {
      shouldInclude = true;
      severity = 'high';
      action = 'fix_or_delete';
    } else if (anomaly.type === 'data_anomaly' && includeDataAnomalies) {
      shouldInclude = true;
      severity = 'medium';
      action = 'fix';
    } else if (anomaly.type === 'missing_fields') {
      shouldInclude = true;
      severity = 'high';
      action = 'fix_or_delete';
    }
    
    if (shouldInclude) {
      const severityLevel = { critical: 4, high: 3, medium: 2, low: 1 };
      if (severityLevel[severity] >= severityLevel[minSeverity]) {
        candidates.push({
          businessNo: anomaly.businessNo,
          sampleId: anomaly.sampleId || null,
          anomalyType: anomaly.type,
          anomalyMessage: anomaly.message,
          severity,
          recommendedAction: action,
          rawContent: anomaly.rawContent || null,
          missingFields: anomaly.missingFields || [],
          canBeSafelyDeleted: anomaly.type === 'swallowed',
          requiresManualReview: severity !== 'low',
          addedAt: new Date().toISOString()
        });
      }
    }
  }
  
  return {
    batchId: auditResult.batchId,
    generatedAt: new Date().toISOString(),
    totalCandidates: candidates.length,
    bySeverity: {
      critical: candidates.filter(c => c.severity === 'critical').length,
      high: candidates.filter(c => c.severity === 'high').length,
      medium: candidates.filter(c => c.severity === 'medium').length,
      low: candidates.filter(c => c.severity === 'low').length
    },
    candidates
  };
}

function generateRollbackCandidates(originalData, processedData) {
  const candidates = [];
  
  const processedMap = new Map();
  for (const sample of processedData.samples) {
    processedMap.set(sample.businessNo, sample);
  }
  
  for (const originalSample of originalData.samples) {
    const processedSample = processedMap.get(originalSample.businessNo);
    
    if (!processedSample) {
      candidates.push({
        businessNo: originalSample.businessNo,
        type: 'missing_after_processing',
        message: '处理后样本丢失',
        originalSample,
        recommendedAction: 'restore'
      });
    } else {
      const changes = [];
      for (const key of Object.keys(originalSample)) {
        if (JSON.stringify(originalSample[key]) !== JSON.stringify(processedSample[key])) {
          changes.push({
            field: key,
            originalValue: originalSample[key],
            processedValue: processedSample[key]
          });
        }
      }
      
      if (changes.length > 0) {
        candidates.push({
          businessNo: originalSample.businessNo,
          type: 'modified_during_processing',
          message: `样本在处理过程中有 ${changes.length} 处字段变更`,
          originalSample,
          processedSample,
          changes,
          recommendedAction: 'review_and_rollback_if_needed'
        });
      }
    }
  }
  
  return {
    originalBatchId: originalData.batchId,
    processedBatchId: processedData.batchId,
    generatedAt: new Date().toISOString(),
    totalCandidates: candidates.length,
    candidates
  };
}

function filterByBatch(history, batchId) {
  return history.filter(record => record.batchId === batchId);
}

function filterByOperator(history, operator) {
  return history.filter(record => record.operator === operator);
}

function filterByRiskType(history, riskType) {
  return history.filter(record => {
    if (record.samples) {
      return record.samples.some(s => s.riskType === riskType);
    }
    return false;
  });
}

function filterByAnomalyType(history, anomalyType) {
  return history.filter(record => {
    const anomalies = record.allAnomalies || record.anomalies || [];
    return anomalies.some(a => a.type === anomalyType);
  });
}

function multiFilter(history, filters = {}) {
  let results = [...history];
  
  if (filters.batchId) {
    results = filterByBatch(results, filters.batchId);
  }
  
  if (filters.operator) {
    results = filterByOperator(results, filters.operator);
  }
  
  if (filters.riskType) {
    results = filterByRiskType(results, filters.riskType);
  }
  
  if (filters.anomalyType) {
    results = filterByAnomalyType(results, filters.anomalyType);
  }
  
  return results;
}

async function saveCandidates(candidates, filePath) {
  const fullPath = path.resolve(filePath);
  await fs.writeFile(fullPath, JSON.stringify(candidates, null, 2), 'utf8');
  return fullPath;
}

async function loadCandidates(filePath) {
  const fullPath = path.resolve(filePath);
  const content = await fs.readFile(fullPath, 'utf8');
  return JSON.parse(content);
}

export {
  generateCleanupCandidates,
  generateRollbackCandidates,
  filterByBatch,
  filterByOperator,
  filterByRiskType,
  filterByAnomalyType,
  multiFilter,
  saveCandidates,
  loadCandidates
};
