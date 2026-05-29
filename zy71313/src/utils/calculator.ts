import type {
  ParameterWithUnit,
  LengthUnit,
  ViscosityUnit,
  ConversionStep,
  Anomaly,
  FlowRegime,
  CalculationResult,
} from '@/types';

function convertLength(value: number, from: LengthUnit): { siValue: number; formula: string } {
  if (from === 'm') {
    return { siValue: value, formula: `${value} m = ${value} m` };
  }
  const si = value / 1000;
  return { siValue: si, formula: `${value} mm ÷ 1000 = ${si} m` };
}

function convertViscosity(value: number, from: ViscosityUnit): { siValue: number; formula: string } {
  if (from === 'Pa·s') {
    return { siValue: value, formula: `${value} Pa·s = ${value} Pa·s` };
  }
  const si = value / 1000;
  return { siValue: si, formula: `${value} mPa·s ÷ 1000 = ${si} Pa·s` };
}

export function calculate(
  pipeDiameter: ParameterWithUnit<LengthUnit>,
  velocity: ParameterWithUnit<'m/s'>,
  density: ParameterWithUnit<'kg/m³'>,
  viscosity: ParameterWithUnit<ViscosityUnit>,
  temperature: ParameterWithUnit<'℃'>
): CalculationResult {
  const conversionSteps: ConversionStep[] = [];
  const anomalies: Anomaly[] = [];

  if (pipeDiameter.value === null || velocity.value === null || density.value === null || viscosity.value === null) {
    return {
      reynoldsNumber: null,
      flowRegime: null,
      isCritical: false,
      conversionSteps: [],
      anomalies: [{
        type: 'temperature_missing',
        field: 'temperature',
        fieldLabel: '温度',
        message: '缺少必要参数，无法计算雷诺数',
        suggestion: '请填写所有参数（管径、流速、密度、黏度）',
        severity: 'error',
      }],
      canCalculate: false,
    };
  }

  const dConversion = convertLength(pipeDiameter.value, pipeDiameter.unit);
  conversionSteps.push({
    parameter: 'pipeDiameter',
    parameterLabel: '管径 d',
    fromValue: pipeDiameter.value,
    fromUnit: pipeDiameter.unit,
    toValue: dConversion.siValue,
    toUnit: 'm',
    formula: dConversion.formula,
  });

  conversionSteps.push({
    parameter: 'velocity',
    parameterLabel: '流速 v',
    fromValue: velocity.value,
    fromUnit: velocity.unit,
    toValue: velocity.value,
    toUnit: 'm/s',
    formula: `${velocity.value} m/s（已是SI单位）`,
  });

  conversionSteps.push({
    parameter: 'density',
    parameterLabel: '密度 ρ',
    fromValue: density.value,
    fromUnit: density.unit,
    toValue: density.value,
    toUnit: 'kg/m³',
    formula: `${density.value} kg/m³（已是SI单位）`,
  });

  const muConversion = convertViscosity(viscosity.value, viscosity.unit);
  conversionSteps.push({
    parameter: 'viscosity',
    parameterLabel: '黏度 μ',
    fromValue: viscosity.value,
    fromUnit: viscosity.unit,
    toValue: muConversion.siValue,
    toUnit: 'Pa·s',
    formula: muConversion.formula,
  });

  if (temperature.value !== null) {
    conversionSteps.push({
      parameter: 'temperature',
      parameterLabel: '温度 T',
      fromValue: temperature.value,
      fromUnit: temperature.unit,
      toValue: temperature.value,
      toUnit: '℃',
      formula: `${temperature.value} ℃（参考值，不参与Re计算）`,
    });
  }

  if (viscosity.unit === 'Pa·s' && viscosity.value >= 0.5) {
    anomalies.push({
      type: 'viscosity_unit_mismatch',
      field: 'viscosity',
      fieldLabel: '黏度',
      message: `黏度值 ${viscosity.value} Pa·s 偏大，常见水在20℃时约 0.001 Pa·s（1 mPa·s），可能单位应为 mPa·s`,
      suggestion: `若实际为 ${viscosity.value} mPa·s，换算后为 ${(viscosity.value / 1000).toFixed(6)} Pa·s，请确认单位`,
      severity: 'warning',
    });
  }

  if (temperature.value === null) {
    anomalies.push({
      type: 'temperature_missing',
      field: 'temperature',
      fieldLabel: '温度',
      message: '温度数据缺失，无法验证黏度值的温度合理性',
      suggestion: '请补充实验温度，以便核对黏度是否与温度匹配',
      severity: 'warning',
    });
  }

  const d = dConversion.siValue;
  const v = velocity.value;
  const rho = density.value;
  const mu = muConversion.siValue;

  const Re = (rho * v * d) / mu;

  let flowRegime: FlowRegime;
  let isCritical = false;

  if (Re < 2000) {
    flowRegime = 'laminar';
  } else if (Re <= 4000) {
    flowRegime = 'transitional';
    isCritical = true;
    anomalies.push({
      type: 'critical_zone',
      field: 'reynoldsNumber',
      fieldLabel: '雷诺数',
      message: `Re = ${Re.toFixed(1)} 处于临界过渡区（2000~4000），流态不稳定`,
      suggestion: '临界区流态可能受扰动影响而在层流与紊流间切换，实验中需特别注意',
      severity: 'warning',
    });
  } else {
    flowRegime = 'turbulent';
  }

  return {
    reynoldsNumber: Re,
    flowRegime,
    isCritical,
    conversionSteps,
    anomalies,
    canCalculate: true,
  };
}

export function getFlowRegimeLabel(regime: FlowRegime): string {
  switch (regime) {
    case 'laminar': return '层流';
    case 'transitional': return '过渡区';
    case 'turbulent': return '紊流';
  }
}

export function getFlowRegimeColor(regime: FlowRegime): string {
  switch (regime) {
    case 'laminar': return '#2ECC71';
    case 'transitional': return '#F39C12';
    case 'turbulent': return '#E74C3C';
  }
}

export function getFlowRegimeBgClass(regime: FlowRegime): string {
  switch (regime) {
    case 'laminar': return 'bg-emerald-100 text-emerald-800 border-emerald-300';
    case 'transitional': return 'bg-amber-100 text-amber-800 border-amber-300';
    case 'turbulent': return 'bg-red-100 text-red-800 border-red-300';
  }
}

export function formatRe(re: number): string {
  if (re >= 10000) return re.toFixed(0);
  if (re >= 1000) return re.toFixed(1);
  if (re >= 100) return re.toFixed(2);
  return re.toFixed(3);
}
