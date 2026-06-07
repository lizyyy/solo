import type { TrainingLog, ParamNote, Conflict } from '@/types';

export const detectConflicts = (log: TrainingLog, note: ParamNote): Conflict[] => {
  const conflicts: Conflict[] = [];

  const curveByMetric: Record<string, number[]> = {};
  log.curveData.forEach((point) => {
    if (!curveByMetric[point.metric]) {
      curveByMetric[point.metric] = [];
    }
    curveByMetric[point.metric].push(point.value);
  });

  note.thresholds.forEach((threshold) => {
    const metric = threshold.metric;
    if (metric === 'cvr_weight' && threshold.value < 0.3) {
      const cvrLossValues = curveByMetric['cvr_loss'];
      if (cvrLossValues && cvrLossValues.length > 0) {
        const firstLoss = cvrLossValues[0];
        const lastLoss = cvrLossValues[cvrLossValues.length - 1];
        if (firstLoss - lastLoss > 0.2) {
          conflicts.push({
            id: `conf-log-note-${Date.now()}-cvr`,
            experimentId: log.experimentId,
            type: 'log_vs_note',
            description: `训练日志显示cvr_loss下降明显，但调参笔记中cvr权重被调低至${threshold.value}`,
            evidence: {
              log: `cvr_loss从${firstLoss.toFixed(2)}降至${lastLoss.toFixed(2)}，下降趋势明显`,
              note: `cvr_weight设置为${threshold.value}，低于正常水平`,
            },
            status: 'pending',
          });
        }
      }
    }

    if (metric === 'ctr_weight' && threshold.value > 0.5) {
      const ctrLossValues = curveByMetric['ctr_loss'];
      if (ctrLossValues && ctrLossValues.length > 0) {
        const firstLoss = ctrLossValues[0];
        const lastLoss = ctrLossValues[ctrLossValues.length - 1];
        if (firstLoss - lastLoss < 0.1) {
          conflicts.push({
            id: `conf-log-note-${Date.now()}-ctr`,
            experimentId: log.experimentId,
            type: 'log_vs_note',
            description: `调参笔记中ctr权重调高至${threshold.value}，但训练日志中ctr_loss下降不明显`,
            evidence: {
              log: `ctr_loss从${firstLoss.toFixed(2)}降至${lastLoss.toFixed(2)}，下降幅度较小`,
              note: `ctr_weight设置为${threshold.value}，高于正常水平`,
            },
            status: 'pending',
          });
        }
      }
    }
  });

  const missingFeatures = log.features.filter((f) => !f.present && f.defaultValue !== undefined);
  if (missingFeatures.length > 0) {
    const featureNames = missingFeatures.map((f) => f.name).join('、');
    const defaultValues = missingFeatures.map((f) => f.defaultValue).join('、');
    conflicts.push({
      id: `conf-feature-${Date.now()}`,
      experimentId: log.experimentId,
      type: 'feature_missing',
      description: `线上特征缺失，${featureNames}使用默认分`,
      evidence: {
        log: `检测到${missingFeatures.length}个特征缺失，使用默认值${defaultValues}`,
        note: note.notes.includes('特征缺失') ? '笔记中提及特征缺失' : '笔记中未提及特征缺失情况',
      },
      status: 'pending',
    });
  }

  return conflicts;
};

export const getConflictTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    log_vs_note: '日志与笔记矛盾',
    feature_missing: '特征缺失异常',
    data_inconsistency: '数据不一致',
  };
  return labels[type] || type;
};

export const getConflictTypeColor = (type: string): string => {
  const colors: Record<string, string> = {
    log_vs_note: 'bg-amber-100 text-amber-800',
    feature_missing: 'bg-red-100 text-red-800',
    data_inconsistency: 'bg-orange-100 text-orange-800',
  };
  return colors[type] || 'bg-gray-100 text-gray-800';
};

export const getConflictStatusLabel = (status: string): string => {
  const labels: Record<string, string> = {
    pending: '待确认',
    confirmed: '已确认',
    rejected: '已驳回',
  };
  return labels[status] || status;
};

export const getConflictStatusColor = (status: string): string => {
  const colors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    confirmed: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
};
