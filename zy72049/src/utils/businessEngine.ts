import { ResourceState, RiskLevel, Obstacle } from '../types';

export const calculateRiskLevel = (
  resources: { energy: number; compute: number; time: number },
  obstacleRisk?: number
): RiskLevel => {
  const avgResource = (resources.energy + resources.compute + resources.time) / 3;
  let baseRisk = 0;

  if (avgResource < 30) baseRisk += 2;
  else if (avgResource < 60) baseRisk += 1;

  if (obstacleRisk) {
    baseRisk += obstacleRisk;
  }

  return Math.min(3, Math.max(0, baseRisk)) as RiskLevel;
};

export const checkNegativeResources = (resources: {
  energy: number;
  compute: number;
  time: number;
}): { isNegative: boolean; warning?: string } => {
  if (resources.energy < 0) {
    return {
      isNegative: true,
      warning:
        '[业务提醒] 能源不足，请检查操作策略或补充能源。当前操作已计入日志但暂停自动计分。',
    };
  }
  if (resources.compute < 0) {
    return {
      isNegative: true,
      warning:
        '[业务提醒] 算力不足，请检查操作策略或补充算力。当前操作已计入日志但暂停自动计分。',
    };
  }
  if (resources.time < 0) {
    return {
      isNegative: true,
      warning:
        '[业务提醒] 时间不足，请检查操作策略或补充时间。当前操作已计入日志但暂停自动计分。',
    };
  }
  return { isNegative: false };
};

export const handleDragAction = (
  currentResources: ResourceState,
  obstacle: Obstacle
): {
  newResources: ResourceState;
  description: string;
  scoreDelta: number;
} => {
  const energyDelta = -obstacle.energyCost;
  const computeDelta = -Math.round(obstacle.computeCost * 0.5);
  const timeDelta = -obstacle.timeCost;

  const newEnergy = currentResources.energy + energyDelta;
  const newCompute = currentResources.compute + computeDelta;
  const newTime = currentResources.time + timeDelta;

  const negativeCheck = checkNegativeResources({
    energy: newEnergy,
    compute: newCompute,
    time: newTime,
  });

  const scoreDelta = negativeCheck.isNegative ? 0 : obstacle.scoreBonus;
  const newScore = currentResources.score + scoreDelta;

  const riskLevel = calculateRiskLevel(
    { energy: newEnergy, compute: newCompute, time: newTime },
    obstacle.riskWeight
  );

  return {
    newResources: {
      energy: newEnergy,
      compute: newCompute,
      time: newTime,
      score: newScore,
      riskLevel,
      ...negativeCheck,
    },
    description: `拖拽避开障碍物 ${obstacle.id}，消耗能源${Math.abs(energyDelta)}、算力${Math.abs(computeDelta)}、时间${Math.abs(timeDelta)}${scoreDelta > 0 ? `，获得${scoreDelta}分` : ''}`,
    scoreDelta,
  };
};

export const handleClickAction = (
  currentResources: ResourceState,
  obstacle: Obstacle
): {
  newResources: ResourceState;
  description: string;
  scoreDelta: number;
} => {
  const energyDelta = -Math.round(obstacle.energyCost * 0.3);
  const computeDelta = -obstacle.computeCost;
  const timeDelta = -Math.round(obstacle.timeCost * 0.4);

  const newEnergy = currentResources.energy + energyDelta;
  const newCompute = currentResources.compute + computeDelta;
  const newTime = currentResources.time + timeDelta;

  const negativeCheck = checkNegativeResources({
    energy: newEnergy,
    compute: newCompute,
    time: newTime,
  });

  const scoreDelta = negativeCheck.isNegative
    ? 0
    : Math.round(obstacle.scoreBonus * 0.8);
  const newScore = currentResources.score + scoreDelta;

  const riskLevel = calculateRiskLevel(
    { energy: newEnergy, compute: newCompute, time: newTime },
    obstacle.riskWeight
  );

  return {
    newResources: {
      energy: newEnergy,
      compute: newCompute,
      time: newTime,
      score: newScore,
      riskLevel,
      ...negativeCheck,
    },
    description: `点击绕过障碍物 ${obstacle.id}，消耗能源${Math.abs(energyDelta)}、算力${Math.abs(computeDelta)}、时间${Math.abs(timeDelta)}${scoreDelta > 0 ? `，获得${scoreDelta}分` : ''}`,
    scoreDelta,
  };
};

export const getRiskLabel = (level: RiskLevel): string => {
  const labels = ['低风险', '中风险', '高风险', '极高风险'];
  return labels[level];
};

export const getRiskColor = (level: RiskLevel): string => {
  const colors = ['bg-green-500', 'bg-yellow-500', 'bg-orange-500', 'bg-red-500'];
  return colors[level];
};

export const getResourceColor = (value: number, max: number = 100): string => {
  const percent = (value / max) * 100;
  if (percent < 0) return 'bg-red-600';
  if (percent < 30) return 'bg-red-500';
  if (percent < 60) return 'bg-yellow-500';
  return 'bg-green-500';
};

export const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};
