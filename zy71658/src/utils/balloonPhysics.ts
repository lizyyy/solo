import type { BalloonParams, BuoyancyResult, ValidationError, LaunchWindowResult, SafetyThresholds } from '../types';

const STANDARD_AIR_DENSITY = 1.225;
const GRAVITY = 9.81;

export const DEFAULT_THRESHOLDS: SafetyThresholds = {
  maxWindSpeed: 5,
  minTemperature: -10,
  maxTemperature: 45,
  maxPayload: 500,
  minVolume: 500,
};

export function normalizeTemperature(value: number | null, unit: string): { celsius: number | null; errors: ValidationError[] } {
  const errors: ValidationError[] = [];
  
  if (value === null || isNaN(value)) {
    return { celsius: null, errors };
  }

  let celsius: number;
  const upperUnit = unit.toUpperCase().trim();

  switch (upperUnit) {
    case 'C':
    case '°C':
    case 'CELSIUS':
      celsius = value;
      break;
    case 'F':
    case '°F':
    case 'FAHRENHEIT':
      celsius = (value - 32) * 5 / 9;
      break;
    case 'K':
    case 'KELVIN':
      celsius = value - 273.15;
      break;
    default:
      errors.push({
        field: 'temperature',
        step: '单位校验',
        message: '无法识别的温度单位，请使用 °C、°F 或 K',
        severity: 'error',
        actualValue: unit || '未填写',
        expectedRange: '°C, °F, K',
      });
      return { celsius: null, errors };
  }

  return { celsius, errors };
}

export function normalizePayload(value: number | null, unit: string): { kg: number | null; errors: ValidationError[] } {
  const errors: ValidationError[] = [];
  
  if (value === null || isNaN(value)) {
    return { kg: null, errors };
  }

  let kg: number;
  const lowerUnit = unit.toLowerCase().trim();

  switch (lowerUnit) {
    case 'kg':
    case 'kgs':
    case '千克':
    case '公斤':
      kg = value;
      break;
    case 'lb':
    case 'lbs':
    case 'pound':
    case '磅':
      kg = value * 0.453592;
      break;
    case 'g':
    case '克':
      kg = value / 1000;
      break;
    default:
      errors.push({
        field: 'payload',
        step: '单位校验',
        message: '无法识别的重量单位，请使用 kg、lb 或 g',
        severity: 'error',
        actualValue: unit || '未填写',
        expectedRange: 'kg, lb, g',
      });
      return { kg: null, errors };
  }

  return { kg, errors };
}

export function normalizeWindSpeed(value: number | null, unit: string): { mps: number | null; errors: ValidationError[] } {
  const errors: ValidationError[] = [];
  
  if (value === null || isNaN(value)) {
    return { mps: null, errors };
  }

  let mps: number;
  const lowerUnit = unit.toLowerCase().trim();

  switch (lowerUnit) {
    case 'm/s':
    case 'mps':
    case '米/秒':
      mps = value;
      break;
    case 'km/h':
    case 'kph':
    case '公里/小时':
      mps = value / 3.6;
      break;
    case 'mph':
    case '英里/小时':
      mps = value * 0.44704;
      break;
    case 'knots':
    case 'knot':
    case 'kt':
    case '节':
      mps = value * 0.51444;
      break;
    default:
      errors.push({
        field: 'windSpeed',
        step: '单位校验',
        message: '无法识别的风速单位，请使用 m/s、km/h、mph 或 knots',
        severity: 'error',
        actualValue: unit || '未填写',
        expectedRange: 'm/s, km/h, mph, knots',
      });
      return { mps: null, errors };
  }

  return { mps, errors };
}

