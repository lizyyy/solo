import type { 
  RawData, 
  ProcessedData, 
  ProcessRecord, 
  JudgmentRecord,
  PreprocessConfig,
  QualityIssue 
} from '../types';
import { convertStress, convertLife } from './unitConversion';
import { runAllQualityChecks } from './anomalyDetection';

const generateId = (prefix: string, dataId: string, index: number): string => {
  return `${dataId}-${prefix}-${Date.now()}-${index}`;
};

const now = () => new Date().toISOString();

export const initializeProcessedData = (rawData: RawData[]): ProcessedData[] => {
  return rawData.map(item => ({
    ...item,
    stressConverted: item.stress,
    lifeConverted: item.life,
    targetStressUnit: 'MPa',
    targetLifeUnit: '次',
    isDuplicate: false,
    isNull: item.stress === null || item.life === null,
    isAnomaly: false,
    anomalyReason: '',
    status: item.source.includes('汇总页') ? 'historical' : 'normal',
    processHistory: [],
    judgment: [],
  }));
};

export const addProcessRecord = (
  data: ProcessedData,
  processType: ProcessRecord['processType'],
  originalValue: string,
  processedValue: string,
  reason: string,
  operator: 'system' | 'user' = 'system'
): ProcessedData => {
  const newRecord: ProcessRecord = {
    id: generateId('PROC', data.id, data.processHistory.length + 1),
    dataId: data.id,
    processType,
    originalValue,
    processedValue,
    reason,
    operator,
    operatedAt: now(),
  };

  return {
    ...data,
    processHistory: [...data.processHistory, newRecord],
  };
};

export const addJudgment = (
  data: ProcessedData,
  status: ProcessedData['status'],
  judgment: string,
  judge: string,
  evidence: string
): ProcessedData => {
  const newJudgment: JudgmentRecord = {
    id: generateId('JUD', data.id, data.judgment.length + 1),
    dataId: data.id,
    status,
    judgment,
    judge,
    evidence,
    judgedAt: now(),
  };

  return {
    ...data,
    status,
    judgment: [...data.judgment, newJudgment],
  };
};

export const performUnitConversion = (
  data: ProcessedData[],
  config: PreprocessConfig
): { processed: ProcessedData[]; issues: QualityIssue[] } => {
  const processed = data.map(item => {
    let updated = { ...item };

    const stressResult = convertStress(
      item.stress,
      item.stressUnit,
      config.targetStressUnit
    );
    const lifeResult = convertLife(
      item.life,
      item.lifeUnit,
      config.targetLifeUnit,
      config.testFrequency
    );

    updated = {
      ...updated,
      stressConverted: stressResult.value,
      lifeConverted: lifeResult.value,
      targetStressUnit: config.targetStressUnit,
      targetLifeUnit: config.targetLifeUnit,
    };

    if (item.stressUnit !== config.targetStressUnit && stressResult.value !== null) {
      updated = addProcessRecord(
        updated,
        'unit_conversion',
        `${item.stress} ${item.stressUnit}`,
        `${stressResult.value.toFixed(2)} ${config.targetStressUnit}`,
        stressResult.formula,
        'system'
      );
    }

    if (item.lifeUnit !== config.targetLifeUnit && lifeResult.value !== null) {
      updated = addProcessRecord(
        updated,
        'unit_conversion',
        `${item.life} ${item.lifeUnit}`,
        `${lifeResult.value.toExponential(2)} ${config.targetLifeUnit}`,
        lifeResult.formula,
        'system'
      );
    }

    return updated;
  });

  const issues = runAllQualityChecks(processed, {
    iqrThreshold: config.anomalyThreshold,
  });

  return { processed, issues };
};

export const markDuplicates = (
  data: ProcessedData[],
  strategy: 'average' | 'keep_first' | 'keep_last'
): ProcessedData[] => {
  const seen = new Map<string, ProcessedData[]>();
  
  data.forEach(item => {
    const key = `${item.stress}-${item.life}-${item.testDate}`;
    if (seen.has(key)) {
      seen.get(key)!.push(item);
    } else {
      seen.set(key, [item]);
    }
  });

  return data.map(item => {
    const key = `${item.stress}-${item.life}-${item.testDate}`;
    const group = seen.get(key)!;
    
    if (group.length > 1) {
      const isFirst = group[0].id === item.id;
      const isLast = group[group.length - 1].id === item.id;
      
      let shouldKeep = false;
      if (strategy === 'keep_first' && isFirst) shouldKeep = true;
      if (strategy === 'keep_last' && isLast) shouldKeep = true;
      
      if (!shouldKeep) {
        const updated = addProcessRecord(
          { ...item, isDuplicate: true },
          'duplicate_merge',
          `与${group[0].id}重复`,
          strategy === 'average' ? '合并取平均' : `保留${strategy === 'keep_first' ? '第一条' : '最后一条'}`,
          `应力、寿命、试验日期均与${group[0].id}相同`,
          'system'
        );
        return updated;
      }
    }
    return item;
  });
};

