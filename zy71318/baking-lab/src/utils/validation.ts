import type { SimulationParams, ValidationResult, ValidationError } from '../types';
import { MOLD_MATERIALS } from '../data/materials';

export const VALIDATION_RULES = {
  timeStep: {
    min: 1,
    max: 30,
    recommendedMax: 10,
    unit: '秒'
  },
  ovenTemperature: {
    min: 100,
    max: 250,
    unit: '°C'
  },
  initialTemperature: {
    min: 0,
    max: 40,
    unit: '°C'
  },
  cakeDiameter: {
    min: 10,
    max: 30,
    unit: 'cm'
  },
  cakeHeight: {
    min: 3,
    max: 15,
    unit: 'cm'
  },
  totalTime: {
    min: 60,
    max: 3600,
    unit: '秒'
  }
};

export const ERROR_CODES = {
  MISSING_FIELD: 'MISSING_FIELD',
  TIME_STEP_TOO_LARGE: 'TIME_STEP_TOO_LARGE',
  TIME_STEP_OUT_OF_RANGE: 'TIME_STEP_OUT_OF_RANGE',
  TEMP_OUT_OF_RANGE: 'TEMP_OUT_OF_RANGE',
  DIMENSION_OUT_OF_RANGE: 'DIMENSION_OUT_OF_RANGE',
  TOTAL_TIME_OUT_OF_RANGE: 'TOTAL_TIME_OUT_OF_RANGE',
  MATERIAL_NOT_FOUND: 'MATERIAL_NOT_FOUND',
  MISSING_MATERIAL_PARAMS: 'MISSING_MATERIAL_PARAMS',
  DUPLICATE_SIMULATION: 'DUPLICATE_SIMULATION',
  INVALID_STATE: 'INVALID_STATE'
};

