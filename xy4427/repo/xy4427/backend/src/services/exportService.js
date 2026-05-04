const {
  OriginalText,
  BrailleProofreading,
  TemperatureCurve,
  StudentFeedback,
  RiskDetection,
  ReviewRecord,
} = require('../models');
const moment = require('moment');
const { v4: uuidv4 } = require('uuid');

const riskTypeNames = {
  missing_translation: '漏译风险',
  point_conflict: '点位冲突风险',
  temperature_drift: '热压温度漂移风险',
  duplicate_rework: '同一页重复返工风险',
  other: '其他风险',
};

const severityNames = {
  high: '高',
  medium: '中',
  low: '低',
};

const statusNames = {
  pending: '待处理',
  reviewed: '已复核',
  overruled: '改判放行',
  resolved: '已解决',
  ignored: '忽略',
};

async function generateReleaseMarkdown(teacherName = '未指定') {
  const [
    originalTexts,
    brailleProofreadings,
    temperatureCurves,
    studentFeedbacks,
    riskDetections,
    reviewRecords,
  ] = await Promise.all([
    OriginalText.findAll({ order: [['pageNumber', 'ASC'], ['paragraphId', 'ASC']] }),
    BrailleProofreading.findAll({ order: [['pageNumber', 'ASC'], ['paragraphId', 'ASC']] }),
    TemperatureCurve.findAll({ order: [['timestamp', 'ASC']] }),
    StudentFeedback.findAll({ order: [['feedbackTime', 'ASC']] }),
    RiskDetection.findAll({ order: [['detectedAt', 'DESC']] }),
    ReviewRecord.findAll({ order: [['reviewedAt', 'DESC']] }),
  ]);

  const now = moment().format('YYYY年MM月DD日 HH:mm:ss');
  const releaseId = uuidv4();
  
  let markdown = `# 盲文教材转印放行单\n\n`;
  markdown += `**放行单编号**: ${releaseId}\n\n`;
  markdown += `**生成时间**: ${now}\n\n`;
  markdown += `**复核老师**: ${teacherName}\n\n`;
  markdown += `---\n\n`;
  
  markdown += `## 一、数据概览\n\n`;
  markdown += `| 数据类型 | 数量 |\n`;
  markdown += `|---------|------|\n`;
  markdown += `| 原文段落 | ${originalTexts.length} |\n`;
  markdown += `| 盲文校对记录 | ${brailleProofreadings.length} |\n`;
  markdown += `| 温度曲线记录 | ${temperatureCurves.length} |\n`;
  markdown += `| 学生试读反馈 | ${studentFeedbacks.length} |\n`;
  markdown += `| 检测风险项 | ${riskDetections.length} |\n\n`;
  
  markdown += `## 二、风险检测汇总\n\n`;
  
  const riskStats = {
    total: riskDetections.length,
    pending: riskDetections.filter(r => r.status === 'pending').length,
    reviewed: riskDetections.filter(r => r.status === 'reviewed').length,
    overruled: riskDetections.filter(r => r.status === 'overruled').length,
    resolved: riskDetections.filter(r => r.status === 'resolved').length,
    ignored: riskDetections.filter(r => r.status === 'ignored').length,
  };
  
  markdown += `**总风险数**: ${riskStats.total}\n\n`;
  markdown += `**状态分布**:\n`;
  markdown += `- 待处理: ${riskStats.pending}\n`;
  markdown += `- 已复核: ${riskStats.reviewed}\n`;
  markdown += `- 改判放行: ${riskStats.overruled}\n`;
  markdown += `- 已解决: ${riskStats.resolved}\n`;
  markdown += `- 忽略: ${riskStats.ignored}\n\n`;
  
  if (riskDetections.length > 0) {
    markdown += `## 三、风险详情\n\n`;
    markdown += `| 序号 | 风险类型 | 严重程度 | 页码 | 状态 | 描述 |\n`;
    markdown += `|------|---------|---------|------|------|------|\n`;
    
    riskDetections.forEach((risk, index) => {
      const pageNum = risk.pageNumber || 'N/A';
      markdown += `| ${index + 1} | ${riskTypeNames[risk.riskType] || risk.riskType} | ${severityNames[risk.severity] || risk.severity} | ${pageNum} | ${statusNames[risk.status] || risk.status} | ${risk.description} |\n`;
    });
    markdown += `\n`;
  }
  
  if (reviewRecords.length > 0) {
    markdown += `## 四、复核记录\n\n`;
    markdown += `| 序号 | 复核时间 | 复核人 | 原状态 | 新状态 | 备注 |\n`;
    markdown += `|------|---------|--------|--------|--------|------|\n`;
    
    reviewRecords.forEach((record, index) => {
      const time = moment(record.reviewedAt).format('YYYY-MM-DD HH:mm:ss');
      markdown += `| ${index + 1} | ${time} | ${record.reviewer} | ${statusNames[record.originalStatus] || record.originalStatus} | ${statusNames[record.newStatus] || record.newStatus} | ${record.comment || '-'} |\n`;
    });
    markdown += `\n`;
  }
  
  if (studentFeedbacks.length > 0) {
    markdown += `## 五、学生试读反馈\n\n`;
    markdown += `| 序号 | 页码 | 学生姓名 | 评分 | 反馈时间 | 反馈内容 |\n`;
    markdown += `|------|------|---------|------|---------|---------|\n`;
    
    studentFeedbacks.forEach((feedback, index) => {
      const time = moment(feedback.feedbackTime).format('YYYY-MM-DD HH:mm:ss');
      const rating = feedback.rating ? `${feedback.rating}分` : '-';
      markdown += `| ${index + 1} | ${feedback.pageNumber} | ${feedback.studentName} | ${rating} | ${time} | ${feedback.feedback} |\n`;
    });
    markdown += `\n`;
  }
  
  markdown += `---\n\n`;
  markdown += `## 六、放行结论\n\n`;
  
  const canRelease = riskStats.pending === 0;
  
  if (canRelease) {
    markdown += `**放行状态**: ✅ 所有风险项已处理，可以放行\n\n`;
  } else {
    markdown += `**放行状态**: ⚠️ 尚有 ${riskStats.pending} 个风险项待处理，建议先完成复核\n\n`;
  }
  
  markdown += `**复核老师签字**: _______________\n\n`;
  markdown += `**日期**: _______________\n\n`;
  
  return {
    releaseId,
    markdown,
    generatedAt: now,
    teacherName,
    canRelease,
  };
}

