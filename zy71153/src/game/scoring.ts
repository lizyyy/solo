import { GameState, ScoreDetail, MapNode, Vehicle } from '../types';

interface ScoreCategory {
  category: string;
  score: number;
  maxScore: number;
  description: string;
}

export const calculateScore = (state: GameState): { score: number; details: ScoreDetail[] } => {
  const details: ScoreCategory[] = [];
  let totalScore = 0;

  details.push({
    category: '基础分',
    score: 500,
    maxScore: 500,
    description: '完成游戏的基础分数',
  });
  totalScore += 500;

  const completedShelters = state.nodes.filter(
    (n) =>
      n.type === 'shelter' &&
      n.demand &&
      n.received &&
      n.received.water >= n.demand.water &&
      n.received.medicine >= n.demand.medicine &&
      n.received.tent >= n.demand.tent
  );
  const totalShelters = state.nodes.filter((n) => n.type === 'shelter').length;
  const shelterScore = completedShelters.length * 100;
  const maxShelterScore = totalShelters * 100;
  details.push({
    category: '安置点完成',
    score: shelterScore,
    maxScore: maxShelterScore,
    description: `完成 ${completedShelters.length}/${totalShelters} 个安置点配送，每个+100分`,
  });
  totalScore += shelterScore;

  const remainingTurns = state.maxTurns - state.turn;
  const turnBonus = Math.max(0, remainingTurns) * 10;
  details.push({
    category: '效率奖励',
    score: turnBonus,
    maxScore: state.maxTurns * 10,
    description: `剩余 ${remainingTurns} 回合，每回合+10分`,
  });
  totalScore += turnBonus;

  const accurateShelters = state.nodes.filter((n) => {
    if (n.type !== 'shelter' || !n.demand || !n.received) return false;
    return (
      n.received.water === n.demand.water &&
      n.received.medicine === n.demand.medicine &&
      n.received.tent === n.demand.tent
    );
  });
  const accurateScore = accurateShelters.length * 30;
  details.push({
    category: '精准配送',
    score: accurateScore,
    maxScore: totalShelters * 30,
    description: `${accurateShelters.length} 个安置点物资精准匹配，每个+30分`,
  });
  totalScore += accurateScore;

  const noWasteVehicles = state.vehicles.filter(
    (v) => v.currentLoad.water === 0 && v.currentLoad.medicine === 0 && v.currentLoad.tent === 0
  );
  const noWasteScore = noWasteVehicles.length * 20;
  details.push({
    category: '无浪费奖励',
    score: noWasteScore,
    maxScore: state.vehicles.length * 20,
    description: `${noWasteVehicles.length} 辆车无剩余物资，每辆+20分`,
  });
  totalScore += noWasteScore;

  const errorPenalty = state.actionHistory.filter((a) => a.type === 'load' && a.payload.isOverload).length * 50;
  if (errorPenalty > 0) {
    details.push({
      category: '错误操作',
      score: -errorPenalty,
      maxScore: 0,
      description: `超重发车 ${Math.floor(errorPenalty / 50)} 次，每次-50分`,
    });
    totalScore -= errorPenalty;
  }

  const timeoutPenalty = state.turn > state.maxTurns ? (state.turn - state.maxTurns) * 20 : 0;
  if (timeoutPenalty > 0) {
    details.push({
      category: '超时惩罚',
      score: -timeoutPenalty,
      maxScore: 0,
      description: `超时 ${timeoutPenalty / 20} 回合，每回合-20分`,
    });
    totalScore -= timeoutPenalty;
  }

  const wastePenalty = state.vehicles.reduce((sum, v) => {
    return sum + (v.currentLoad.water + v.currentLoad.medicine + v.currentLoad.tent) * 5;
  }, 0);
  if (wastePenalty > 0) {
    details.push({
      category: '物资浪费',
      score: -wastePenalty,
      maxScore: 0,
      description: `剩余物资 ${wastePenalty / 5} 单位，每单位-5分`,
    });
    totalScore -= wastePenalty;
  }

  const incompleteShelters = totalShelters - completedShelters.length;
  const incompletePenalty = incompleteShelters * 80;
  if (incompletePenalty > 0) {
    details.push({
      category: '未完成惩罚',
      score: -incompletePenalty,
      maxScore: 0,
      description: `${incompleteShelters} 个安置点未完成配送，每个-80分`,
    });
    totalScore -= incompletePenalty;
  }

  return {
    score: Math.max(0, totalScore),
    details,
  };
};

export const getScoreRating = (score: number, maxScore: number): { grade: string; color: string } => {
  const percentage = score / maxScore;
  if (percentage >= 0.9) return { grade: 'S', color: 'text-yellow-400' };
  if (percentage >= 0.8) return { grade: 'A', color: 'text-green-400' };
  if (percentage >= 0.65) return { grade: 'B', color: 'text-blue-400' };
  if (percentage >= 0.5) return { grade: 'C', color: 'text-orange-400' };
  return { grade: 'D', color: 'text-red-400' };
};

export const getMaxPossibleScore = (state: GameState): number => {
  const shelterCount = state.nodes.filter((n) => n.type === 'shelter').length;
  return 500 + shelterCount * 130 + state.maxTurns * 10 + state.vehicles.length * 20;
};

export const checkWinCondition = (nodes: MapNode[]): boolean => {
  return nodes.every((n) => {
    if (n.type !== 'shelter') return true;
    if (!n.demand || !n.received) return false;
    return (
      n.received.water >= n.demand.water &&
      n.received.medicine >= n.demand.medicine &&
      n.received.tent >= n.demand.tent
    );
  });
};

export const checkLoseCondition = (state: GameState): { lose: boolean; reason?: string } => {
  if (state.turn >= state.maxTurns) {
    const incomplete = state.nodes.filter((n) => {
      if (n.type !== 'shelter' || !n.demand || !n.received) return false;
      return (
        n.received.water < n.demand.water ||
        n.received.medicine < n.demand.medicine ||
        n.received.tent < n.demand.tent
      );
    }).length;
    if (incomplete > 0) {
      return { lose: true, reason: `回合用尽，仍有 ${incomplete} 个安置点需求未满足` };
    }
  }

  const allVehiclesIdle = state.vehicles.every((v) => v.status === 'idle');
  const warehouseEmpty =
    state.warehouseSupplies.water === 0 &&
    state.warehouseSupplies.medicine === 0 &&
    state.warehouseSupplies.tent === 0;
  const allVehiclesEmpty = state.vehicles.every(
    (v) => v.currentLoad.water === 0 && v.currentLoad.medicine === 0 && v.currentLoad.tent === 0
  );

  const hasUnmetDemand = state.nodes.some((n) => {
    if (n.type !== 'shelter' || !n.demand || !n.received) return false;
    return (
      n.received.water < n.demand.water ||
      n.received.medicine < n.demand.medicine ||
      n.received.tent < n.demand.tent
    );
  });

  if (allVehiclesIdle && warehouseEmpty && allVehiclesEmpty && hasUnmetDemand) {
    return { lose: true, reason: '物资已耗尽，无法满足剩余安置点需求' };
  }

  return { lose: false };
};
