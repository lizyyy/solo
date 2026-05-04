const { Op } = require('sequelize');
const {
  OriginalText,
  BrailleProofreading,
  TemperatureCurve,
  StudentFeedback,
  RiskDetection,
  ReviewRecord,
} = require('../models');

const riskTypes = {
  MISSING_TRANSLATION: 'missing_translation',
  POINT_CONFLICT: 'point_conflict',
  TEMPERATURE_DRIFT: 'temperature_drift',
  DUPLICATE_REWORK: 'duplicate_rework',
  OTHER: 'other',
};

const riskTypeNames = {
  missing_translation: '漏译风险',
  point_conflict: '点位冲突风险',
  temperature_drift: '热压温度漂移风险',
  duplicate_rework: '同一页重复返工风险',
  other: '其他风险',
};

async function detectMissingTranslation() {
  const risks = [];
  
  const originalTexts = await OriginalText.findAll();
  const brailleProofreadings = await BrailleProofreading.findAll();
  
  const originalParaIds = new Set(originalTexts.map(t => t.paragraphId));
  const brailleParaIds = new Set(brailleProofreadings.map(t => t.paragraphId));
  
  for (const paraId of originalParaIds) {
    if (!brailleParaIds.has(paraId)) {
      const original = originalTexts.find(t => t.paragraphId === paraId);
      risks.push({
        riskType: riskTypes.MISSING_TRANSLATION,
        pageNumber: original.pageNumber,
        paragraphId: paraId,
        description: `段落 ${paraId}（第 ${original.pageNumber} 页）原文存在但未找到对应的盲文翻译`,
        severity: 'high',
      });
    }
  }
  
  return risks;
}

async function detectPointConflict() {
  const risks = [];
  
  const brailleProofreadings = await BrailleProofreading.findAll();
  
  const pageParagraphs = {};
  for (const proofreading of brailleProofreadings) {
    if (!pageParagraphs[proofreading.pageNumber]) {
      pageParagraphs[proofreading.pageNumber] = [];
    }
    pageParagraphs[proofreading.pageNumber].push(proofreading);
  }
  
  for (const [pageNumber, paragraphs] of Object.entries(pageParagraphs)) {
    for (const para of paragraphs) {
      try {
        const points = JSON.parse(para.points);
        
        for (let i = 0; i < points.length; i++) {
          for (let j = i + 1; j < points.length; j++) {
            if (JSON.stringify(points[i]) === JSON.stringify(points[j])) {
              risks.push({
                riskType: riskTypes.POINT_CONFLICT,
                pageNumber: parseInt(pageNumber),
                paragraphId: para.paragraphId,
                description: `第 ${pageNumber} 页段落 ${para.paragraphId} 中存在点位冲突，第 ${i + 1} 个和第 ${j + 1} 个点位完全相同`,
                severity: 'high',
              });
            }
          }
        }
      } catch (e) {
        risks.push({
          riskType: riskTypes.OTHER,
          pageNumber: parseInt(pageNumber),
          paragraphId: para.paragraphId,
          description: `第 ${pageNumber} 页段落 ${para.paragraphId} 的点位数据格式错误，无法解析`,
          severity: 'medium',
        });
      }
    }
  }
  
  return risks;
}

async function detectTemperatureDrift() {
  const risks = [];
  const DRIFT_THRESHOLD = 5.0; 
  
  const temperatureCurves = await TemperatureCurve.findAll({
    order: [['timestamp', 'ASC']],
  });
  
  const jobPages = {};
  for (const curve of temperatureCurves) {
    const key = `${curve.jobId}_${curve.pageNumber}`;
    if (!jobPages[key]) {
      jobPages[key] = [];
    }
    jobPages[key].push(curve);
  }
  
  for (const [key, curves] of Object.entries(jobPages)) {
    if (curves.length < 2) continue;
    
    for (let i = 1; i < curves.length; i++) {
      const prev = curves[i - 1];
      const curr = curves[i];
      
      const drift = Math.abs(curr.temperature - prev.targetTemperature);
      
      if (drift > DRIFT_THRESHOLD) {
        risks.push({
          riskType: riskTypes.TEMPERATURE_DRIFT,
          pageNumber: curr.pageNumber,
          description: `第 ${curr.pageNumber} 页热压温度出现漂移，目标温度 ${prev.targetTemperature}°C，实际温度 ${curr.temperature}°C，漂移 ${drift.toFixed(1)}°C（时间：${curr.timestamp}）`,
          severity: drift > 10 ? 'high' : 'medium',
        });
      }
    }
  }
  
  return risks;
}

