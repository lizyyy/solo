import { Level, SimulationState, Customer, SmokeCell, Position } from '../models/types';
import {
  positionsEqual,
  getNeighbors,
  isValidPosition,
  isBlocked,
  isExit,
  isSmokeSource,
  cloneLevel,
} from '../models/level';
import {
  findPathWithSigns,
  findNearestExit,
  getPathDirection,
  isOppositeDirection,
} from './pathfinding';

export const SMOKE_SPREAD_RATE = 0.15;
export const MAX_SMOKE_DENSITY = 1.0;
export const CUSTOMER_MOVE_INTERVAL = 1;

export function createInitialSimulationState(level: Level): SimulationState {
  const clonedLevel = cloneLevel(level);
  
  const smokeCells: SmokeCell[] = level.smokeSources.map(source => ({
    position: { ...source },
    density: MAX_SMOKE_DENSITY,
  }));

  const customers = clonedLevel.customers.map(c => ({
    ...c,
    position: { ...c.position },
    path: [],
    pathIndex: 0,
    isEvacuated: false,
    isTrapped: false,
    waitTime: 0,
    lastDirection: null,
    targetExit: findNearestExit(clonedLevel, c.position, smokeCells, []),
  }));

  return {
    timeStep: 0,
    isRunning: false,
    isPaused: false,
    customers,
    smokeCells,
    evacuatedCount: 0,
    trappedCount: 0,
    congestionEvents: [],
    reverseEvents: [],
    deadEndEvents: [],
    isComplete: false,
  };
}

export function stepSimulation(
  level: Level,
  state: SimulationState
): SimulationState {
  const newState: SimulationState = {
    ...state,
    timeStep: state.timeStep + 1,
    customers: state.customers.map(c => ({ ...c })),
    smokeCells: state.smokeCells.map(s => ({
      ...s,
      position: { ...s.position },
    })),
    congestionEvents: [...state.congestionEvents],
    reverseEvents: [...state.reverseEvents],
    deadEndEvents: [...state.deadEndEvents],
  };

  spreadSmoke(level, newState);

  moveCustomers(level, newState);

  checkCompletion(level, newState);

  return newState;
}

function spreadSmoke(level: Level, state: SimulationState): void {
  const newSmokeCells: SmokeCell[] = [];
  const existingPositions = new Set(state.smokeCells.map(s => `${s.position.x},${s.position.y}`));

  for (const smokeCell of state.smokeCells) {
    if (smokeCell.density < MAX_SMOKE_DENSITY) {
      smokeCell.density = Math.min(smokeCell.density + SMOKE_SPREAD_RATE, MAX_SMOKE_DENSITY);
    }

    const neighbors = getNeighbors(smokeCell.position);
    for (const neighbor of neighbors) {
      if (!isValidPosition(level, neighbor)) continue;
      if (isBlocked(level, neighbor)) continue;
      if (isSmokeSource(level, neighbor)) continue;

      const key = `${neighbor.x},${neighbor.y}`;
      if (existingPositions.has(key)) continue;
      if (newSmokeCells.some(s => positionsEqual(s.position, neighbor))) continue;

      newSmokeCells.push({
        position: neighbor,
        density: SMOKE_SPREAD_RATE,
      });
    }
  }

  state.smokeCells = [...state.smokeCells, ...newSmokeCells];
}