async function generateAuditPackage(teacherName = '未指定') {
  const [
    originalTexts,
    brailleProofreadings,
    temperatureCurves,
    studentFeedbacks,
    riskDetections,
    reviewRecords,
  ] = await Promise.all([
    OriginalText.findAll({ order: [['pageNumber', 'ASC'], ['paragraphId', 'ASC']] }),
    BrailleProofreading.findAll({ order: [['pageNumber', 'ASC'], ['paragraphId', 'ASC']] }),
    TemperatureCurve.findAll({ order: [['timestamp', 'ASC']] }),
    StudentFeedback.findAll({ order: [['feedbackTime', 'ASC']] }),
    RiskDetection.findAll({ order: [['detectedAt', 'DESC']] }),
    ReviewRecord.findAll({ order: [['reviewedAt', 'DESC']] }),
  ]);

  const now = moment().format('YYYY-MM-DD HH:mm:ss');
  const auditId = uuidv4();
  
  const auditPackage = {
    auditId,
    generatedAt: now,
    generatedBy: teacherName,
    version: '1.0.0',
    data: {
      originalTexts: originalTexts.map(t => ({
        id: t.id,
        paragraphId: t.paragraphId,
        pageNumber: t.pageNumber,
        content: t.content,
        charCount: t.charCount,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      })),
      brailleProofreadings: brailleProofreadings.map(p => ({
        id: p.id,
        paragraphId: p.paragraphId,
        pageNumber: p.pageNumber,
        brailleContent: p.brailleContent,
        points: p.points,
        proofreader: p.proofreader,
        proofreadingTime: p.proofreadingTime,
        status: p.status,
        comments: p.comments,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })),
      temperatureCurves: temperatureCurves.map(c => ({
        id: c.id,
        jobId: c.jobId,
        pageNumber: c.pageNumber,
        timestamp: c.timestamp,
        temperature: c.temperature,
        targetTemperature: c.targetTemperature,
        machineId: c.machineId,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      })),
      studentFeedbacks: studentFeedbacks.map(f => ({
        id: f.id,
        pageNumber: f.pageNumber,
        studentName: f.studentName,
        feedback: f.feedback,
        rating: f.rating,
        feedbackTime: f.feedbackTime,
        createdAt: f.createdAt,
        updatedAt: f.updatedAt,
      })),
      riskDetections: riskDetections.map(r => ({
        id: r.id,
        riskType: r.riskType,
        riskTypeName: riskTypeNames[r.riskType],
        pageNumber: r.pageNumber,
        paragraphId: r.paragraphId,
        description: r.description,
        severity: r.severity,
        severityName: severityNames[r.severity],
        detectedAt: r.detectedAt,
        status: r.status,
        statusName: statusNames[r.status],
        reviewer: r.reviewer,
        reviewComment: r.reviewComment,
        reviewedAt: r.reviewedAt,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
      reviewRecords: reviewRecords.map(rr => ({
        id: rr.id,
        riskDetectionId: rr.riskDetectionId,
        reviewer: rr.reviewer,
        originalStatus: rr.originalStatus,
        originalStatusName: statusNames[rr.originalStatus],
        newStatus: rr.newStatus,
        newStatusName: statusNames[rr.newStatus],
        comment: rr.comment,
        reviewedAt: rr.reviewedAt,
        createdAt: rr.createdAt,
        updatedAt: rr.updatedAt,
      })),
    },
    summary: {
      totalOriginalTexts: originalTexts.length,
      totalBrailleProofreadings: brailleProofreadings.length,
      totalTemperatureCurves: temperatureCurves.length,
      totalStudentFeedbacks: studentFeedbacks.length,
      totalRiskDetections: riskDetections.length,
      totalReviewRecords: reviewRecords.length,
      riskByType: {},
      riskByStatus: {},
    },
  };
  
  const riskTypes = ['missing_translation', 'point_conflict', 'temperature_drift', 'duplicate_rework', 'other'];
  const riskStatuses = ['pending', 'reviewed', 'overruled', 'resolved', 'ignored'];
  
  for (const type of riskTypes) {
    auditPackage.summary.riskByType[type] = {
      count: riskDetections.filter(r => r.riskType === type).length,
      name: riskTypeNames[type],
    };
  }
  
  for (const status of riskStatuses) {
    auditPackage.summary.riskByStatus[status] = {
      count: riskDetections.filter(r => r.status === status).length,
      name: statusNames[status],
    };
  }
  
  return {
    auditId,
    auditPackage: JSON.stringify(auditPackage, null, 2),
    generatedAt: now,
    generatedBy: teacherName,
  };
}

module.exports = {
  generateReleaseMarkdown,
  generateAuditPackage,
  riskTypeNames,
  severityNames,
  statusNames,
};
