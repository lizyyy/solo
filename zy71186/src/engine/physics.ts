import type { GameState, Level } from './types';
import { getInflowAtTime } from './levels';

export function calculateOutflow(gateOpening: number, maxDischarge: number): number {
  return (gateOpening / 100) * maxDischarge;
}

export function calculateDownstreamLevel(outflow: number, level: Level): number {
  const ratio = outflow / level.maxDischarge;
  return Math.min(100, ratio * 100);
}

export function calculateStorageChange(
  inflow: number,
  outflow: number,
  deltaHours: number
): number {
  return (inflow - outflow) * deltaHours * 3600 / 10000;
}

export function createInitialState(level: Level): GameState {
  const initialInflow = getInflowAtTime(level.inflowCurve, 0);
  const initialOutflow = calculateOutflow(0, level.maxDischarge);
  
  return {
    time: 0,
    reservoirStorage: level.initialStorage,
    gateOpening: 0,
    inflow: initialInflow,
    outflow: initialOutflow,
    downstreamLevel: calculateDownstreamLevel(initialOutflow, level),
    isOvertopping: false,
    isDownstreamWarning: false,
    isDownstreamDanger: false,
    isDeadStorage: false,
    overtoppingHours: 0,
    downstreamWarningHours: 0,
    downstreamDangerHours: 0,
    deadStorageHours: 0,
  };
}

export function simulateStep(
  state: GameState,
  level: Level,
  deltaHours: number
): GameState {
  const inflow = getInflowAtTime(level.inflowCurve, state.time);
  const outflow = calculateOutflow(state.gateOpening, level.maxDischarge);
  const storageChange = calculateStorageChange(inflow, outflow, deltaHours);
  const newStorage = Math.max(0, Math.min(level.maxStorage * 1.1, state.reservoirStorage + storageChange));
  
  const downstreamLevel = calculateDownstreamLevel(outflow, level);
  const isOvertopping = newStorage > level.maxStorage;
  const isDownstreamWarning = outflow > level.warningDischarge;
  const isDownstreamDanger = outflow > level.safeDischarge;
  const isDeadStorage = newStorage < level.deadStorage;

  return {
    ...state,
    time: state.time + deltaHours,
    reservoirStorage: newStorage,
    inflow,
    outflow,
    downstreamLevel,
    isOvertopping,
    isDownstreamWarning,
    isDownstreamDanger,
    isDeadStorage,
    overtoppingHours: isOvertopping ? state.overtoppingHours + deltaHours : 0,
    downstreamWarningHours: isDownstreamWarning ? state.downstreamWarningHours + deltaHours : 0,
    downstreamDangerHours: isDownstreamDanger ? state.downstreamDangerHours + deltaHours : 0,
    deadStorageHours: isDeadStorage ? state.deadStorageHours + deltaHours : 0,
  };
}

export function checkGameEnd(state: GameState, level: Level): { ended: boolean; reason?: string } {
  if (state.time >= level.duration) {
    return { ended: true };
  }
  return { ended: false };
}