function moveCustomers(level: Level, state: SimulationState): void {
  const activeCustomers = state.customers.filter(c => !c.isEvacuated && !c.isTrapped);
  const positionToCustomers = new Map<string, string[]>();

  for (const customer of activeCustomers) {
    const key = `${customer.position.x},${customer.position.y}`;
    if (!positionToCustomers.has(key)) {
      positionToCustomers.set(key, []);
    }
    positionToCustomers.get(key)!.push(customer.id);
  }

  for (const [posKey, customerIds] of positionToCustomers) {
    if (customerIds.length > 1) {
      const [x, y] = posKey.split(',').map(Number);
      state.congestionEvents.push({
        timeStep: state.timeStep,
        position: { x: x!, y: y! },
        customerIds: [...customerIds],
        severity: customerIds.length,
      });
    }
  }

  const sortedCustomers = [...activeCustomers].sort((a, b) => {
    const distA = a.targetExit ? Math.abs(a.position.x - a.targetExit.x) + Math.abs(a.position.y - a.targetExit.y) : Infinity;
    const distB = b.targetExit ? Math.abs(b.position.x - b.targetExit.x) + Math.abs(b.position.y - b.targetExit.y) : Infinity;
    return distA - distB;
  });

  const occupiedPositions = new Set(
    activeCustomers.map(c => `${c.position.x},${c.position.y}`)
  );

  for (const customer of sortedCustomers) {
    if (customer.isEvacuated || customer.isTrapped) continue;

    const currentPosKey = `${customer.position.x},${customer.position.y}`;

    const hasHighSmoke = state.smokeCells.some(s =>
      positionsEqual(s.position, customer.position) && s.density > 0.5
    );

    if (hasHighSmoke) {
      customer.isTrapped = true;
      state.trappedCount++;
      occupiedPositions.delete(currentPosKey);
      continue;
    }

    let path: Position[] | null = customer.path.length > 0 ? customer.path : null;
    
    if (!path || path.length === 0 || customer.pathIndex >= path.length) {
      const blockedPositions = Array.from(occupiedPositions)
        .filter(key => key !== currentPosKey)
        .map(key => {
          const [x, y] = key.split(',').map(Number);
          return { x: x!, y: y! };
        });

      path = findPathWithSigns(level, customer, state.smokeCells, blockedPositions);
      
      if (path) {
        customer.path = path;
        customer.pathIndex = 0;
      }
    }

    if (!path || path.length === 0) {
      customer.isTrapped = true;
      state.trappedCount++;
      state.deadEndEvents.push({
        timeStep: state.timeStep,
        customerId: customer.id,
        position: { ...customer.position },
      });
      occupiedPositions.delete(currentPosKey);
      continue;
    }

    const nextIndex = customer.pathIndex + 1;
    if (nextIndex >= path.length) {
      customer.isEvacuated = true;
      state.evacuatedCount++;
      occupiedPositions.delete(currentPosKey);
      continue;
    }

    const nextPosition = path[nextIndex]!;
    const nextPosKey = `${nextPosition.x},${nextPosition.y}`;

    if (isExit(level, nextPosition)) {
      customer.position = nextPosition;
      customer.isEvacuated = true;
      state.evacuatedCount++;
      customer.pathIndex++;
      occupiedPositions.delete(currentPosKey);
      continue;
    }

    if (occupiedPositions.has(nextPosKey)) {
      customer.waitTime++;
      continue;
    }

    const newDirection = getPathDirection(customer.position, nextPosition);
    
    if (newDirection && isOppositeDirection(customer.lastDirection, newDirection)) {
      state.reverseEvents.push({
        timeStep: state.timeStep,
        customerId: customer.id,
        position: { ...customer.position },
        direction: newDirection,
        reason: '顾客改变移动方向',
      });
    }

    customer.lastDirection = newDirection;
    customer.position = nextPosition;
    customer.pathIndex = nextIndex;
    occupiedPositions.delete(currentPosKey);
    occupiedPositions.add(nextPosKey);
  }
}

function checkCompletion(level: Level, state: SimulationState): void {
  const activeCustomers = state.customers.filter(c => !c.isEvacuated && !c.isTrapped);
  
  if (activeCustomers.length === 0) {
    state.isComplete = true;
    state.isRunning = false;
  }

  if (state.timeStep >= level.maxTimeSteps) {
    state.isComplete = true;
    state.isRunning = false;
    
    for (const customer of state.customers) {
      if (!customer.isEvacuated && !customer.isTrapped) {
        customer.isTrapped = true;
        state.trappedCount++;
      }
    }
  }
}

export function getSmokeAtPosition(
  smokeCells: SmokeCell[],
  position: Position
): SmokeCell | undefined {
  return smokeCells.find(s => positionsEqual(s.position, position));
}

export function getActiveCustomers(state: SimulationState): Customer[] {
  return state.customers.filter(c => !c.isEvacuated && !c.isTrapped);
}
