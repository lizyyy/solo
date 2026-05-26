import { GameRecord, ScoreBreakdown, Level } from '../types';

export const calculateScore = (
  successCount: number,
  totalRounds: number,
  totalCost: number,
  optimalCost: number,
  insufficientStirringCount: number,
  overdoseCount: number
): ScoreBreakdown => {
  const baseScore = successCount * 100;
  const costPenalty = Math.floor((totalCost / Math.max(optimalCost, 1)) * 50);
  const stirringPenalty = insufficientStirringCount * 20;
  const overdosePenalty = overdoseCount * 30;

  const finalScore = Math.max(baseScore - costPenalty - stirringPenalty - overdosePenalty, 0);
  const maxPossibleScore = totalRounds * 100;
  const stars = Math.floor((finalScore / maxPossibleScore) * 3);

  return {
    baseScore,
    costPenalty,
    stirringPenalty,
    overdosePenalty,
    finalScore,
    stars: Math.max(1, Math.min(3, stars))
  };
};

export const calculateOptimalCost = (level: Level): number => {
  let totalOptimalDose = 0;
  let currentQuality = { ...level.initialWaterQuality };

  for (let i = 0; i < level.maxRounds; i++) {
    const codReduction = Math.max(0, currentQuality.cod - level.targetThresholds.cod);
    const nh3nReduction = Math.max(0, currentQuality.nh3n - level.targetThresholds.nh3n);
    const tpReduction = Math.max(0, currentQuality.tp - level.targetThresholds.tp);

    const codDose = codReduction * level.parameters.optimalDosePerUnit.cod;
    const nh3nDose = nh3nReduction * level.parameters.optimalDosePerUnit.nh3n;
    const tpDose = tpReduction * level.parameters.optimalDosePerUnit.tp;

    const optimalDose = Math.ceil(Math.max(codDose, nh3nDose, tpDose));
    totalOptimalDose += optimalDose;

    currentQuality.cod = level.targetThresholds.cod;
    currentQuality.nh3n = level.targetThresholds.nh3n;
    currentQuality.tp = level.targetThresholds.tp;
  }

  const chemicalCost = totalOptimalDose * level.chemicalCost;
  const stirringCost = level.maxRounds * level.parameters.minStirringTime * level.stirringCostPerSecond;

  return chemicalCost + stirringCost;
};

export const getFailReasonDescription = (failReason: string | null): { title: string; suggestion: string } => {
  switch (failReason) {
    case 'overdose':
      return {
        title: '药剂严重超量',
        suggestion: '建议降低药剂投加量，参考最优投加量进行操作。超量投加不仅增加成本，还可能导致水质指标反弹。'
      };
    case 'rebound':
      return {
        title: '指标反弹超标',
        suggestion: '药剂超量会导致后续回合指标反弹，请精确控制投加量，避免过度投加。'
      };
    case 'insufficient_stirring':
      return {
        title: '搅拌时间不足',
        suggestion: '请确保搅拌时间达到最低要求，充分搅拌才能让药剂与污水充分反应。'
      };
    case 'threshold_exceeded':
      return {
        title: '出水指标超标',
        suggestion: '请检查药剂投加量是否足够，或增加搅拌时间提高处理效果。'
      };
    case 'timeout':
      return {
        title: '回合数耗尽',
        suggestion: '请提高每回合的处理效率，争取在更少回合内达标。'
      };
    default:
      return {
        title: '游戏结束',
        suggestion: '继续练习，熟悉水质变化规律和药剂反应特性。'
      };
  }
};

const STORAGE_KEY = 'wastewater_game_records';

export const saveGameRecord = (record: GameRecord): void => {
  try {
    const records = getGameRecords();
    records.push(record);
    records.sort((a, b) => b.score - a.score);
    const topRecords = records.slice(0, 50);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(topRecords));
  } catch (e) {
    console.error('Failed to save game record:', e);
  }
};

export const getGameRecords = (): GameRecord[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error('Failed to get game records:', e);
    return [];
  }
};

export const getGameRecordById = (id: string): GameRecord | null => {
  const records = getGameRecords();
  return records.find(r => r.id === id) || null;
};

export const getHighScore = (levelId: string): number => {
  const records = getGameRecords().filter(r => r.levelId === levelId);
  if (records.length === 0) return 0;
  return Math.max(...records.map(r => r.score));
};

export const generateRecordId = (): string => {
  return `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};
