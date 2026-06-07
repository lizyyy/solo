import type { TrainingLog, ParamNote, Summary, Conflict } from '@/types';

export const generateSummary = (
  log: TrainingLog,
  note: ParamNote | null,
  conflicts: Conflict[],
  existingSummaries: Summary[] = []
): Summary => {
  const version = existingSummaries.length + 1;

  const curveByMetric: Record<string, number[]> = {};
  log.curveData.forEach((point) => {
    if (!curveByMetric[point.metric]) {
      curveByMetric[point.metric] = [];
    }
    curveByMetric[point.metric].push(point.value);
  });

  const metrics: Record<string, number> = {};
  Object.keys(curveByMetric).forEach((metric) => {
    const values = curveByMetric[metric];
    metrics[metric] = values[values.length - 1];
  });

  if (curveByMetric['auc_score']) {
    metrics['final_auc'] = curveByMetric['auc_score'][curveByMetric['auc_score'].length - 1];
  }
  if (curveByMetric['total_loss']) {
    metrics['total_loss'] = curveByMetric['total_loss'][curveByMetric['total_loss'].length - 1];
  }

  let content = '';

  const hasMissingFeatures = log.features.some((f) => !f.present && f.defaultValue !== undefined);
  const hasConflicts = conflicts.filter((c) => c.status === 'pending').length > 0;

  if (version === 1 && !note) {
    content = '初始版本：实验数据导入，待补充调参笔记。';
    if (hasMissingFeatures) {
      content += ' 注意：存在线上特征缺失使用默认分的情况。';
    }
  } else if (note) {
    const thresholdDesc = note.thresholds.map((t) => `${t.metric}=${t.value}`).join('、');
    content = `本实验通过多目标排序权衡，设置阈值：${thresholdDesc}。`;

    if (curveByMetric['total_loss']) {
      const firstLoss = curveByMetric['total_loss'][0];
      const lastLoss = curveByMetric['total_loss'][curveByMetric['total_loss'].length - 1];
      content += ` 训练曲线显示总loss从${firstLoss.toFixed(2)}降至${lastLoss.toFixed(2)}。`;
    }

    if (curveByMetric['auc_score']) {
      const finalAuc = curveByMetric['auc_score'][curveByMetric['auc_score'].length - 1];
      content += ` 最终AUC达到${finalAuc.toFixed(2)}。`;
    }

    if (note.notes) {
      content += ` ${note.notes}`;
    }

    if (hasConflicts) {
      content += ' 注意：检测到训练日志与调参笔记存在不一致，请在冲突中心查看详情。';
    }

    if (hasMissingFeatures) {
      content += ' 同时存在线上特征缺失使用默认分的情况，需推荐负责人复核。';
    }

    if (version > 1) {
      content = `补录版本v${version}：补充调参笔记后重新生成摘要。` + content;
    }
  }

  return {
    id: `sum-${log.experimentId}-v${version}-${Date.now()}`,
    experimentId: log.experimentId,
    content,
    metrics,
    version,
    createdAt: new Date().toISOString(),
  };
};

export const formatMetricValue = (value: number): string => {
  return value.toFixed(4);
};

export const getMetricLabel = (metric: string): string => {
  const labels: Record<string, string> = {
    ctr_loss: 'CTR Loss',
    cvr_loss: 'CVR Loss',
    total_loss: '总Loss',
    auc_score: 'AUC',
    final_auc: '最终AUC',
    ctr_weight: 'CTR权重',
    cvr_weight: 'CVR权重',
    stay_weight: '停留权重',
  };
  return labels[metric] || metric;
};
