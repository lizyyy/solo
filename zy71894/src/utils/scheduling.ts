import type {
  ScheduleRecord,
  TeamRecord,
  ConditionLog,
  ThresholdTable,
  TraceLink,
  ScheduleWarning,
  DataSources,
  InspectionReport,
} from '@/types';

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function detectMissingTeamRecords(teamRecords: TeamRecord[]): ScheduleWarning[] {
  const warnings: ScheduleWarning[] = [];
  teamRecords.forEach((tr) => {
    if (tr.isMissing || !tr.content.trim()) {
      warnings.push({
        id: generateId('warn'),
        type: 'missing_team_record',
        message: `班组记录缺失: ${tr.teamId} - ${tr.operator || '未知操作员'}`,
        severity: 'high',
        sourceId: tr.id,
      });
    }
  });
  return warnings;
}

function detectMissingConditionLogs(conditionLogs: ConditionLog[]): ScheduleWarning[] {
  const warnings: ScheduleWarning[] = [];
  conditionLogs.forEach((cl) => {
    if (cl.isMissing || cl.status === 'missing') {
      warnings.push({
        id: generateId('warn'),
        type: 'missing_condition_log',
        message: `工况日志缺失: 关联班组记录 ${cl.teamRecordId}`,
        severity: 'high',
        sourceId: cl.id,
      });
    }
  });
  return warnings;
}

function detectDuplicateThresholds(thresholds: ThresholdTable[]): ScheduleWarning[] {
  const warnings: ScheduleWarning[] = [];
  const seen = new Map<string, ThresholdTable>();

  thresholds.forEach((th) => {
    const key = `${th.materialType}-${th.parameter}`;
    if (seen.has(key)) {
      warnings.push({
        id: generateId('warn'),
        type: 'duplicate_threshold',
        message: `阈值表重复: ${th.materialType} - ${th.parameter} 存在多个版本 (v${seen.get(key)!.version} 和 v${th.version})`,
        severity: 'medium',
        sourceId: th.id,
      });
      th.isDuplicate = true;
      th.duplicateOf = seen.get(key)!.id;
    } else {
      seen.set(key, th);
    }
  });
  return warnings;
}

function detectBoundaryConditions(
  conditionLogs: ConditionLog[],
  thresholds: ThresholdTable[]
): ScheduleWarning[] {
  const warnings: ScheduleWarning[] = [];
  const boundaryThreshold = 0.95;

  conditionLogs.forEach((cl) => {
    if (cl.isMissing) return;

    thresholds.forEach((th) => {
      if (th.isDuplicate) return;

      let value: number | null = null;
      if (th.parameter === '温度') value = cl.temperature;
      if (th.parameter === '压力') value = cl.pressure;
      if (th.parameter === '流速') value = cl.velocity;

      if (value !== null && value > 0) {
        const range = th.maxValue - th.minValue;
        const distanceFromMin = value - th.minValue;
        const distanceFromMax = th.maxValue - value;

        if (distanceFromMin < range * (1 - boundaryThreshold)) {
          warnings.push({
            id: generateId('warn'),
            type: 'boundary_condition',
            message: `${cl.conditionType}: ${th.parameter} ${value}${th.unit} 接近下限 ${th.minValue}${th.unit}`,
            severity: 'medium',
            sourceId: cl.id,
          });
        }

        if (distanceFromMax < range * (1 - boundaryThreshold)) {
          warnings.push({
            id: generateId('warn'),
            type: 'boundary_condition',
            message: `${cl.conditionType}: ${th.parameter} ${value}${th.unit} 接近上限 ${th.maxValue}${th.unit}`,
            severity: 'medium',
            sourceId: cl.id,
          });
        }

        if (value < th.minValue || value > th.maxValue) {
          warnings.push({
            id: generateId('warn'),
            type: 'parameter_out_of_range',
            message: `${cl.conditionType}: ${th.parameter} ${value}${th.unit} 超出范围 [${th.minValue}, ${th.maxValue}]${th.unit}`,
            severity: 'high',
            sourceId: cl.id,
          });
        }
      }
    });
  });

  return warnings;
}

