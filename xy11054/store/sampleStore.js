const { createSample, canTransition, SAMPLE_STATUS } = require('../models/sampleModel');

let samples = [];

function getAllSamples() {
  return [...samples];
}

function getSampleById(id) {
  return samples.find(s => s.id === id);
}

function getSamplesByBoxCode(sampleBoxCode) {
  return samples.filter(s => s.sampleBoxCode === sampleBoxCode);
}

function getActiveSamplesByBoxCode(sampleBoxCode) {
  return samples.filter(s => 
    s.sampleBoxCode === sampleBoxCode && 
    s.status !== SAMPLE_STATUS.DESTROYED
  );
}

function checkDuplicateBoxCode(sampleBoxCode, excludeId = null) {
  const activeSamples = getActiveSamplesByBoxCode(sampleBoxCode);
  if (excludeId) {
    return activeSamples.filter(s => s.id !== excludeId).length > 0;
  }
  return activeSamples.length > 0;
}

function checkConsistency(sample) {
  const issues = [];
  
  if (sample.status === SAMPLE_STATUS.INSPECTED && !sample.inspectionResult) {
    issues.push('已检验但无检验结果');
  }
  
  if (sample.status === SAMPLE_STATUS.DESTROYED && !sample.destroyTime) {
    issues.push('已销毁但无销毁时间');
  }
  
  if (sample.status === SAMPLE_STATUS.IN_STORAGE && !sample.storageLocation) {
    issues.push('已入库但无存储位置');
  }
  
  const statusHistory = sample.statusHistory;
  if (statusHistory.length > 0) {
    const lastStatus = statusHistory[statusHistory.length - 1].status;
    if (lastStatus !== sample.status) {
      issues.push('状态历史与当前状态不一致');
    }
  }
  
  return issues;
}

function addSample(data) {
  const sample = createSample(data);
  samples.push(sample);
  return sample;
}

function updateSampleStatus(id, newStatus, operator, source, remark = '') {
  const sample = getSampleById(id);
  if (!sample) {
    return { success: false, error: '留样记录不存在' };
  }
  
  if (!canTransition(sample.status, newStatus)) {
    return { success: false, error: `不允许从 ${sample.status} 转换到 ${newStatus}` };
  }
  
  const now = new Date().toISOString();
  
  sample.status = newStatus;
  sample.statusHistory.push({
    status: newStatus,
    timestamp: now,
    operator: operator,
    source: source || 'manual',
    remark: remark
  });
  sample.updatedAt = now;
  
  if (newStatus === SAMPLE_STATUS.DESTROYED) {
    sample.destroyTime = now;
    sample.destroyer = operator;
  }
  
  return { success: true, sample };
}

function updateInspectionResult(id, result, inspector) {
  const sample = getSampleById(id);
  if (!sample) {
    return { success: false, error: '留样记录不存在' };
  }
  
  if (sample.status !== SAMPLE_STATUS.IN_STORAGE) {
    return { success: false, error: '只有在库状态的留样才能检验' };
  }
  
  const now = new Date().toISOString();
  
  sample.inspectionResult = result;
  sample.inspectionTime = now;
  sample.inspector = inspector;
  sample.updatedAt = now;
  
  return { success: true, sample };
}

function getStatistics() {
  const total = samples.length;
  const byStatus = {};
  
  Object.values(SAMPLE_STATUS).forEach(status => {
    byStatus[status] = samples.filter(s => s.status === status).length;
  });
  
  const duplicateBoxCodes = new Set();
  const duplicateIssues = [];
  
  const boxCodeGroups = {};
  samples.forEach(s => {
    if (!boxCodeGroups[s.sampleBoxCode]) {
      boxCodeGroups[s.sampleBoxCode] = [];
    }
    boxCodeGroups[s.sampleBoxCode].push(s);
  });
  
  Object.entries(boxCodeGroups).forEach(([boxCode, sampleList]) => {
    const activeSamples = sampleList.filter(s => s.status !== SAMPLE_STATUS.DESTROYED);
    if (activeSamples.length > 1) {
      duplicateBoxCodes.add(boxCode);
      duplicateIssues.push({
        sampleBoxCode: boxCode,
        count: activeSamples.length,
        samples: activeSamples.map(s => ({
          id: s.id,
          pastryName: s.pastryName,
          productionBatch: s.productionBatch,
          status: s.status
        }))
      });
    }
  });
  
  const consistencyIssues = [];
  samples.forEach(s => {
    const issues = checkConsistency(s);
    if (issues.length > 0) {
      consistencyIssues.push({
        sampleId: s.id,
        sampleBoxCode: s.sampleBoxCode,
        pastryName: s.pastryName,
        issues
      });
    }
  });
  
  return {
    total,
    byStatus,
    duplicateBoxCodes: Array.from(duplicateBoxCodes),
    duplicateIssues,
    consistencyIssues
  };
}

function clearAll() {
  samples = [];
}

function initSamples(initialData) {
  samples = [...initialData];
}

module.exports = {
  getAllSamples,
  getSampleById,
  getSamplesByBoxCode,
  getActiveSamplesByBoxCode,
  checkDuplicateBoxCode,
  checkConsistency,
  addSample,
  updateSampleStatus,
  updateInspectionResult,
  getStatistics,
  clearAll,
  initSamples
};