export function normalizeVolume(value: number | null, unit: string): { cubicMeters: number | null; errors: ValidationError[] } {
  const errors: ValidationError[] = [];
  
  if (value === null || isNaN(value)) {
    return { cubicMeters: null, errors };
  }

  let cubicMeters: number;
  const lowerUnit = unit.toLowerCase().trim();

  switch (lowerUnit) {
    case 'm³':
    case 'm3':
    case '立方米':
    case '立方':
      cubicMeters = value;
      break;
    case 'ft³':
    case 'ft3':
    case 'cu ft':
    case '立方英尺':
      cubicMeters = value * 0.0283168;
      break;
    case 'l':
    case 'liter':
    case '升':
      cubicMeters = value / 1000;
      break;
    default:
      errors.push({
        field: 'balloonVolume',
        step: '单位校验',
        message: '无法识别的体积单位，请使用 m³、ft³ 或 L',
        severity: 'error',
        actualValue: unit || '未填写',
        expectedRange: 'm³, ft³, L',
      });
      return { cubicMeters: null, errors };
  }

  return { cubicMeters, errors };
}

export function calculateBuoyancy(
  tempCelsius: number, volumeCubicMeters: number, payloadKg: number): BuoyancyResult {
  const ambientTemp = 20;
  const hotAirTemp = tempCelsius;
  
  const hotAirDensity = STANDARD_AIR_DENSITY * (273.15 + ambientTemp) / (273.15 + hotAirTemp);
  const airMass = STANDARD_AIR_DENSITY * volumeCubicMeters;
  const hotAirMass = hotAirDensity * volumeCubicMeters;
  const buoyantForce = (airMass - hotAirMass) * GRAVITY;
  const payloadWeight = payloadKg * GRAVITY;
  const envelopeWeight = volumeCubicMeters * 0.05 * GRAVITY;
  const netLift = buoyantForce - payloadWeight - envelopeWeight;

  return {
    buoyantForce,
    netLift,
    airDensity: STANDARD_AIR_DENSITY,
    hotAirDensity,
    isValid: true,
  };
}

export function validateSafetyConstraints(
  tempCelsius: number | null, windMps: number | null, payloadKg: number | null, volumeM3: number | null, thresholds: SafetyThresholds): { errors: ValidationError[]; warnings: ValidationError[] } {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  if (tempCelsius !== null) {
    if (tempCelsius < thresholds.minTemperature) {
      errors.push({
        field: 'temperature',
        step: '温度安全检查',
        message: '气温过低，低于安全下限',
        severity: 'error',
        actualValue: `${tempCelsius.toFixed(1)}°C`,
        expectedRange: `${thresholds.minTemperature}°C 以上`,
      });
    } else if (tempCelsius > thresholds.maxTemperature) {
      errors.push({
        field: 'temperature',
        step: '温度安全检查',
        message: '气温过高，高于安全上限',
        severity: 'error',
        actualValue: `${tempCelsius.toFixed(1)}°C`,
        expectedRange: `${thresholds.maxTemperature}°C 以下`,
      });
    } else if (tempCelsius < 0 || tempCelsius > 35) {
      warnings.push({
        field: 'temperature',
        step: '温度安全检查',
        message: '气温接近边界值，建议谨慎操作',
        severity: 'warning',
        actualValue: `${tempCelsius.toFixed(1)}°C`,
      });
    }
  }

  if (windMps !== null) {
    if (windMps > thresholds.maxWindSpeed) {
      errors.push({
        field: 'windSpeed',
        step: '风速安全检查',
        message: '风速过大，存在飞行安全隐患',
        severity: 'error',
        actualValue: `${windMps.toFixed(1)} m/s`,
        expectedRange: `${thresholds.maxWindSpeed} m/s 以下`,
      });
    } else if (windMps > thresholds.maxWindSpeed * 0.7) {
      warnings.push({
        field: 'windSpeed',
        step: '风速安全检查',
        message: '风速较高，需要经验丰富人员操作',
        severity: 'warning',
        actualValue: `${windMps.toFixed(1)} m/s`,
      });
    }
  }

  if (payloadKg !== null) {
    if (payloadKg > thresholds.maxPayload) {
      errors.push({
        field: 'payload',
        step: '载重安全检查',
        message: '载重超过最大限制',
        severity: 'error',
        actualValue: `${payloadKg.toFixed(1)} kg`,
        expectedRange: `${thresholds.maxPayload} kg 以下`,
      });
    } else if (payloadKg > thresholds.maxPayload * 0.8) {
      warnings.push({
        field: 'payload',
        step: '载重安全检查',
        message: '载重较高，注意配重平衡',
        severity: 'warning',
        actualValue: `${payloadKg.toFixed(1)} kg`,
      });
    }
  }

  if (volumeM3 !== null) {
    if (volumeM3 < thresholds.minVolume) {
      errors.push({
        field: 'balloonVolume',
        step: '气囊安全检查',
        message: '气囊体积过小，浮力不足',
        severity: 'error',
        actualValue: `${volumeM3.toFixed(0)} m³`,
        expectedRange: `${thresholds.minVolume} m³ 以上`,
      });
    }
  }

  return { errors, warnings };
}

