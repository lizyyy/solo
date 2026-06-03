import { analyzeGeometry } from '../geometry/core.js';
import { dataStore, ReviewRecord } from '../models/index.js';

export function detectMultipleVersions(studentId, answerId) {
  const answers = dataStore.getAnswersByStudentAndAnswer(studentId, answerId);
  return answers.length > 1;
}

export function getStudentVersions(studentId, answerId) {
  return dataStore.getAnswersByStudentAndAnswer(studentId, answerId);
}

export function generateErrorAnalysis(record) {
  const parts = [];

  if (!record) return '';

  const geo = record.geometryAnalysis;
  const manual = record.manualExample;
  const questionnaire = record.questionnaire;

  if (geo && geo.issues && geo.issues.length > 0) {
    parts.push('【几何问题】');
    geo.issues.forEach(issue => {
      if (issue.type === 'concave') parts.push('• ' + issue.message);
      if (issue.type === 'duplicate') parts.push('• ' + issue.message);
      if (issue.type === 'winding') parts.push('• ' + issue.message);
    });
  }

  if (record.hasMultipleVersions) {
    parts.push(`• 同一学生提交了 ${record.versions.length} 版答案，需业务运营复核确认哪版为准`);
  }

  if (!manual || !questionnaire) parts.push('【缺少材料】');
  if (!manual) parts.push('• 缺少手算反例记录，无法核对计算过程');
  if (!questionnaire) parts.push('• 缺少问卷原始行，无现场说法佐证');
  if (questionnaire && !questionnaire.siteStatement) parts.push('• 问卷有记录但现场说法为空');

  if (geo && Math.abs(geo.areaDiff) > 0.01) {
    parts.push('【面积差异】');
    parts.push(`• 原始多边形面积: ${geo.rawArea.toFixed(2)}，凸包面积: ${geo.convexArea.toFixed(2)}`);
    parts.push(`• 面积差值: ${geo.areaDiff.toFixed(2)} (${(geo.areaDiffRatio * 100).toFixed(1)}%)`);
  }

  return parts.join('\n');
}

export function determineNextStep(record) {
  const geo = record.geometryAnalysis;
  const manual = record.manualExample;
  const questionnaire = record.questionnaire;

  const hasGeoIssues = geo && geo.issues && geo.issues.length > 0;
  const needsManual = !manual;
  const needsQuestionnaire = !questionnaire;

  if (record.hasMultipleVersions) {
    return '先找业务运营';
  }

  if (needsManual || needsQuestionnaire) {
    return '找教研负责人吴老师';
  }

  if (hasGeoIssues) {
    return '教研负责人吴老师';
  }

  return '业务运营';
}

export function generateNextStepDetail(record) {
  const parts = [];
  const geo = record.geometryAnalysis;
  const manual = record.manualExample;
  const questionnaire = record.questionnaire;

  if (record.hasMultipleVersions) {
    parts.push('【下一步：请找业务运营】');
    parts.push('• 同一学生有多版答案，需业务运营对接学生，确认哪一版是最终提交');
    parts.push('• 确认后更新复核记录');
  }

  if (!manual) {
    parts.push('【下一步：请找教研负责人吴老师】');
    parts.push('• 缺少手算反例记录');
    parts.push('• 请补录学生的主流程计算过程，便于核对面积');
  }

  if (!questionnaire) {
    parts.push('• 请补录问卷原始行，补充现场说法');
  }

  if (geo && geo.issues && geo.issues.length > 0) {
    const concaveCount = geo.issues.filter(i => i.type === 'concave').length;
    if (concaveCount > 0) {
      parts.push('• 几何形状存在凹点问题');
      parts.push('• 请核对坐标输入顺序，或确认是否为凸多边形');
    }
  }

  return parts.length === 0 ? '【状态正常】' : parts.join('\n');
}

