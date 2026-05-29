import type {
  EstimationParams,
  TideCycleSegment,
  ValidationResult,
  ValidationError,
  ValidationWarning,
} from '@/types';

export const roundToPrecision = (num: number, precision: number): number => {
  const factor = Math.pow(10, precision);
  return Math.round(num * factor) / factor;
};

export const validateEfficiency = (efficiency: number): ValidationError | null => {
  if (isNaN(efficiency) || efficiency === undefined || efficiency === null) {
    return {
      code: 'EFFICIENCY_REQUIRED',
      field: 'efficiency',
      message: '请输入效率值',
      suggestion: '效率是百分比的小数形式，范围0到1之间',
    };
  }
  
  if (efficiency <= 0) {
    return {
      code: 'EFFICIENCY_TOO_LOW',
      field: 'efficiency',
      message: '效率必须大于0',
      suggestion: '请输入0到1之间的数值，例如0.4表示40%效率',
    };
  }
  
  if (efficiency > 1) {
    return {
      code: 'EFFICIENCY_EXCEEDS_ONE',
      field: 'efficiency',
      message: `效率值 ${efficiency} 超过物理上限1`,
      suggestion: '效率是百分比的小数形式，请将45%写为0.45，而非45',
    };
  }
  
  return null;
};

export const validateCycleContinuity = (cycles: TideCycleSegment[]): ValidationError[] => {
  const errors: ValidationError[] = [];
  
  if (!cycles || cycles.length === 0) {
    errors.push({
      code: 'CYCLES_REQUIRED',
      field: 'tideCycles',
      message: '请至少添加一条潮汐周期分段',
      suggestion: '点击"添加分段"按钮添加周期数据',
    });
    return errors;
  }
  
  const sorted = [...cycles].sort((a, b) => a.startTime - b.startTime);
  
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    
    if (curr.startTime > prev.endTime) {
      errors.push({
        code: 'PERIOD_GAP',
        field: 'tideCycles',
        message: `周期分段存在缺口: ${prev.endTime}:00 - ${curr.startTime}:00`,
        suggestion: '请补充该时间段的潮位和流速数据，或调整分段时间',
      });
    }
    
    if (curr.startTime < prev.endTime) {
      errors.push({
        code: 'PERIOD_OVERLAP',
        field: 'tideCycles',
        message: `周期分段存在重叠: ${curr.startTime}:00 - ${prev.endTime}:00`,
        suggestion: '请调整分段时间，确保各时间段不重叠',
      });
    }
  }
  
  if (sorted[0].startTime !== 0) {
    errors.push({
      code: 'PERIOD_START_MISSING',
      field: 'tideCycles',
      message: '周期分段未从00:00开始',
      suggestion: '请补充00:00开始的数据',
    });
  }
  
  if (sorted[sorted.length - 1].endTime !== 24) {
    errors.push({
      code: 'PERIOD_END_MISSING',
      field: 'tideCycles',
      message: '周期分段未覆盖到24:00',
      suggestion: '请补充数据覆盖到24:00',
    });
  }
  
  for (const cycle of cycles) {
    if (cycle.startTime >= cycle.endTime) {
      errors.push({
        code: 'INVALID_TIME_RANGE',
        field: 'tideCycles',
        message: `分段 ${cycle.startTime}:00 - ${cycle.endTime}:00 时间范围无效`,
        suggestion: '结束时间必须大于开始时间',
      });
    }
    
    if (cycle.flowVelocity < 0) {
      errors.push({
        code: 'NEGATIVE_VELOCITY',
        field: 'tideCycles',
        message: `分段 ${cycle.startTime}:00 - ${cycle.endTime}:00 流速不能为负数`,
        suggestion: '流速应为非负数',
      });
    }
  }
  
  return errors;
};

export const validateNumericParams = (params: EstimationParams): ValidationError[] => {
  const errors: ValidationError[] = [];
  
  if (!params.tidalRange || params.tidalRange <= 0) {
    errors.push({
      code: 'TIDAL_RANGE_INVALID',
      field: 'tidalRange',
      message: '潮差必须大于0',
      suggestion: '请输入正确的潮差数值',
    });
  }
  
  if (params.flowVelocity === undefined || params.flowVelocity < 0) {
    errors.push({
      code: 'FLOW_VELOCITY_INVALID',
      field: 'flowVelocity',
      message: '流速不能为负数',
      suggestion: '请输入正确的流速数值',
    });
  }
  
  if (!params.impellerArea || params.impellerArea <= 0) {
    errors.push({
      code: 'IMPELLER_AREA_INVALID',
      field: 'impellerArea',
      message: '叶轮面积必须大于0',
      suggestion: '请输入正确的叶轮面积数值',
    });
  }
  
  const { ratedPower, maxFlowVelocity, minFlowVelocity, maxEfficiency, impellerDiameter } = params.deviceConstraints;
  
  if (ratedPower <= 0) {
    errors.push({
      code: 'RATED_POWER_INVALID',
      field: 'ratedPower',
      message: '额定功率必须大于0',
      suggestion: '请输入正确的设备额定功率',
    });
  }
  
  if (maxFlowVelocity <= 0) {
    errors.push({
      code: 'MAX_FLOW_VELOCITY_INVALID',
      field: 'maxFlowVelocity',
      message: '最大允许流速必须大于0',
      suggestion: '请输入正确的最大允许流速',
    });
  }
  
  if (minFlowVelocity < 0) {
    errors.push({
      code: 'MIN_FLOW_VELOCITY_INVALID',
      field: 'minFlowVelocity',
      message: '启动流速不能为负数',
      suggestion: '请输入正确的启动流速',
    });
  }
  
  if (minFlowVelocity >= maxFlowVelocity) {
    errors.push({
      code: 'VELOCITY_RANGE_INVALID',
      field: 'minFlowVelocity',
      message: '启动流速必须小于最大允许流速',
      suggestion: '请调整流速范围',
    });
  }
  
  if (maxEfficiency <= 0 || maxEfficiency > 1) {
    errors.push({
      code: 'MAX_EFFICIENCY_INVALID',
      field: 'maxEfficiency',
      message: '最大允许效率必须在0到1之间',
      suggestion: '请输入正确的最大允许效率',
    });
  }
  
  if (impellerDiameter <= 0) {
    errors.push({
      code: 'IMPELLER_DIAMETER_INVALID',
      field: 'impellerDiameter',
      message: '叶轮直径必须大于0',
      suggestion: '请输入正确的叶轮直径',
    });
  }
  
  return errors;
};

export const validateUnitConsistency = (params: EstimationParams): ValidationWarning[] => {
  const warnings: ValidationWarning[] = [];
  
  const units = [params.tidalRangeUnit, params.flowVelocityUnit, params.impellerAreaUnit];
  const hasMetric = units.some(u => ['m', 'm/s', 'm²'].includes(u as string));
  const hasImperial = units.some(u => ['ft', 'knots', 'ft²'].includes(u as string));
  
  if (hasMetric && hasImperial) {
    warnings.push({
      code: 'UNIT_MIXED',
      field: 'units',
      message: '检测到公制与英制单位混用',
      suggestion: '系统已自动转换，但建议统一单位系统以避免混淆',
    });
  }
  
  return warnings;
};

export const validateParams = (params: EstimationParams): ValidationResult => {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  
  const efficiencyError = validateEfficiency(params.efficiency);
  if (efficiencyError) errors.push(efficiencyError);
  
  errors.push(...validateCycleContinuity(params.tideCycles));
  errors.push(...validateNumericParams(params));
  warnings.push(...validateUnitConsistency(params));
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
};
