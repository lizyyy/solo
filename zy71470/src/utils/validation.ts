import type { FilmParams, ValidationWarning } from '@/types';
import { toRadians } from './unitConversion';

export interface ValidationResult {
  warnings: ValidationWarning[];
  isValid: boolean;
  hasErrors: boolean;
}

const PHYSICAL_LIMITS = {
  thickness: { min: 0, max: 10000, unit: 'nm' },
  refractiveIndex: { min: 1.0, max: 5.0, unit: '' },
  incidentAngleDegree: { min: 0, max: 89, unit: '°' },
  incidentAngleRadian: { min: 0, max: 1.55, unit: 'rad' },
  wavelength: { min: 380, max: 780, unit: 'nm' },
  wavelengthRangeMin: { min: 50, unit: 'nm' },
};

export const validateParams = (params: FilmParams): ValidationResult => {
  const warnings: ValidationWarning[] = [];

  warnings.push(...validateThickness(params.thickness));
  warnings.push(...validateRefractiveIndex(params.refractiveIndex, '薄膜折射率'));
  warnings.push(...validateRefractiveIndex(params.substrateN, '基板折射率'));
  warnings.push(...validateRefractiveIndex(params.ambientN, '环境折射率'));
  warnings.push(...validateIncidentAngle(params.incidentAngle, params.angleUnit));
  warnings.push(...validateWavelengthRange(params.wavelengthRange));
  warnings.push(...validateRefractiveIndexOrder(params));

  const hasErrors = warnings.some((w) => w.level === 'error');

  return {
    warnings,
    isValid: warnings.length === 0,
    hasErrors,
  };
};

const validateThickness = (thickness: number): ValidationWarning[] => {
  const warnings: ValidationWarning[] = [];
  const { min, max, unit } = PHYSICAL_LIMITS.thickness;

  if (thickness < min) {
    warnings.push({
      id: 'thickness-negative',
      level: 'error',
      field: 'thickness',
      message: `薄膜厚度不能为负值。当前值: ${thickness} ${unit}`,
      affectedCalculations: ['光程差计算', '相位差计算', '干涉级次分析', '光谱反射率曲线'],
      suggestion: `请输入 ${min} - ${max} ${unit} 范围内的厚度值`,
    });
  } else if (thickness > max) {
    warnings.push({
      id: 'thickness-too-large',
      level: 'warning',
      field: 'thickness',
      message: `薄膜厚度超出推荐范围。当前值: ${thickness} ${unit}，推荐最大值: ${max} ${unit}`,
      affectedCalculations: ['干涉级次计算', '光谱分辨率', '颜色映射准确性'],
      suggestion: '过大的厚度会导致干涉条纹过密，计算精度下降。建议减小厚度或使用高精度模式。',
    });
  } else if (thickness === 0) {
    warnings.push({
      id: 'thickness-zero',
      level: 'info',
      field: 'thickness',
      message: '薄膜厚度为0，相当于没有薄膜层',
      affectedCalculations: ['所有干涉相关计算'],
      suggestion: '如果想观察基板反射特性，可以将厚度设置为0，但请注意这不是典型的薄膜干涉情况。',
    });
  }

  if (thickness > 0 && thickness < 10) {
    warnings.push({
      id: 'thickness-too-thin',
      level: 'warning',
      field: 'thickness',
      message: `薄膜非常薄 (${thickness} ${unit})，干涉效应可能不明显`,
      affectedCalculations: ['反射颜色饱和度', '干涉条纹对比度'],
      suggestion: '建议增加厚度以观察更明显的干涉现象，或尝试调整入射角。',
    });
  }

  return warnings;
};

const validateRefractiveIndex = (
  n: number,
  name: string
): ValidationWarning[] => {
  const warnings: ValidationWarning[] = [];
  const { min, max } = PHYSICAL_LIMITS.refractiveIndex;

  if (n < min) {
    warnings.push({
      id: `refractive-index-low-${name}`,
      level: 'error',
      field: 'refractiveIndex',
      message: `${name}不能小于${min}。当前值: ${n}`,
      affectedCalculations: ['菲涅耳系数计算', '折射角计算', '全反射条件判断', '光程差计算'],
      suggestion: `请输入 ${min} - ${max} 范围内的折射率值`,
    });
  } else if (n > max) {
    warnings.push({
      id: `refractive-index-high-${name}`,
      level: 'warning',
      field: 'refractiveIndex',
      message: `${name}超出常见透明材料范围。当前值: ${n}，推荐最大值: ${max}`,
      affectedCalculations: ['菲涅耳系数准确性', '颜色映射结果'],
      suggestion: '常见透明材料折射率一般在1.0-2.5之间。如果是特殊材料，请确认数值准确性。',
    });
  }

  return warnings;
};

