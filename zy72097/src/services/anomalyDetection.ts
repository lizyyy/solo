import type { ProcessedData, QualityIssue } from '../types';

const calculateIQR = (values: number[]): { q1: number; q3: number; iqr: number } => {
  const sorted = [...values].sort((a, b) => a - b);
  const q1Index = Math.floor(sorted.length * 0.25);
  const q3Index = Math.floor(sorted.length * 0.75);
  const q1 = sorted[q1Index];
  const q3 = sorted[q3Index];
  const iqr = q3 - q1;
  return { q1, q3, iqr };
};

export const detectNullValues = (data: ProcessedData[]): QualityIssue[] => {
  const issues: QualityIssue[] = [];
  
  data.forEach((item, index) => {
    if (item.stress === null) {
      issues.push({
        type: 'null',
        dataId: item.id,
        rowIndex: index + 1,
        field: 'stress',
        originalValue: '空',
        description: `第${index + 1}行应力数据为空`,
        suggestion: '建议补录应力值，或使用插值法填充，或删除该记录',
      });
    }
    if (item.life === null) {
      issues.push({
        type: 'null',
        dataId: item.id,
        rowIndex: index + 1,
        field: 'life',
        originalValue: '空',
        description: `第${index + 1}行寿命数据为空`,
        suggestion: '建议补录寿命值，或使用插值法填充，或删除该记录',
      });
    }
  });
  
  return issues;
};

export const detectDuplicates = (data: ProcessedData[]): QualityIssue[] => {
  const issues: QualityIssue[] = [];
  const seen = new Map<string, ProcessedData[]>();
  
  data.forEach((item) => {
    const key = `${item.stress}-${item.life}-${item.testDate}`;
    if (seen.has(key)) {
      seen.get(key)!.push(item);
    } else {
      seen.set(key, [item]);
    }
  });
  
  seen.forEach((items, key) => {
    if (items.length > 1) {
      items.slice(1).forEach((item, idx) => {
        const originalIndex = data.findIndex(d => d.id === items[0].id) + 1;
        const duplicateIndex = data.findIndex(d => d.id === item.id) + 1;
        issues.push({
          type: 'duplicate',
          dataId: item.id,
          rowIndex: duplicateIndex,
          field: 'stress,life,testDate',
          originalValue: `应力:${item.stress}, 寿命:${item.life}, 日期:${item.testDate}`,
          description: `第${duplicateIndex}行与第${originalIndex}行数据重复`,
          suggestion: '建议合并取平均值，或保留第一条，或保留最后一条',
        });
      });
    }
  });
  
  return issues;
};

export const detectUnitMismatch = (data: ProcessedData[]): QualityIssue[] => {
  const issues: QualityIssue[] = [];
  const stressUnits = [...new Set(data.map(d => d.stressUnit).filter(u => u))];
  const lifeUnits = [...new Set(data.map(d => d.lifeUnit).filter(u => u))];
  
  if (stressUnits.length > 1) {
    data.forEach((item, index) => {
      if (item.stressUnit !== 'MPa') {
        issues.push({
          type: 'unit_mismatch',
          dataId: item.id,
          rowIndex: index + 1,
          field: 'stressUnit',
          originalValue: item.stressUnit,
          description: `第${index + 1}行应力单位为${item.stressUnit}，与目标单位MPa不一致`,
          suggestion: `建议使用换算公式自动转换：1 ${item.stressUnit} = 系数 MPa`,
        });
      }
    });
  }
  
  if (lifeUnits.length > 1) {
    data.forEach((item, index) => {
      if (item.lifeUnit !== '次') {
        issues.push({
          type: 'unit_mismatch',
          dataId: item.id,
          rowIndex: index + 1,
          field: 'lifeUnit',
          originalValue: item.lifeUnit,
          description: `第${index + 1}行寿命单位为${item.lifeUnit}，与目标单位次不一致`,
          suggestion: '建议根据试验频率自动换算为循环次数',
        });
      }
    });
  }
  
  return issues;
};

