import { SimulationError, Fan, EscapeRoute, TimeStep } from '../types';

interface DetectionState {
  fans: Fan[];
  escapeRoutes: EscapeRoute[];
  currentStep: number;
  previousFans?: Fan[];
  previousBlockedRoutes?: string[];
  timeSteps: TimeStep[];
}

export const detectErrors = (state: DetectionState): Omit<SimulationError, 'id'>[] => {
  const errors: Omit<SimulationError, 'id'>[] = [];
  const timestamp = Date.now();

  const directionErrors = detectFanDirectionErrors(state, timestamp);
  errors.push(...directionErrors);

  const escapeErrors = detectEscapeRouteBlockages(state, timestamp);
  errors.push(...escapeErrors);

  const timestepErrors = detectTimestepErrors(state, timestamp);
  errors.push(...timestepErrors);

  return errors;
};

const detectFanDirectionErrors = (
  state: DetectionState,
  timestamp: number
): Omit<SimulationError, 'id'>[] => {
  const errors: Omit<SimulationError, 'id'>[] = [];
  
  if (!state.previousFans) return errors;

  state.fans.forEach((fan, index) => {
    const prevFan = state.previousFans[index];
    if (!prevFan) return;

    if (fan.direction !== prevFan.direction && fan.isOn && prevFan.isOn) {
      const directionCN = fan.direction === 'forward' ? '正向' : '反向';
      errors.push({
        type: 'fan_wrong_direction',
        severity: 'warning',
        timestamp,
        description: `${fan.name} 方向已切换为 ${directionCN}，请确认是否符合排烟策略`,
        step: state.currentStep
      });
    }
  });

  const activeFans = state.fans.filter(f => f.isOn);
  const forwardFans = activeFans.filter(f => f.direction === 'forward');
  const backwardFans = activeFans.filter(f => f.direction === 'backward');

  if (forwardFans.length > 0 && backwardFans.length > 0) {
    const mixedDirections = activeFans
      .filter(f => f.zone === 'middle')
      .some(f => f.direction === 'backward');
    
    if (mixedDirections) {
      errors.push({
        type: 'fan_wrong_direction',
        severity: 'critical',
        timestamp,
        description: '警告：中段风机方向与其他区域冲突，可能导致烟气紊流',
        step: state.currentStep
      });
    }
  }

  return errors;
};

const detectEscapeRouteBlockages = (
  state: DetectionState,
  timestamp: number
): Omit<SimulationError, 'id'>[] => {
  const errors: Omit<SimulationError, 'id'>[] = [];

  state.escapeRoutes.forEach((route) => {
    if (route.isBlocked) {
      const wasBlocked = state.previousBlockedRoutes?.includes(route.id);
      if (!wasBlocked) {
        errors.push({
          type: 'escape_blocked',
          severity: 'critical',
          timestamp,
          description: `紧急！${route.name} 已被烟气覆盖，请立即调整风机策略`,
          step: state.currentStep
        });
      }
    }
  });

  return errors;
};

const detectTimestepErrors = (
  state: DetectionState,
  timestamp: number
): Omit<SimulationError, 'id'>[] => {
  const errors: Omit<SimulationError, 'id'>[] = [];

  if (state.timeSteps.length > 0) {
    const lastStep = state.timeSteps[state.timeSteps.length - 1];
    if (Math.abs(lastStep.step - state.currentStep) > 10) {
      errors.push({
        type: 'timestep_error',
        severity: 'warning',
        timestamp,
        description: `时间步跳变过大：从步骤 ${lastStep.step} 到 ${state.currentStep}`,
        step: state.currentStep
      });
    }
  }

  const blockedCount = state.escapeRoutes.filter(r => r.isBlocked).length;
  if (blockedCount === state.escapeRoutes.length && state.escapeRoutes.length > 0) {
    errors.push({
      type: 'timestep_error',
      severity: 'critical',
      timestamp,
      description: '所有逃生通道已被烟气覆盖！演练失败，请重新开始',
      step: state.currentStep
    });
  }

  return errors;
};

export const calculateScore = (
  errors: SimulationError[],
  totalSteps: number,
  blockedTime: number
): number => {
  let score = 100;

  const criticalErrors = errors.filter(e => e.severity === 'critical').length;
  const warningErrors = errors.filter(e => e.severity === 'warning').length;

  score -= criticalErrors * 15;
  score -= warningErrors * 5;

  const blockedPenalty = (blockedTime / Math.max(1, totalSteps)) * 30;
  score -= blockedPenalty;

  return Math.max(0, Math.round(score));
};
