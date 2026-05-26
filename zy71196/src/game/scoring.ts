import type { ScoreBreakdown, RoofMap, LeakPoint } from './types';
import { GAME_CONSTANTS } from './config';

export const calculateInspectionScore = (roofMap: RoofMap): number => {
  const inspectedDrains = roofMap.drains.filter((d) => d.inspected).length;
  const inspectedLowAreas = roofMap.lowAreas.filter((l) => l.inspected).length;
  return (
    inspectedDrains * GAME_CONSTANTS.INSPECTION_SCORE_PER_DRAIN +
    inspectedLowAreas * GAME_CONSTANTS.INSPECTION_SCORE_PER_DRAIN
  );
};

export const calculateResolutionScore = (roofMap: RoofMap): number => {
  let score = 0;
  
  roofMap.drains.forEach((drain) => {
    if (drain.resolved && drain.isBlocked === false) {
      score += GAME_CONSTANTS.RESOLUTION_SCORE_PER_BLOCKAGE;
    }
  });
  
  roofMap.lowAreas.forEach((lowArea) => {
    if (lowArea.pumped && lowArea.waterLevel < 30) {
      score += GAME_CONSTANTS.RESOLUTION_SCORE_PER_FLOOD;
    }
  });
  
  return score;
};

export const calculateEfficiencyScore = (
  remainingActionPoints: number,
  maxActionPoints: number
): number => {
  const usedPoints = maxActionPoints - remainingActionPoints;
  const efficiency = remainingActionPoints > 0 
    ? remainingActionPoints * GAME_CONSTANTS.EFFICIENCY_SCORE_PER_AP
    : 0;
  return efficiency;
};

export const calculateTimeBonus = (
  completedRounds: number,
  totalRounds: number,
  failed: boolean
): number => {
  if (failed) return 0;
  const remainingRounds = totalRounds - completedRounds;
  return remainingRounds * 10;
};

export const calculateLeakPenalty = (leakPoints: LeakPoint[]): number => {
  return leakPoints.length * GAME_CONSTANTS.LEAK_PENALTY;
};

export const calculateFinalScore = (
  roofMap: RoofMap,
  remainingActionPoints: number,
  maxActionPoints: number,
  leakPoints: LeakPoint[],
  completedRounds: number,
  totalRounds: number,
  failed: boolean
): ScoreBreakdown => {
  const inspectionScore = calculateInspectionScore(roofMap);
  const resolutionScore = calculateResolutionScore(roofMap);
  const efficiencyScore = calculateEfficiencyScore(remainingActionPoints, maxActionPoints);
  const timeBonus = calculateTimeBonus(completedRounds, totalRounds, failed);
  const leakPenalty = calculateLeakPenalty(leakPoints);
  
  const total = Math.max(
    0,
    inspectionScore + resolutionScore + efficiencyScore + timeBonus - leakPenalty
  );
  
  return {
    inspectionScore,
    resolutionScore,
    efficiencyScore,
    timeBonus,
    leakPenalty,
    total,
  };
};

export const getScoreColor = (score: number): string => {
  if (score >= 800) return 'text-green-500';
  if (score >= 600) return 'text-yellow-500';
  if (score >= 400) return 'text-orange-500';
  return 'text-red-500';
};

export const getScoreGrade = (score: number): { grade: string; color: string } => {
  if (score >= 900) return { grade: 'S', color: 'text-purple-500' };
  if (score >= 800) return { grade: 'A', color: 'text-green-500' };
  if (score >= 700) return { grade: 'B', color: 'text-blue-500' };
  if (score >= 600) return { grade: 'C', color: 'text-yellow-500' };
  if (score >= 400) return { grade: 'D', color: 'text-orange-500' };
  return { grade: 'F', color: 'text-red-500' };
};
