import type { GameState, Level, ScoreResult } from './types';
import { FAILURE_CONDITIONS, SCORE_WEIGHTS } from './constants';

export function checkFailure(state: GameState, level: Level): { failed: boolean; reason?: string } {
  if (state.overtoppingHours >= FAILURE_CONDITIONS.OVERTOPPING_HOURS) {
    return { failed: true, reason: '水库漫坝超过3小时，大坝安全受到严重威胁！' };
  }
  if (state.downstreamDangerHours >= FAILURE_CONDITIONS.DOWNSTREAM_DANGER_HOURS) {
    return { failed: true, reason: '下游超警超过6小时，发生溃坝风险！' };
  }
  if (state.deadStorageHours >= FAILURE_CONDITIONS.DEAD_STORAGE_HOURS) {
    return { failed: true, reason: '水库低于死水位超过12小时，无法正常供水！' };
  }
  return { failed: false };
}

export function calculateScore(
  states: GameState[],
  level: Level,
  gateChanges: { time: number; opening: number }[]
): ScoreResult {
  const finalState = states[states.length - 1];
  
  let storageScore = 0;
  const storageRatio = finalState.reservoirStorage / level.normalStorage;
  if (storageRatio >= 0.8 && storageRatio <= 1.0) {
    storageScore = SCORE_WEIGHTS.STORAGE;
  } else if (storageRatio >= 0.6 && storageRatio <= 1.1) {
    storageScore = SCORE_WEIGHTS.STORAGE * 0.7;
  } else if (storageRatio >= 0.4 && storageRatio <= 1.2) {
    storageScore = SCORE_WEIGHTS.STORAGE * 0.4;
  }

  let downstreamScore = SCORE_WEIGHTS.DOWNSTREAM;
  let maxDischarge = 0;
  let warningCount = 0;
  let dangerCount = 0;
  for (const state of states) {
    maxDischarge = Math.max(maxDischarge, state.outflow);
    if (state.isDownstreamDanger) {
      downstreamScore = Math.max(0, downstreamScore - 5);
      dangerCount++;
    } else if (state.isDownstreamWarning) {
      downstreamScore = Math.max(0, downstreamScore - 2);
      warningCount++;
    }
  }

  let overflowEvents = 0;
  let efficiencySum = 0;
  for (const state of states) {
    if (state.isOvertopping) overflowEvents++;
    const efficiency = state.reservoirStorage / level.maxStorage;
    efficiencySum += Math.min(1, Math.max(0, efficiency));
  }
  const avgEfficiency = efficiencySum / states.length;
  const efficiencyScore = Math.round(avgEfficiency * SCORE_WEIGHTS.EFFICIENCY);

  const changeCount = gateChanges.length;
  const expectedChanges = level.duration / 8;
  let stabilityScore = SCORE_WEIGHTS.STABILITY;
  if (changeCount > expectedChanges * 2) {
    stabilityScore = Math.round(SCORE_WEIGHTS.STABILITY * 0.5);
  } else if (changeCount > expectedChanges * 1.5) {
    stabilityScore = Math.round(SCORE_WEIGHTS.STABILITY * 0.8);
  }

  const total = storageScore + downstreamScore + efficiencyScore + stabilityScore;

  return {
    total,
    storageScore,
    downstreamScore,
    efficiencyScore,
    stabilityScore,
    details: {
      finalStorage: finalState.reservoirStorage,
      maxDownstreamDischarge: maxDischarge,
      gateChanges: changeCount,
      overflowEvents,
      warningEvents: warningCount,
      dangerEvents: dangerCount,
      avgEfficiency,
    },
  };
}