const validateIncidentAngle = (
  angle: number,
  unit: 'degree' | 'radian'
): ValidationWarning[] => {
  const warnings: ValidationWarning[] = [];

  if (unit === 'degree') {
    const { min, max } = PHYSICAL_LIMITS.incidentAngleDegree;

    if (angle < min || angle > max) {
      warnings.push({
        id: 'angle-out-of-range-degree',
        level: 'error',
        field: 'incidentAngle',
        message: `入射角超出有效范围。当前值: ${angle}°，有效范围: ${min}° - ${max}°`,
        affectedCalculations: ['折射角计算 (90°时分母为零)', '光程差公式', '菲涅耳系数'],
        suggestion: `请确保入射角在 ${min}° - ${max}° 范围内`,
      });
    } else if (angle > 80) {
      warnings.push({
        id: 'angle-large-degree',
        level: 'warning',
        field: 'incidentAngle',
        message: `入射角较大 (${angle}°)，可能接近全反射条件`,
        affectedCalculations: ['反射光强分布', '颜色准确性', '透射光计算'],
        suggestion: '请注意观察是否发生全反射，此时反射率为100%，颜色接近光源白色。',
      });
    }
  } else {
    const { min, max } = PHYSICAL_LIMITS.incidentAngleRadian;

    if (angle < min || angle > max) {
      warnings.push({
        id: 'angle-out-of-range-radian',
        level: 'error',
        field: 'incidentAngle',
        message: `入射角超出有效范围。当前值: ${angle.toFixed(4)} rad，有效范围: ${min} - ${max.toFixed(4)} rad`,
        affectedCalculations: ['折射角计算 (π/2时分母为零)', '光程差公式', '菲涅耳系数'],
        suggestion: `请确保入射角在 ${min} - ${max.toFixed(4)} rad 范围内`,
      });
    }
  }

  if (unit === 'radian' && angle > 0 && angle < 0.02) {
    warnings.push({
      id: 'angle-maybe-degree',
      level: 'warning',
      field: 'angleUnit',
      message: '弧度值很小，是否误将角度值当作弧度输入？',
      affectedCalculations: ['所有依赖入射角的计算结果'],
      suggestion: `如果您想输入 ${(angle * 180 / Math.PI).toFixed(1)}°，请切换到角度单位；否则可以忽略此警告。`,
    });
  }

  if (unit === 'degree' && angle > 0 && Math.abs(angle - 3.14) < 0.1) {
    warnings.push({
      id: 'angle-maybe-radian',
      level: 'warning',
      field: 'angleUnit',
      message: '角度值接近π，是否误将弧度值当作角度输入？',
      affectedCalculations: ['所有依赖入射角的计算结果'],
      suggestion: `如果您想输入 π 弧度，请切换到弧度单位；否则可以忽略此警告。`,
    });
  }

  return warnings;
};

