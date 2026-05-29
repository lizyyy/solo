import { SimulationParams, CalculationLog, BoundaryWarning, TEACHING_RANGES } from '../types';

export const FARADAY_FORMULA = 'ε = -N · dΦ/dt';
export const FLUX_FORMULA = 'Φ = B · A · cos(θ)';

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

export async function calculateDataHash(data: unknown): Promise<string> {
  const jsonStr = JSON.stringify(data);
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(jsonStr);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function calculateInduction(params: SimulationParams): CalculationLog {
  const { turns, fieldStrength, velocity, area, samplePoints, direction } = params;
  
  const maxFlux = fieldStrength * area;
  const angularFrequency = (velocity * direction) / 0.1;
  
  const timePoints: number[] = [];
  const voltage: number[] = [];
  
  const totalTime = (2 * Math.PI) / Math.abs(angularFrequency);
  const timeStep = totalTime / samplePoints;
  
  let maxVoltage = -Infinity;
  let minVoltage = Infinity;
  
  for (let i = 0; i < samplePoints; i++) {
    const t = i * timeStep;
    timePoints.push(t);
    
    const flux = maxFlux * Math.cos(angularFrequency * t);
    const dFlux_dt = -maxFlux * angularFrequency * Math.sin(angularFrequency * t);
    const inducedVoltage = -turns * dFlux_dt;
    
    voltage.push(inducedVoltage);
    
    if (inducedVoltage > maxVoltage) maxVoltage = inducedVoltage;
    if (inducedVoltage < minVoltage) minVoltage = inducedVoltage;
  }
  
  const dFlux_dt = maxFlux * angularFrequency;
  
  return {
    stepId: generateId(),
    timestamp: Date.now(),
    formula: FARADAY_FORMULA,
    rawInputs: { ...params },
    intermediate: {
      maxFlux,
      dFlux_dt,
    },
    result: {
      voltage,
      maxVoltage,
      minVoltage,
      timePoints,
    },
  };
}

export function checkBoundaryConditions(params: SimulationParams): BoundaryWarning[] {
  const warnings: BoundaryWarning[] = [];
  
  if (params.turns === 0) {
    warnings.push({
      id: generateId(),
      type: 'zero_turns',
      severity: 'to_confirm',
      message: '线圈匝数为0，感应电压将恒为0，请确认是否为有意设置',
      confirmed: false,
    });
  }
  
  if (params.direction === -1) {
    warnings.push({
      id: generateId(),
      type: 'reverse_direction',
      severity: 'warning',
      message: '运动方向为反向，电压曲线相位已反转',
      confirmed: false,
    });
  }
  
  if (params.samplePoints < 20) {
    warnings.push({
      id: generateId(),
      type: 'curve_truncated',
      severity: 'to_confirm',
      message: '采样点数过少，曲线可能出现截断，峰值数据可能不准确',
      confirmed: false,
    });
  }
  
  const { turns, fieldStrength, velocity, area } = TEACHING_RANGES;
  
  if (params.turns < turns.min || params.turns > turns.max ||
      params.fieldStrength < fieldStrength.min || params.fieldStrength > fieldStrength.max ||
      params.velocity < velocity.min || params.velocity > velocity.max ||
      params.area < area.min || params.area > area.max) {
    warnings.push({
      id: generateId(),
      type: 'extreme_value',
      severity: 'warning',
      message: '部分参数超出教学常用范围，请注意验证结果合理性',
      confirmed: false,
    });
  }
  
  return warnings;
}

export function formatNumber(num: number, decimals: number = 4): string {
  return num.toFixed(decimals);
}

export function formatScientific(num: number): string {
  if (Math.abs(num) < 0.001 || Math.abs(num) >= 10000) {
    return num.toExponential(3);
  }
  return num.toFixed(4);
}