function evaluateParameters(
  conditionLogs: ConditionLog[],
  thresholds: ThresholdTable[]
): { pass: boolean; score: number; details: string[] } {
  const details: string[] = [];
  let totalScore = 0;
  let maxScore = 0;

  const uniqueThresholds = thresholds.filter((t) => !t.isDuplicate);

  conditionLogs.forEach((cl) => {
    if (cl.isMissing || cl.status === 'missing') {
      details.push(`⚠️ ${cl.conditionType || '未知工况'}: 数据缺失`);
      return;
    }

    uniqueThresholds.forEach((th) => {
      maxScore += 10;
      let value: number | null = null;
      if (th.parameter === '温度') value = cl.temperature;
      if (th.parameter === '压力') value = cl.pressure;
      if (th.parameter === '流速') value = cl.velocity;

      if (value !== null && value > 0) {
        if (value >= th.minValue && value <= th.maxValue) {
          const midPoint = (th.minValue + th.maxValue) / 2;
          const distanceFromMid = Math.abs(value - midPoint);
          const range = th.maxValue - th.minValue;
          const normalizedDistance = distanceFromMid / (range / 2);
          const score = Math.round(10 * (1 - normalizedDistance * 0.5));
          totalScore += score;
          details.push(`✓ ${cl.conditionType}: ${th.parameter} ${value}${th.unit} 在范围内 (得分: ${score}/10)`);
        } else {
          details.push(`✗ ${cl.conditionType}: ${th.parameter} ${value}${th.unit} 超出范围 [${th.minValue}, ${th.maxValue}]${th.unit} (得分: 0/10)`);
        }
      }
    });
  });

  const normalizedScore = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;
  return {
    pass: normalizedScore >= 60,
    score: Math.round(normalizedScore),
    details,
  };
}

function calculatePriority(
  warnings: ScheduleWarning[],
  evaluationScore: number,
  teamRecords: TeamRecord[]
): 'high' | 'medium' | 'low' {
  const highSeverityCount = warnings.filter((w) => w.severity === 'high').length;
  const mediumSeverityCount = warnings.filter((w) => w.severity === 'medium').length;

  if (highSeverityCount > 0) return 'high';
  if (mediumSeverityCount > 1) return 'high';
  if (mediumSeverityCount === 1) return 'medium';
  if (evaluationScore >= 80) return 'low';
  if (evaluationScore >= 60) return 'medium';
  return 'high';
}

function generateConclusion(
  materialType: string,
  evaluation: { pass: boolean; score: number; details: string[] },
  warnings: ScheduleWarning[],
  isReRun: boolean
): string {
  const parts: string[] = [];

  if (isReRun) {
    parts.push('【重复排程】基于最新数据重新计算');
  }

  parts.push(`材料类型: ${materialType}`);
  parts.push(`综合评分: ${evaluation.score}/100`);

  if (evaluation.pass) {
    parts.push('结论: 参数评估通过，可以安排风洞试验');
  } else {
    parts.push('结论: 参数评估未通过，建议整改后重试');
  }

  if (warnings.length > 0) {
    parts.push(`检测到 ${warnings.length} 个异常情况，请查看警告详情`);
  }

  return parts.join('；');
}