export const fillNullValues = (
  data: ProcessedData[],
  strategy: 'drop' | 'interpolate' | 'manual'
): ProcessedData[] => {
  if (strategy === 'drop') {
    return data.filter(item => item.stress !== null && item.life !== null);
  }

  if (strategy === 'interpolate') {
    const sorted = [...data].sort((a, b) => {
      const aStress = a.stress ?? Infinity;
      const bStress = b.stress ?? Infinity;
      return aStress - bStress;
    });

    return data.map(item => {
      let updated = { ...item };

      if (item.stress === null) {
        const validItems = sorted.filter(d => d.stress !== null && d.life !== null);
        const targetLife = item.life;
        if (targetLife !== null && validItems.length >= 2) {
          const lower = validItems.find(d => d.life !== null && d.life! < targetLife);
          const upper = validItems.find(d => d.life !== null && d.life! > targetLife);
          if (lower?.stress !== null && upper?.stress !== null && lower.life !== null && upper.life !== null) {
            const ratio = (targetLife - lower.life) / (upper.life - lower.life);
            const interpolated = lower.stress + ratio * (upper.stress - lower.stress);
            updated = { ...updated, stressConverted: interpolated };
            updated = addProcessRecord(
              updated,
              'null_fill',
              '空',
              interpolated.toFixed(1),
              `线性插值：基于${lower.id}(${lower.stress}MPa)和${upper.id}(${upper.stress}MPa)`,
              'system'
            );
          }
        }
      }

      if (item.life === null) {
        const validItems = sorted.filter(d => d.stress !== null && d.life !== null);
        const targetStress = item.stress;
        if (targetStress !== null && validItems.length >= 2) {
          const lower = validItems.find(d => d.stress !== null && d.stress! > targetStress);
          const upper = validItems.find(d => d.stress !== null && d.stress! < targetStress);
          if (lower?.life !== null && upper?.life !== null && lower.stress !== null && upper.stress !== null) {
            const ratio = (targetStress - lower.stress) / (upper.stress - lower.stress);
            const interpolated = lower.life + ratio * (upper.life - lower.life);
            updated = { ...updated, lifeConverted: interpolated };
            updated = addProcessRecord(
              updated,
              'null_fill',
              '空',
              interpolated.toExponential(2),
              `线性插值：基于${lower.id}(${lower.life}次)和${upper.id}(${upper.life}次)`,
              'system'
            );
          }
        }
      }

      return updated;
    });
  }

  return data.map(item => {
    if (item.stress === null || item.life === null) {
      return addProcessRecord(
        { ...item, isNull: true },
        'null_fill',
        '空',
        '待人工处理',
        '空值需人工确认处理方式',
        'system'
      );
    }
    return item;
  });
};

export const markAnomalies = (
  data: ProcessedData[],
  issues: QualityIssue[]
): ProcessedData[] => {
  return data.map(item => {
    const anomalyIssues = issues.filter(
      issue => issue.dataId === item.id && issue.type === 'anomaly'
    );

    if (anomalyIssues.length > 0) {
      const reasons = anomalyIssues.map(i => i.description).join('；');
      const updated = addProcessRecord(
        { ...item, isAnomaly: true, anomalyReason: reasons },
        'anomaly_mark',
        `${item.stressConverted}, ${item.lifeConverted}`,
        '标记为异常',
        reasons,
        'system'
      );
      return updated;
    }
    return item;
  });
};

export const autoJudgeData = (data: ProcessedData[]): ProcessedData[] => {
  return data.map(item => {
    if (item.status === 'historical') {
      return addJudgment(
        item,
        'historical',
        '历史数据，按旧标准判定，仅供参考',
        '系统自动判定',
        `来源：${item.source}，备注：${item.remark || '无'}`
      );
    }

    if (item.isNull || item.isDuplicate || item.isAnomaly) {
      return addJudgment(
        item,
        'pending',
        item.isNull 
          ? '数据存在空值，需人工确认处理方式' 
          : item.isDuplicate
          ? '检测到重复数据，需人工确认是否合并'
          : '检测到异常值，需人工确认是否保留',
        '系统自动判定',
        item.anomalyReason || '数据质量检查发现问题'
      );
    }

    if (item.processHistory.length > 0) {
      return addJudgment(
        item,
        'pending',
        '数据已自动处理，请确认处理结果',
        '系统自动判定',
        `已执行${item.processHistory.length}项处理操作，请检查确认`
      );
    }

    return addJudgment(
      item,
      'normal',
      '数据完整，单位统一，拟合结果正常',
      '系统自动判定',
      `应力${item.stressConverted}${item.targetStressUnit}，寿命${item.lifeConverted}${item.targetLifeUnit}，处于正常区间`
    );
  });
};

export const runFullPreprocess = (
  rawData: RawData[],
  config: PreprocessConfig
): { 
  processedData: ProcessedData[]; 
  qualityIssues: QualityIssue[];
} => {
  let processed = initializeProcessedData(rawData);
  
  processed = fillNullValues(processed, config.fillNullStrategy);
  processed = markDuplicates(processed, config.mergeDuplicateStrategy);
  
  const { processed: converted, issues } = performUnitConversion(processed, config);
  processed = converted;
  
  processed = markAnomalies(processed, issues);
  processed = autoJudgeData(processed);

  return {
    processedData: processed,
    qualityIssues: issues,
  };
};