export function createReviewRecord(studentId, answerId) {
  const versions = getStudentVersions(studentId, answerId);
  if (versions.length === 0) return null;

  const primaryAnswer = versions[0];
  const geoAnalysis = analyzeGeometry(primaryAnswer);
  const manualExample = dataStore.getManualExample(studentId, answerId);
  const questionnaire = dataStore.getQuestionnaire(studentId, answerId);

  const hasMultipleVersions = versions.length > 1;

  const record = new ReviewRecord({
    id: `review-${studentId}-${answerId}-${Date.now()}`,
    studentId,
    answerId,
    status: hasMultipleVersions ? 'needs-operation-review' : 'pending',
    geometryAnalysis: geoAnalysis,
    manualExample: manualExample ? manualExample.toJSON() : null,
    questionnaire: questionnaire ? questionnaire.toJSON() : null,
    hasMultipleVersions,
    versions: versions.map(v => ({
      version: v.version,
      submittedAt: v.submittedAt,
      source: v.source
    })),
    reviewHistory: [{
      action: 'created',
      message: '复核记录已创建'
    }]
  });

  record.errorAnalysis = generateErrorAnalysis(record);
  record.nextStep = determineNextStep(record);
  record.nextStepDetail = generateNextStepDetail(record);
  record.assignedTo = record.nextStep;

  dataStore.addReviewRecord(record);
  return record;
}

export function updateWithQuestionnaire(recordId, questionnaireData) {
  const record = dataStore.getReviewRecord(recordId);
  if (!record) return null;

  dataStore.addQuestionnaire(questionnaireData);

  const questionnaire = dataStore.getQuestionnaire(questionnaireData.studentId, questionnaireData.answerId);

  const updated = dataStore.updateReviewRecord(recordId, {
    questionnaire: questionnaire ? questionnaire.toJSON() : null,
    status: 'updated'
  });

  updated.errorAnalysis = generateErrorAnalysis(updated);
  updated.nextStep = determineNextStep(updated);
  updated.nextStepDetail = generateNextStepDetail(updated);
  updated.assignedTo = updated.nextStep;

  updated.addHistoryEntry({
    action: 'questionnaire-added',
    message: '已补充问卷原始行，误差说明已更新'
  });

  dataStore.saveToFiles();
  return updated;
}

export function updateWithManualExample(recordId, manualData) {
  const record = dataStore.getReviewRecord(recordId);
  if (!record) return null;

  dataStore.addManualExample(manualData);

  const manualExample = dataStore.getManualExample(manualData.studentId, manualData.answerId);

  const updated = dataStore.updateReviewRecord(recordId, {
    manualExample: manualExample ? manualExample.toJSON() : null,
    status: 'updated'
  });

  updated.errorAnalysis = generateErrorAnalysis(updated);
  updated.nextStep = determineNextStep(updated);
  updated.nextStepDetail = generateNextStepDetail(updated);
  updated.assignedTo = updated.nextStep;

  updated.addHistoryEntry({
    action: 'manual-added',
    message: '已补充手算反例，误差说明已更新'
  });

  dataStore.saveToFiles();
  return updated;
}

export function approveRecord(recordId, approver) {
  const record = dataStore.getReviewRecord(recordId);
  if (!record) return null;

  const updated = dataStore.updateReviewRecord(recordId, {
    status: 'approved'
  });

  updated.addHistoryEntry({
    action: 'approved',
    message: `已由 ${approver} 批准通过`,
    approver
  });

  dataStore.saveToFiles();
  return updated;
}

export function processAllAnswers() {
  const processed = new Set();
  const results = [];

  dataStore.studentAnswers.forEach(answer => {
    const key = `${answer.studentId}-${answer.answerId}`;
    if (processed.has(key)) return;
    processed.add(key);

    const record = createReviewRecord(answer.studentId, answer.answerId);
    if (record) {
      results.push(record);
    }
  });

  dataStore.saveToFiles();
  return results;
}

export function generateReport(recordId) {
  const record = dataStore.getReviewRecord(recordId);
  if (!record) return null;

  return {
    record: record.toJSON(),
    summary: generateReportSummary(record)
  };
}

export function generateReportSummary(record) {
  const geo = record.geometryAnalysis;
  const issuesByType = {};

  if (geo && geo.issues) {
    geo.issues.forEach(issue => {
      issuesByType[issue.type] = (issuesByType[issue.type] || 0) + 1;
    });
  }

  return {
    status: record.status,
    hasMultipleVersions: record.hasMultipleVersions,
    versionCount: record.versions.length,
    hasManual: !!record.manualExample,
    hasQuestionnaire: !!record.questionnaire,
    issuesByType,
    areaDiff: geo ? geo.areaDiff : 0,
    areaDiffRatio: geo ? geo.areaDiffRatio : 0,
    nextStep: record.nextStep,
    assignedTo: record.assignedTo
  };
}