export function runSchedulingAlgorithm(
  materialBatchId: string,
  materialType: string,
  dataSources: DataSources,
  existingSchedule?: ScheduleRecord
): ScheduleRecord {
  const isReRun = !!existingSchedule;
  const now = new Date();

  const warnings: ScheduleWarning[] = [];
  warnings.push(...detectMissingTeamRecords(dataSources.teamRecords));
  warnings.push(...detectMissingConditionLogs(dataSources.conditionLogs));
  warnings.push(...detectDuplicateThresholds(dataSources.thresholds));
  warnings.push(...detectBoundaryConditions(dataSources.conditionLogs, dataSources.thresholds));

  const evaluation = evaluateParameters(dataSources.conditionLogs, dataSources.thresholds);
  const priority = calculatePriority(warnings, evaluation.score, dataSources.teamRecords);

  let status: ScheduleRecord['status'] = 'scheduled';
  if (warnings.some((w) => w.severity === 'high')) {
    status = 'warning';
  }
  if (!evaluation.pass) {
    status = 'failed';
  }
  if (isReRun && existingSchedule?.status === 'completed') {
    status = 'completed';
  }

  const recommendedStartTime = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const recommendedEndTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);

  const schedule: ScheduleRecord = {
    id: existingSchedule?.id || generateId('sch'),
    materialBatchId,
    materialType,
    scheduleTime: now,
    status,
    conclusion: generateConclusion(materialType, evaluation, warnings, isReRun),
    priority,
    createdAt: existingSchedule?.createdAt || now,
    updatedAt: now,
    isReRun,
    originalScheduleId: existingSchedule?.originalScheduleId || existingSchedule?.id,
    runCount: (existingSchedule?.runCount || 0) + 1,
    traceLinks: [],
    warnings,
    recommendedStartTime,
    recommendedEndTime,
  };

  return schedule;
}

export function buildTraceLinks(
  schedule: ScheduleRecord,
  dataSources: DataSources
): TraceLink[] {
  const links: TraceLink[] = [];
  let sequence = 1;

  dataSources.teamRecords.forEach((tr) => {
    const hasNegativeImpact = tr.isMissing || tr.status === 'error' || tr.status === 'warning';
    links.push({
      id: generateId('trace'),
      scheduleId: schedule.id,
      sourceType: 'team_record',
      sourceId: tr.id,
      sourceName: `班组记录 - ${tr.teamId}`,
      sourceContent: tr.content || '【内容缺失】',
      sequence: sequence++,
      impact: hasNegativeImpact ? 'negative' : tr.status === 'warning' ? 'neutral' : 'positive',
    });

    tr.modificationHistory.forEach((ml) => {
      links.push({
        id: generateId('trace'),
        scheduleId: schedule.id,
        sourceType: 'team_record',
        sourceId: `${tr.id}-mod-${ml.id}`,
        sourceName: `修改记录 - ${ml.modifiedBy}`,
        sourceContent: `${ml.reason}: "${ml.oldContent}" → "${ml.newContent}"`,
        sequence: sequence++,
        impact: 'neutral',
      });
    });
  });

  dataSources.conditionLogs.forEach((cl) => {
    const hasNegativeImpact = cl.isMissing || cl.status === 'abnormal' || cl.status === 'missing';
    links.push({
      id: generateId('trace'),
      scheduleId: schedule.id,
      sourceType: 'condition_log',
      sourceId: cl.id,
      sourceName: `工况日志 - ${cl.conditionType || '未知'}`,
      sourceContent: cl.isMissing
        ? '【数据缺失】'
        : `温度: ${cl.temperature}°C, 压力: ${cl.pressure}kPa, 流速: ${cl.velocity}m/s`,
      sequence: sequence++,
      impact: hasNegativeImpact ? 'negative' : cl.status === 'abnormal' ? 'neutral' : 'positive',
    });
  });

  dataSources.thresholds
    .filter((t) => !t.isDuplicate)
    .forEach((th) => {
      links.push({
        id: generateId('trace'),
        scheduleId: schedule.id,
        sourceType: 'threshold',
        sourceId: th.id,
        sourceName: `阈值表 - ${th.parameter}`,
        sourceContent: `范围: [${th.minValue}, ${th.maxValue}]${th.unit}, 版本: v${th.version}`,
        sequence: sequence++,
        impact: 'neutral',
      });
    });

  return links;
}