export const detectAnomaliesByIQR = (data: ProcessedData[], threshold: number = 1.5): QualityIssue[] => {
  const issues: QualityIssue[] = [];
  const validStress = data.map(d => d.stressConverted).filter((v): v is number => v !== null);
  const validLife = data.map(d => d.lifeConverted).filter((v): v is number => v !== null);
  
  if (validStress.length === 0 || validLife.length === 0) return issues;
  
  const stressIQR = calculateIQR(validStress);
  const lifeIQR = calculateIQR(validLife);
  
  const stressLowerBound = stressIQR.q1 - threshold * stressIQR.iqr;
  const stressUpperBound = stressIQR.q3 + threshold * stressIQR.iqr;
  const lifeLowerBound = lifeIQR.q1 - threshold * lifeIQR.iqr;
  const lifeUpperBound = lifeIQR.q3 + threshold * lifeIQR.iqr;
  
  data.forEach((item, index) => {
    if (item.stressConverted !== null) {
      if (item.stressConverted < stressLowerBound || item.stressConverted > stressUpperBound) {
        issues.push({
          type: 'anomaly',
          dataId: item.id,
          rowIndex: index + 1,
          field: 'stress',
          originalValue: `${item.stressConverted} ${item.targetStressUnit}`,
          description: `第${index + 1}行应力值${item.stressConverted}超出IQR范围(${stressLowerBound.toFixed(1)}-${stressUpperBound.toFixed(1)})`,
          suggestion: '建议人工确认数据真实性，如确认为异常值可标记后删除',
        });
      }
    }
    
    if (item.lifeConverted !== null) {
      if (item.lifeConverted < lifeLowerBound || item.lifeConverted > lifeUpperBound) {
        issues.push({
          type: 'anomaly',
          dataId: item.id,
          rowIndex: index + 1,
          field: 'life',
          originalValue: `${item.lifeConverted} ${item.targetLifeUnit}`,
          description: `第${index + 1}行寿命值${item.lifeConverted.toExponential(2)}超出IQR范围`,
          suggestion: '建议人工确认数据真实性，如确认为异常值可标记后删除',
        });
      }
    }
  });
  
  return issues;
};

export const detectPhysicalBoundary = (
  data: ProcessedData[],
  yieldStrength: number = 980,
  tensileStrength: number = 1100
): QualityIssue[] => {
  const issues: QualityIssue[] = [];
  const minStress = 0.1 * yieldStrength;
  const maxStress = 0.9 * tensileStrength;
  const minLife = 1e3;
  const maxLife = 1e7;
  
  data.forEach((item, index) => {
    if (item.stressConverted !== null) {
      if (item.stressConverted < minStress) {
        issues.push({
          type: 'anomaly',
          dataId: item.id,
          rowIndex: index + 1,
          field: 'stress',
          originalValue: `${item.stressConverted} MPa`,
          description: `第${index + 1}行应力${item.stressConverted}MPa低于边界阈值${minStress}MPa(0.1σ_s)`,
          suggestion: '应力过低可能不属于高周疲劳范围，建议确认试验条件',
        });
      }
      if (item.stressConverted > maxStress) {
        issues.push({
          type: 'anomaly',
          dataId: item.id,
          rowIndex: index + 1,
          field: 'stress',
          originalValue: `${item.stressConverted} MPa`,
          description: `第${index + 1}行应力${item.stressConverted}MPa高于边界阈值${maxStress}MPa(0.9σ_b)`,
          suggestion: '应力过高可能接近静强度，建议确认试验条件',
        });
      }
    }
    
    if (item.lifeConverted !== null) {
      if (item.lifeConverted < minLife) {
        issues.push({
          type: 'anomaly',
          dataId: item.id,
          rowIndex: index + 1,
          field: 'life',
          originalValue: `${item.lifeConverted} 次`,
          description: `第${index + 1}行寿命${item.lifeConverted}次低于边界阈值${minLife}次`,
          suggestion: '寿命过低属于低周疲劳，建议单独处理',
        });
      }
      if (item.lifeConverted > maxLife) {
        issues.push({
          type: 'anomaly',
          dataId: item.id,
          rowIndex: index + 1,
          field: 'life',
          originalValue: `${item.lifeConverted} 次`,
          description: `第${index + 1}行寿命${item.lifeConverted.toExponential(2)}次高于边界阈值${maxLife.toExponential(2)}次`,
          suggestion: '寿命过高可能属于超长寿命区，建议谨慎使用',
        });
      }
    }
  });
  
  return issues;
};

export const runAllQualityChecks = (
  data: ProcessedData[],
  config?: { iqrThreshold?: number; yieldStrength?: number; tensileStrength?: number }
): QualityIssue[] => {
  const nullIssues = detectNullValues(data);
  const duplicateIssues = detectDuplicates(data);
  const unitIssues = detectUnitMismatch(data);
  const iqrIssues = detectAnomaliesByIQR(data, config?.iqrThreshold);
  const boundaryIssues = detectPhysicalBoundary(data, config?.yieldStrength, config?.tensileStrength);
  
  return [...nullIssues, ...duplicateIssues, ...unitIssues, ...iqrIssues, ...boundaryIssues];
};
