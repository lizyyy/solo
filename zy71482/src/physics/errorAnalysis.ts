import { StoneParams, AnalysisError, MIN_FRICTION, MAX_FRICTION, MIN_VELOCITY, MAX_VELOCITY, DataSource } from '../types';

function generateId(): string {
  return `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function validateStoneParams(stone: StoneParams, source: DataSource): AnalysisError[] {
  const errors: AnalysisError[] = [];
  
  if (stone.friction < MIN_FRICTION) {
    errors.push({
      id: generateId(),
      type: 'friction_too_low',
      sourceId: source.id,
      stoneId: stone.id,
      severity: 'warning',
      message: `冰壶 ${stone.id.slice(0, 8)} 的摩擦系数 ${stone.friction.toFixed(4)} 过低`,
      nextStep: `建议将摩擦系数调整至 ${MIN_FRICTION} - ${MAX_FRICTION} 范围内`,
      evidence: {
        parameterName: 'friction',
        expectedValue: MIN_FRICTION,
        actualValue: stone.friction
      }
    });
  }
  
  const velocityMagnitude = Math.sqrt(
    stone.initialVelocity.x ** 2 + stone.initialVelocity.y ** 2
  );
  
  if (velocityMagnitude > MAX_VELOCITY || velocityMagnitude < MIN_VELOCITY) {
    errors.push({
      id: generateId(),
      type: 'velocity_out_of_range',
      sourceId: source.id,
      stoneId: stone.id,
      severity: velocityMagnitude > MAX_VELOCITY ? 'error' : 'warning',
      message: `冰壶 ${stone.id.slice(0, 8)} 的出手速度 ${velocityMagnitude.toFixed(2)} m/s 超出范围`,
      nextStep: `建议将出手速度调整至 ${MIN_VELOCITY} - ${MAX_VELOCITY} m/s 范围内`,
      evidence: {
        parameterName: 'initialVelocity',
        expectedValue: MAX_VELOCITY,
        actualValue: velocityMagnitude
      }
    });
  }
  
  if (stone.rotation.speed !== 0) {
    const expectedDirection = stone.initialVelocity.x > 0 ? 'counterclockwise' : 'clockwise';
    if (stone.rotation.direction !== expectedDirection && Math.abs(stone.initialVelocity.x) > 0.1) {
      errors.push({
        id: generateId(),
        type: 'rotation_reversed',
        sourceId: source.id,
        stoneId: stone.id,
        severity: 'warning',
        message: `冰壶 ${stone.id.slice(0, 8)} 的旋转方向可能与轨迹弯曲方向矛盾`,
        nextStep: `建议检查旋转方向设置：${stone.rotation.direction === 'clockwise' ? '顺时针' : '逆时针'}`,
        evidence: {
          parameterName: 'rotation.direction',
          expectedValue: expectedDirection === 'clockwise' ? 1 : -1,
          actualValue: stone.rotation.direction === 'clockwise' ? 1 : -1
        }
      });
    }
  }
  
  return errors;
}

export function validateDataSource(source: DataSource): AnalysisError[] {
  const errors: AnalysisError[] = [];
  
  source.stones.forEach(stone => {
    const stoneErrors = validateStoneParams(stone, source);
    errors.push(...stoneErrors);
  });
  
  return errors;
}

export function validateAllDataSources(sources: DataSource[]): AnalysisError[] {
  const errors: AnalysisError[] = [];
  
  sources.forEach(source => {
    const sourceErrors = validateDataSource(source);
    errors.push(...sourceErrors);
  });
  
  return errors;
}