export function generateInspectionReport(schedule: ScheduleRecord): InspectionReport {
  const todoItems: string[] = [];
  const now = new Date();

  if (schedule.warnings.length > 0) {
    schedule.warnings.forEach((w, index) => {
      todoItems.push(`${index + 1}. ${w.message}`);
    });
  }

  if (schedule.status === 'scheduled') {
    todoItems.push(`${todoItems.length + 1}. 确认试验时间窗口并通知相关人员`);
    todoItems.push(`${todoItems.length + 1}. 准备试验设备和安全检查`);
  }

  if (schedule.status === 'warning') {
    todoItems.push(`${todoItems.length + 1}. 优先处理高优先级警告项`);
    todoItems.push(`${todoItems.length + 1}. 复核异常数据，确认是否可以继续试验`);
  }

  if (schedule.status === 'failed') {
    todoItems.push(`${todoItems.length + 1}. 整改不合格项`);
    todoItems.push(`${todoItems.length + 1}. 重新提交排程申请`);
  }

  if (schedule.isReRun) {
    todoItems.push(`${todoItems.length + 1}. 本次为重复排程，对比历史排程确认变更内容`);
  }

  const contentLines = [
    '========================================',
    '         风洞试验巡检报告',
    '========================================',
    '',
    `报告编号: RPT-${now.getTime()}`,
    `导出时间: ${now.toLocaleString('zh-CN')}`,
    '',
    '【基本信息】',
    `  批次号: ${schedule.materialBatchId}`,
    `  材料类型: ${schedule.materialType}`,
    `  排程编号: ${schedule.id}`,
    `  排程次数: 第 ${schedule.runCount} 次`,
    `  是否重复排程: ${schedule.isReRun ? '是' : '否'}`,
    '',
    '【排程状态】',
    `  状态: ${getStatusText(schedule.status)}`,
    `  优先级: ${getPriorityText(schedule.priority)}`,
    `  综合评分: ${getEvaluationScore(schedule)}`,
    '',
    '【排程结论】',
    `  ${schedule.conclusion}`,
    '',
    '【推荐时间窗口】',
    `  开始时间: ${schedule.recommendedStartTime?.toLocaleString('zh-CN') || '未确定'}`,
    `  结束时间: ${schedule.recommendedEndTime?.toLocaleString('zh-CN') || '未确定'}`,
    '',
    '【警告列表】',
    schedule.warnings.length === 0
      ? '  无'
      : schedule.warnings
          .map(
            (w, i) =>
              `  ${i + 1}. [${getSeverityText(w.severity)}] ${w.message}`
          )
          .join('\n'),
    '',
    '【待办事项】',
    todoItems.length === 0 ? '  无' : todoItems.map((t) => `  ${t}`).join('\n'),
    '',
    '【追溯依据】',
    schedule.traceLinks.length === 0
      ? '  无'
      : schedule.traceLinks
          .slice(0, 10)
          .map(
            (tl) =>
              `  ${tl.sequence}. [${getSourceTypeText(tl.sourceType)}] ${tl.sourceName}: ${tl.sourceContent}`
          )
          .join('\n'),
    '',
    '========================================',
  ];

  return {
    id: generateId('rpt'),
    scheduleId: schedule.id,
    content: contentLines.join('\n'),
    todoItems,
    handoverNotes: '',
    exportedAt: now,
    nextShiftRemarks: '下一班次请核对待办事项完成情况，如有问题及时联系上一班次负责人。',
  };
}

function getStatusText(status: ScheduleRecord['status']): string {
  const map: Record<string, string> = {
    pending: '待处理',
    scheduled: '已排程',
    completed: '已完成',
    failed: '未通过',
    warning: '有警告',
  };
  return map[status] || status;
}

function getPriorityText(priority: ScheduleRecord['priority']): string {
  const map: Record<string, string> = {
    high: '高',
    medium: '中',
    low: '低',
  };
  return map[priority] || priority;
}

function getSeverityText(severity: ScheduleWarning['severity']): string {
  const map: Record<string, string> = {
    high: '高',
    medium: '中',
    low: '低',
  };
  return map[severity] || severity;
}

function getSourceTypeText(type: TraceLink['sourceType']): string {
  const map: Record<string, string> = {
    team_record: '班组记录',
    condition_log: '工况日志',
    threshold: '阈值表',
  };
  return map[type] || type;
}

function getEvaluationScore(schedule: ScheduleRecord): string {
  const match = schedule.conclusion.match(/综合评分: (\d+)/);
  return match ? `${match[1]}/100` : '未评分';
}

export function downloadReport(report: InspectionReport): void {
  const blob = new Blob([report.content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `inspection-report-${report.scheduleId}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