export function analyzeLaunchWindow(params: BalloonParams, thresholds: SafetyThresholds = DEFAULT_THRESHOLDS): LaunchWindowResult {
  const allErrors: ValidationError[] = [];
  const allWarnings: ValidationError[] = [];
  const recommendations: string[] = [];

  const { celsius: tempCelsius, errors: tempErrors } = normalizeTemperature(params.temperature, params.temperatureUnit);
  allErrors.push(...tempErrors);

  const { kg: payloadKg, errors: payloadErrors } = normalizePayload(params.payload, params.payloadUnit);
  allErrors.push(...payloadErrors);

  const { mps: windMps, errors: windErrors } = normalizeWindSpeed(params.windSpeed, params.windSpeedUnit);
  allErrors.push(...windErrors);

  const { cubicMeters: volumeM3, errors: volumeErrors } = normalizeVolume(params.balloonVolume, params.volumeUnit);
  allErrors.push(...volumeErrors);

  const { errors: safetyErrors, warnings: safetyWarnings } = validateSafetyConstraints(tempCelsius, windMps, payloadKg, volumeM3, thresholds);
  allErrors.push(...safetyErrors);
  allWarnings.push(...safetyWarnings);

  let buoyancy: BuoyancyResult | null = null;

  if (tempCelsius !== null && volumeM3 !== null && payloadKg !== null && allErrors.length === 0) {
    buoyancy = calculateBuoyancy(tempCelsius, volumeM3, payloadKg);
    
    if (buoyancy.netLift < 0) {
      allErrors.push({
        field: 'buoyancy',
        step: '浮力计算',
        message: '净升力为负，无法升空',
        severity: 'error',
        actualValue: `${buoyancy.netLift.toFixed(1)} N`,
        expectedRange: '0 N 以上',
      });
    } else if (buoyancy.netLift < 50) {
      allWarnings.push({
        field: 'buoyancy',
        step: '浮力计算',
        message: '净升力较小，升空缓慢',
        severity: 'warning',
        actualValue: `${buoyancy.netLift.toFixed(1)} N`,
      });
    }
  }

  const canLaunch = allErrors.length === 0;
  let status: LaunchWindowResult['status'] = 'unknown';
  
  if (allErrors.length > 0) {
    status = 'danger';
  } else if (allWarnings.length > 0) {
    status = 'warning';
  } else if (canLaunch) {
    status = 'safe';
  }

  if (tempCelsius === null && params.temperature === null) {
    recommendations.push('请填写气温数据');
  }
  if (payloadKg === null && params.payload === null) {
    recommendations.push('请填写载重数据');
  }
  if (windMps === null && params.windSpeed === null) {
    recommendations.push('请填写风速数据');
  }
  if (volumeM3 === null && params.balloonVolume === null) {
    recommendations.push('请填写气囊体积');
  }

  if (canLaunch) {
    recommendations.push('可以安全升空，祝您实验顺利！');
  }

  return {
    canLaunch,
    status,
    buoyancy,
    errors: allErrors,
    warnings: allWarnings,
    recommendations,
    timestamp: new Date(),
  };
}