const validateWavelengthRange = (range: {
  min: number;
  max: number;
}): ValidationWarning[] => {
  const warnings: ValidationWarning[] = [];
  const { min: globalMin, max: globalMax } = PHYSICAL_LIMITS.wavelength;
  const { min: rangeMin } = PHYSICAL_LIMITS.wavelengthRangeMin;

  if (range.min >= range.max) {
    warnings.push({
      id: 'wavelength-invalid-range',
      level: 'error',
      field: 'wavelengthRange',
      message: `波长范围无效：最小值 (${range.min} nm) 必须小于最大值 (${range.max} nm)`,
      affectedCalculations: ['光谱采样', '颜色积分', '主波长计算', '光谱曲线图'],
      suggestion: '请调整波长范围，确保最小值小于最大值',
    });
    return warnings;
  }

  if (range.min < globalMin) {
    warnings.push({
      id: 'wavelength-min-too-low',
      level: 'warning',
      field: 'wavelengthRange',
      message: `最小波长低于可见光范围。当前值: ${range.min} nm，可见光下限: ${globalMin} nm`,
      affectedCalculations: ['颜色映射 (紫外区域人眼不可见)', '光谱积分结果'],
      suggestion: `建议将最小波长设置在 ${globalMin}-${globalMax} nm 可见光范围内，以获得有意义的颜色结果。`,
    });
  }

  if (range.max > globalMax) {
    warnings.push({
      id: 'wavelength-max-too-high',
      level: 'warning',
      field: 'wavelengthRange',
      message: `最大波长高于可见光范围。当前值: ${range.max} nm，可见光上限: ${globalMax} nm`,
      affectedCalculations: ['颜色映射 (红外区域人眼不可见)', '光谱积分结果'],
      suggestion: `建议将最大波长设置在 ${globalMin}-${globalMax} nm 可见光范围内，以获得有意义的颜色结果。`,
    });
  }

  if (range.max - range.min < rangeMin) {
    warnings.push({
      id: 'wavelength-range-too-narrow',
      level: 'warning',
      field: 'wavelengthRange',
      message: `波长范围过窄。当前带宽: ${range.max - range.min} nm，建议至少: ${rangeMin} nm`,
      affectedCalculations: ['光谱积分稳定性', '颜色计算准确性', '光谱曲线可读性'],
      suggestion: '波长范围过窄可能导致计算结果不稳定，建议扩展波长范围以获得更可靠的颜色映射。',
    });
  }

  if (range.min > 450 || range.max < 650) {
    warnings.push({
      id: 'wavelength-range-partial',
      level: 'info',
      field: 'wavelengthRange',
      message: '波长范围未覆盖完整可见光光谱',
      affectedCalculations: ['颜色完整性 (缺少部分可见光谱成分)'],
      suggestion: '完整的可见光范围是380-780nm，当前设置可能会导致颜色不够丰富。',
    });
  }

  return warnings;
};

const validateRefractiveIndexOrder = (params: FilmParams): ValidationWarning[] => {
  const warnings: ValidationWarning[] = [];
  const { ambientN, refractiveIndex, substrateN, incidentAngle, angleUnit } = params;

  if (refractiveIndex <= ambientN && refractiveIndex <= substrateN) {
    warnings.push({
      id: 'refractive-index-low-film',
      level: 'info',
      field: 'refractiveIndex',
      message: '薄膜折射率低于两侧介质，属于低折射率膜',
      affectedCalculations: ['相位突变条件 (两束反射光都有或都没有半波损失)'],
      suggestion: '这种情况下，两束反射光的相位突变条件相同，光程差不需要额外加λ/2。',
    });
  }

  if (refractiveIndex >= ambientN && refractiveIndex >= substrateN) {
    warnings.push({
      id: 'refractive-index-high-film',
      level: 'info',
      field: 'refractiveIndex',
      message: '薄膜折射率高于两侧介质，属于高折射率膜',
      affectedCalculations: ['相位突变条件 (一束有半波损失，另一束没有)'],
      suggestion: '这种情况下，两束反射光的相位突变条件不同，光程差需要额外加λ/2。',
    });
  }

  const theta1 = toRadians(incidentAngle, angleUnit);
  const criticalAngle = Math.asin(ambientN / refractiveIndex);

  if (refractiveIndex > ambientN && theta1 > criticalAngle) {
    warnings.push({
      id: 'total-internal-reflection',
      level: 'warning',
      field: 'general',
      message: '发生全反射！入射角超过临界角',
      affectedCalculations: ['反射率计算 (变为100%)', '颜色计算 (接近光源色)', '透射光消失'],
      suggestion: '全反射时反射光没有选择吸收，颜色将接近光源白色。减小入射角可观察薄膜干涉颜色。',
    });
  }

  return warnings;
};

export const getWarningSeverityColor = (level: ValidationWarning['level']): string => {
  switch (level) {
    case 'error':
      return 'bg-red-500/20 border-red-500 text-red-300';
    case 'warning':
      return 'bg-yellow-500/20 border-yellow-500 text-yellow-300';
    case 'info':
      return 'bg-blue-500/20 border-blue-500 text-blue-300';
  }
};

export const getWarningIcon = (level: ValidationWarning['level']): string => {
  switch (level) {
    case 'error':
      return 'circle-x';
    case 'warning':
      return 'triangle-alert';
    case 'info':
      return 'info';
  }
};