async function detectDuplicateRework() {
  const risks = [];
  
  const temperatureCurves = await TemperatureCurve.findAll({
    order: [['timestamp', 'ASC']],
  });
  
  const pageJobs = {};
  for (const curve of temperatureCurves) {
    if (!pageJobs[curve.pageNumber]) {
      pageJobs[curve.pageNumber] = new Set();
    }
    pageJobs[curve.pageNumber].add(curve.jobId);
  }
  
  for (const [pageNumber, jobIds] of Object.entries(pageJobs)) {
    if (jobIds.size > 1) {
      risks.push({
        riskType: riskTypes.DUPLICATE_REWORK,
        pageNumber: parseInt(pageNumber),
        description: `第 ${pageNumber} 页被多个任务（${Array.from(jobIds).join(', ')}）重复处理，存在重复返工风险`,
        severity: 'medium',
      });
    }
  }
  
  return risks;
}

async function runAllRiskDetections() {
  const allRisks = [];
  
  const [
    missingTranslationRisks,
    pointConflictRisks,
    temperatureDriftRisks,
    duplicateReworkRisks,
  ] = await Promise.all([
    detectMissingTranslation(),
    detectPointConflict(),
    detectTemperatureDrift(),
    detectDuplicateRework(),
  ]);
  
  allRisks.push(
    ...missingTranslationRisks,
    ...pointConflictRisks,
    ...temperatureDriftRisks,
    ...duplicateReworkRisks
  );
  
  return allRisks;
}

async function saveRiskDetections(risks) {
  const savedRisks = [];
  
  for (const risk of risks) {
    const existingRisk = await RiskDetection.findOne({
      where: {
        riskType: risk.riskType,
        pageNumber: risk.pageNumber,
        paragraphId: risk.paragraphId,
        description: risk.description,
      },
    });
    
    if (!existingRisk) {
      const newRisk = await RiskDetection.create({
        riskType: risk.riskType,
        pageNumber: risk.pageNumber,
        paragraphId: risk.paragraphId,
        description: risk.description,
        severity: risk.severity,
        status: 'pending',
      });
      savedRisks.push(newRisk);
    } else {
      savedRisks.push(existingRisk);
    }
  }
  
  return savedRisks;
}

async function reviewRiskDetection(riskId, newStatus, reviewer, comment) {
  const risk = await RiskDetection.findByPk(riskId);
  
  if (!risk) {
    throw new Error('风险检测记录不存在');
  }
  
  const originalStatus = risk.status;
  
  await RiskDetection.update(
    {
      status: newStatus,
      reviewer,
      reviewComment: comment,
      reviewedAt: new Date(),
    },
    { where: { id: riskId } }
  );
  
  await ReviewRecord.create({
    riskDetectionId: riskId,
    reviewer,
    originalStatus,
    newStatus,
    comment,
    reviewedAt: new Date(),
  });
  
  return await RiskDetection.findByPk(riskId);
}

async function getRiskDetections(filters = {}) {
  const whereClause = {};
  
  if (filters.status) {
    whereClause.status = filters.status;
  }
  
  if (filters.riskType) {
    whereClause.riskType = filters.riskType;
  }
  
  if (filters.pageNumber) {
    whereClause.pageNumber = filters.pageNumber;
  }
  
  return await RiskDetection.findAll({
    where: whereClause,
    order: [['detectedAt', 'DESC']],
  });
}

async function getRiskStats() {
  const totalRisks = await RiskDetection.count();
  const pendingRisks = await RiskDetection.count({ where: { status: 'pending' } });
  const reviewedRisks = await RiskDetection.count({ where: { status: 'reviewed' } });
  const overruledRisks = await RiskDetection.count({ where: { status: 'overruled' } });
  const resolvedRisks = await RiskDetection.count({ where: { status: 'resolved' } });
  const ignoredRisks = await RiskDetection.count({ where: { status: 'ignored' } });
  
  const riskTypeStats = {};
  const riskTypes = ['missing_translation', 'point_conflict', 'temperature_drift', 'duplicate_rework', 'other'];
  
  for (const type of riskTypes) {
    riskTypeStats[type] = await RiskDetection.count({ where: { riskType: type } });
  }
  
  return {
    total: totalRisks,
    byStatus: {
      pending: pendingRisks,
      reviewed: reviewedRisks,
      overruled: overruledRisks,
      resolved: resolvedRisks,
      ignored: ignoredRisks,
    },
    byType: riskTypeStats,
  };
}

module.exports = {
  riskTypes,
  riskTypeNames,
  detectMissingTranslation,
  detectPointConflict,
  detectTemperatureDrift,
  detectDuplicateRework,
  runAllRiskDetections,
  saveRiskDetections,
  reviewRiskDetection,
  getRiskDetections,
  getRiskStats,
};
