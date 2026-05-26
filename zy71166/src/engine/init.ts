import type { GameState, Rack, ACUnit, LevelConfig, TurnState } from './types';
import { ROOM_DIMENSIONS, getElectricityPrice } from './config';

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

function generateRackPositions(count: number): Array<{ x: number; z: number }> {
  const positions: Array<{ x: number; z: number }> = [];
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  const spacingX = (ROOM_DIMENSIONS.width - 4) / (cols + 1);
  const spacingZ = (ROOM_DIMENSIONS.depth - 4) / (rows + 1);

  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    positions.push({
      x: -ROOM_DIMENSIONS.width / 2 + 2 + spacingX * (col + 1),
      z: -ROOM_DIMENSIONS.depth / 2 + 2 + spacingZ * (row + 1),
    });
  }
  return positions;
}

function generateACPositions(count: number): Array<{ x: number; z: number }> {
  const positions: Array<{ x: number; z: number }> = [];
  const wallZ = ROOM_DIMENSIONS.depth / 2 - 1;
  const spacingX = (ROOM_DIMENSIONS.width - 4) / (count + 1);

  for (let i = 0; i < count; i++) {
    positions.push({
      x: -ROOM_DIMENSIONS.width / 2 + 2 + spacingX * (i + 1),
      z: wallZ,
    });
  }
  return positions;
}

export function createRacks(level: LevelConfig): Rack[] {
  const positions = generateRackPositions(level.rackCount);
  return positions.map((pos, i) => {
    const baseLoad = 3 + Math.random() * 4;
    const maxLoad = 8 + Math.random() * 4;
    return {
      id: `rack-${i + 1}`,
      name: `R-${String(i + 1).padStart(2, '0')}`,
      position: pos,
      load: Math.round(baseLoad * 10) / 10,
      maxLoad: Math.round(maxLoad * 10) / 10,
      temperature: level.initialTemp,
      status: 'normal',
      airflow: 80 + Math.random() * 40,
    };
  });
}

export function createACUnits(level: LevelConfig): ACUnit[] {
  const positions = generateACPositions(level.acCount);
  return positions.map((pos, i) => ({
    id: `ac-${i + 1}`,
    name: `AC-${i + 1}`,
    position: pos,
    isOn: i < Math.ceil(level.acCount / 2),
    setPoint: 24,
    capacity: 15 + Math.random() * 5,
    efficiency: 1.0,
    powerDraw: 0,
    status: i < Math.ceil(level.acCount / 2) ? 'running' : 'off',
  }));
}

export function createInitialTurnState(level: LevelConfig): TurnState {
  const { price, period } = getElectricityPrice(0, level);
  return {
    turn: 1,
    hour: 0,
    outdoorTemp: level.outdoorTempCurve[0],
    electricityPrice: price,
    pricePeriod: period,
    electricityUsed: 0,
    totalCost: 0,
    score: 0,
    budget: level.budget,
  };
}

export function createInitialGameState(level: LevelConfig): GameState {
  const racks = createRacks(level);
  const acUnits = createACUnits(level);
  const turnState = createInitialTurnState(level);

  const initialSnapshot = {
    turn: 1,
    racks: JSON.parse(JSON.stringify(racks)),
    acUnits: JSON.parse(JSON.stringify(acUnits)),
    turnState: JSON.parse(JSON.stringify(turnState)),
  };

  return {
    gameId: `game-${generateId()}`,
    levelId: level.id,
    levelName: level.name,
    racks,
    acUnits,
    turnState,
    gamePhase: 'playing',
    failReason: null,
    operationLog: [],
    eventLog: [],
    snapshotHistory: [initialSnapshot],
    totalTurns: level.totalTurns,
    createdAt: Date.now(),
  };
}

export function cloneGameState(state: GameState): GameState {
  return JSON.parse(JSON.stringify(state));
}

export function createTurnSnapshot(
  turn: number,
  racks: Rack[],
  acUnits: ACUnit[],
  turnState: TurnState,
) {
  return {
    turn,
    racks: JSON.parse(JSON.stringify(racks)),
    acUnits: JSON.parse(JSON.stringify(acUnits)),
    turnState: JSON.parse(JSON.stringify(turnState)),
  };
}