export function validateSimulationParams(
  params: Partial<SimulationParams>,
  existingSimulations: string[] = []
): ValidationResult {
  const errors: ValidationError[] = [];

  if (!params.materialId) {
    errors.push({
      field: 'materialId',
      message: '请选择模具材料',
      code: ERROR_CODES.MISSING_FIELD
    });
  } else {
    const material = MOLD_MATERIALS.find(m => m.id === params.materialId);
    if (!material) {
      errors.push({
        field: 'materialId',
        message: '所选材料不存在',
        code: ERROR_CODES.MATERIAL_NOT_FOUND
      });
    } else {
      if (!material.thermalConductivity || !material.specificHeat || !material.density) {
        errors.push({
          field: 'materialId',
          message: '材料参数不完整，请检查材料数据',
          code: ERROR_CODES.MISSING_MATERIAL_PARAMS
        });
      }
    }
  }

  if (params.timeStep === undefined || params.timeStep === null) {
    errors.push({
      field: 'timeStep',
      message: '请输入时间步长',
      code: ERROR_CODES.MISSING_FIELD
    });
  } else {
    if (params.timeStep < VALIDATION_RULES.timeStep.min || params.timeStep > VALIDATION_RULES.timeStep.max) {
      errors.push({
        field: 'timeStep',
        message: `时间步长必须在 ${VALIDATION_RULES.timeStep.min}-${VALIDATION_RULES.timeStep.max} 秒之间`,
        code: ERROR_CODES.TIME_STEP_OUT_OF_RANGE
      });
    } else if (params.timeStep > VALIDATION_RULES.timeStep.recommendedMax) {
      errors.push({
        field: 'timeStep',
        message: `时间步长建议不超过 ${VALIDATION_RULES.timeStep.recommendedMax} 秒，过大可能影响计算精度`,
        code: ERROR_CODES.TIME_STEP_TOO_LARGE
      });
    }
  }

  if (params.ovenTemperature === undefined || params.ovenTemperature === null) {
    errors.push({
      field: 'ovenTemperature',
      message: '请输入烤箱温度',
      code: ERROR_CODES.MISSING_FIELD
    });
  } else {
    if (params.ovenTemperature < VALIDATION_RULES.ovenTemperature.min || params.ovenTemperature > VALIDATION_RULES.ovenTemperature.max) {
      errors.push({
        field: 'ovenTemperature',
        message: `烤箱温度必须在 ${VALIDATION_RULES.ovenTemperature.min}-${VALIDATION_RULES.ovenTemperature.max} °C 之间`,
        code: ERROR_CODES.TEMP_OUT_OF_RANGE
      });
    }
  }

  if (params.initialTemperature === undefined || params.initialTemperature === null) {
    errors.push({
      field: 'initialTemperature',
      message: '请输入初始温度',
      code: ERROR_CODES.MISSING_FIELD
    });
  } else {
    if (params.initialTemperature < VALIDATION_RULES.initialTemperature.min || params.initialTemperature > VALIDATION_RULES.initialTemperature.max) {
      errors.push({
        field: 'initialTemperature',
        message: `初始温度必须在 ${VALIDATION_RULES.initialTemperature.min}-${VALIDATION_RULES.initialTemperature.max} °C 之间`,
        code: ERROR_CODES.TEMP_OUT_OF_RANGE
      });
    }
  }

  if (!params.cakeDimensions) {
    errors.push({
      field: 'cakeDimensions',
      message: '请输入蛋糕尺寸',
      code: ERROR_CODES.MISSING_FIELD
    });
  } else {
    if (!params.cakeDimensions.diameter) {
      errors.push({
        field: 'cakeDimensions.diameter',
        message: '请输入蛋糕直径',
        code: ERROR_CODES.MISSING_FIELD
      });
    } else if (params.cakeDimensions.diameter < VALIDATION_RULES.cakeDiameter.min || params.cakeDimensions.diameter > VALIDATION_RULES.cakeDiameter.max) {
      errors.push({
        field: 'cakeDimensions.diameter',
        message: `蛋糕直径必须在 ${VALIDATION_RULES.cakeDiameter.min}-${VALIDATION_RULES.cakeDiameter.max} cm 之间`,
        code: ERROR_CODES.DIMENSION_OUT_OF_RANGE
      });
    }

    if (!params.cakeDimensions.height) {
      errors.push({
        field: 'cakeDimensions.height',
        message: '请输入蛋糕高度',
        code: ERROR_CODES.MISSING_FIELD
      });
    } else if (params.cakeDimensions.height < VALIDATION_RULES.cakeHeight.min || params.cakeDimensions.height > VALIDATION_RULES.cakeHeight.max) {
      errors.push({
        field: 'cakeDimensions.height',
        message: `蛋糕高度必须在 ${VALIDATION_RULES.cakeHeight.min}-${VALIDATION_RULES.cakeHeight.max} cm 之间`,
        code: ERROR_CODES.DIMENSION_OUT_OF_RANGE
      });
    }
  }

  if (params.totalTime === undefined || params.totalTime === null) {
    errors.push({
      field: 'totalTime',
      message: '请输入总模拟时间',
      code: ERROR_CODES.MISSING_FIELD
    });
  } else {
    if (params.totalTime < VALIDATION_RULES.totalTime.min || params.totalTime > VALIDATION_RULES.totalTime.max) {
      errors.push({
        field: 'totalTime',
        message: `总模拟时间必须在 ${VALIDATION_RULES.totalTime.min}-${VALIDATION_RULES.totalTime.max} 秒之间`,
        code: ERROR_CODES.TOTAL_TIME_OUT_OF_RANGE
      });
    }
  }

  const paramSignature = generateParamSignature(params);
  if (existingSimulations.includes(paramSignature)) {
    errors.push({
      field: 'simulation',
      message: '相同参数的模拟已存在，请修改参数后重试',
      code: ERROR_CODES.DUPLICATE_SIMULATION
    });
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export function generateParamSignature(params: Partial<SimulationParams>): string {
  return `${params.materialId}-${params.ovenTemperature}-${params.initialTemperature}-${params.cakeDimensions?.diameter}-${params.cakeDimensions?.height}-${params.timeStep}-${params.totalTime}`;
}

export function validateStateTransition(
  currentStatus: string,
  targetStatus: string
): boolean {
  const validTransitions: Record<string, string[]> = {
    'idle': ['running'],
    'running': ['completed', 'error'],
    'completed': ['idle'],
    'error': ['idle']
  };

  return validTransitions[currentStatus]?.includes(targetStatus) ?? false;
}

export function hasCriticalErrors(errors: ValidationError[]): boolean {
  const warningCodes = [ERROR_CODES.TIME_STEP_TOO_LARGE];
  return errors.some(e => !warningCodes.includes(e.code));
}
