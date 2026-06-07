import type { TrainingLog, ParamNote, Summary, SelfCheckResult, HistoryRecord } from '@/types';

export const runSelfCheck = (
  log: TrainingLog,
  note: ParamNote | null,
  summaries: Summary[],
  history: HistoryRecord[],
  allLogs: TrainingLog[] = []
): SelfCheckResult => {
  return {
    duplicateImport: checkDuplicateImport(log, allLogs),
    missingFeatures: checkMissingFeatures(log),
    recalculation: checkRecalculation(summaries, history),
    exportConsistency: checkExportConsistency(log, note, summaries),
  };
};

const checkDuplicateImport = (log: TrainingLog, allLogs: TrainingLog[]): { passed: boolean; details: string } => {
  const sameExperimentLogs = allLogs.filter(
    (l) => l.experimentId === log.experimentId && l.id !== log.id
  );
  
  if (sameExperimentLogs.length === 0) {
    return { passed: true, details: '未检测到重复导入，该实验为首次导入训练日志' };
  }

  const hasSimilarCurve = sameExperimentLogs.some((existingLog) => {
    if (existingLog.curveData.length !== log.curveData.length) return false;
    let diffSum = 0;
    for (let i = 0; i < log.curveData.length; i++) {
      diffSum += Math.abs(existingLog.curveData[i].value - log.curveData[i].value);
    }
    const avgDiff = diffSum / log.curveData.length;
    return avgDiff < 0.01;
  });

  if (hasSimilarCurve) {
    return { passed: false, details: `检测到潜在重复导入，已有${sameExperimentLogs.length}份同实验日志，曲线数据高度相似` };
  }

  return { passed: true, details: `该实验已有${sameExperimentLogs.length}份历史日志，本次为新版本导入，无重复` };
};

const checkMissingFeatures = (log: TrainingLog): { passed: boolean; details: string } => {
  const missingFeatures = log.features.filter((f) => !f.present && f.defaultValue !== undefined);
  
  if (missingFeatures.length === 0) {
    return { passed: true, details: '所有特征均正常可用，无缺失使用默认分的情况' };
  }

  const featureList = missingFeatures.map((f) => `${f.name}(默认值: ${f.defaultValue})`).join('、');
  return {
    passed: false,
    details: `检测到${missingFeatures.length}个线上特征缺失，使用了默认分：${featureList}。请推荐负责人复核。`,
  };
};

const checkRecalculation = (summaries: Summary[], history: HistoryRecord[]): { passed: boolean; details: string } => {
  if (summaries.length <= 1) {
    return { passed: true, details: '仅有1个版本的摘要，无需补录重算验证' };
  }

  const noteRecords = history.filter((h) => h.action.includes('笔记') || h.action.includes('补录'));
  const recalcRecords = history.filter((h) => h.action.includes('重算'));

  if (summaries.length > 1 && noteRecords.length > 0 && recalcRecords.length > 0) {
    return {
      passed: true,
      details: `补录后重算正常，共${summaries.length}个版本的摘要，补录${noteRecords.length}次，重算${recalcRecords.length}次`,
    };
  }

  if (summaries.length > 1 && noteRecords.length > 0 && recalcRecords.length === 0) {
    return {
      passed: false,
      details: `检测到有${noteRecords.length}次补录操作，但未执行摘要重算，请确认是否需要重新生成摘要`,
    };
  }

  return { passed: true, details: '摘要版本管理正常' };
};

const checkExportConsistency = (
  log: TrainingLog,
  note: ParamNote | null,
  summaries: Summary[]
): { passed: boolean; details: string } => {
  if (summaries.length === 0) {
    return { passed: false, details: '暂无摘要，无法验证导出一致性' };
  }

  const latestSummary = summaries[summaries.length - 1];
  
  const curveByMetric: Record<string, number[]> = {};
  log.curveData.forEach((point) => {
    if (!curveByMetric[point.metric]) {
      curveByMetric[point.metric] = [];
    }
    curveByMetric[point.metric].push(point.value);
  });

  let consistencyIssues: string[] = [];

  if (curveByMetric['auc_score']) {
    const finalAuc = curveByMetric['auc_score'][curveByMetric['auc_score'].length - 1];
    const summaryAuc = latestSummary.metrics['final_auc'];
    if (summaryAuc && Math.abs(finalAuc - summaryAuc) > 0.05) {
      consistencyIssues.push(`AUC指标不一致：日志最终值${finalAuc.toFixed(3)}，摘要显示${summaryAuc.toFixed(3)}`);
    }
  }

  if (curveByMetric['total_loss']) {
    const finalLoss = curveByMetric['total_loss'][curveByMetric['total_loss'].length - 1];
    const summaryLoss = latestSummary.metrics['total_loss'];
    if (summaryLoss && Math.abs(finalLoss - summaryLoss) > 0.05) {
      consistencyIssues.push(`总Loss指标不一致：日志最终值${finalLoss.toFixed(3)}，摘要显示${summaryLoss.toFixed(3)}`);
    }
  }

  if (note && !latestSummary.content.includes(note.notes.substring(0, 10))) {
    const noteKeywords = note.notes.length > 20 ? note.notes.substring(0, 20) : note.notes;
    consistencyIssues.push(`摘要可能未完全包含调参笔记内容："${noteKeywords}..."`);
  }

  if (consistencyIssues.length > 0) {
    return { passed: false, details: `导出一致性检测发现${consistencyIssues.length}个问题：${consistencyIssues.join('；')}` };
  }

  return { passed: true, details: '导出一致性验证通过，摘要与日志、笔记数据一致' };
};

export const getCheckItemLabel = (key: string): string => {
  const labels: Record<string, string> = {
    duplicateImport: '重复导入检测',
    missingFeatures: '特征缺失检测',
    recalculation: '补录重算验证',
    exportConsistency: '导出一致性校验',
  };
  return labels[key] || key;
};

export const getCheckItemIcon = (key: string): string => {
  const icons: Record<string, string> = {
    duplicateImport: 'copy',
    missingFeatures: 'alert-triangle',
    recalculation: 'refresh-cw',
    exportConsistency: 'file-check',
  };
  return icons[key] || 'check-circle';
};
