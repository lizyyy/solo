
import { create } from 'zustand';
import { GameState, MineCell, OperationRecord, GameMessage, InventoryItem } from '../types';
import { MINERALS, getMineralById } from '../data/minerals';
import { GAME_CONFIG } from '../data/config';
import { getEquipmentById } from '../data/equipment';
import { addToInventory, calculateInventorySpace } from '../logic/inventory';
import { calculateMiningScore, calculateWrongGuessPenalty } from '../logic/scoring';
import { addSpectrumNoise } from '../logic/spectrum';

function generateInitialGrid(): MineCell[][] {
  const grid: MineCell[][] = [];
  for (let y = 0; y < GAME_CONFIG.GRID_SIZE; y++) {
    const row: MineCell[] = [];
    for (let x = 0; x < GAME_CONFIG.GRID_SIZE; x++) {
      const hasMineral = Math.random() > 0.2;
      const randomMineral = hasMineral
        ? MINERALS[Math.floor(Math.random() * MINERALS.length)]
        : null;

      row.push({
        id: `cell-${x}-${y}`,
        x,
        y,
        status: 'unknown',
        mineral: randomMineral
          ? {
              ...randomMineral,
              spectrum: addSpectrumNoise(randomMineral.spectrum, 0.03)
            }
          : null,
        mineralType: randomMineral?.id || null,
        playerGuess: null,
        isCorrect: null,
        minedQuantity: 0
      });
    }
    grid.push(row);
  }
  return grid;
}

function createInitialState(): GameState {
  return {
    phase: 'playing',
    power: GAME_CONFIG.INITIAL_POWER,
    maxPower: GAME_CONFIG.INITIAL_POWER,
    score: 0,
    mineGrid: generateInitialGrid(),
    inventory: [],
    inventoryCapacity: GAME_CONFIG.INVENTORY_CAPACITY,
    currentInventory: 0,
    selectedEquipment: null,
    selectedCell: null,
    operationHistory: [],
    gameStartTime: Date.now(),
    gameEndTime: null,
    gameVersion: GAME_CONFIG.GAME_VERSION,
    rulesVersion: GAME_CONFIG.RULES_VERSION,
    messages: [],
    powerHistory: [{ time: 0, power: GAME_CONFIG.INITIAL_POWER }]
  };
}

interface GameActions {
  selectEquipment: (equipmentId: string | null) => void;
  selectCell: (cellId: string | null) => void;
  scanCell: (cellId: string, equipmentId: string) => void;
  makeGuess: (cellId: string, mineralId: string) => void;
  mineCell: (cellId: string, equipmentId: string) => void;
  addMessage: (type: GameMessage['type'], text: string) => void;
  clearMessages: () => void;
  endGame: () => void;
  resetGame: () => void;
  setStateForReplay: (state: Partial<GameState>) => void;
}

export const useGameStore = create<GameState & GameActions>((set, get) => ({
  ...createInitialState(),

  selectEquipment: (equipmentId) => {
    set({ selectedEquipment: equipmentId });
  },

  selectCell: (cellId) => {
    set({ selectedCell: cellId });
  },

  scanCell: (cellId: string, equipmentId: string) => {
    const state = get();
    const equipment = getEquipmentById(equipmentId);
    if (!equipment || equipment.type !== 'scanner') return;
    if (state.power < equipment.powerCost) {
      get().addMessage('error', '电量不足，无法执行扫描！');
      return;
    }

    const cell = state.mineGrid.flat().find((c) => c.id === cellId);
    if (!cell || cell.status !== 'unknown') return;

    const newPower = state.power - equipment.powerCost;
    const elapsedTime = Math.floor((Date.now() - state.gameStartTime) / 1000);

    const newGrid = state.mineGrid.map((row) =>
      row.map((c) => {
        if (c.id === cellId) {
          return { ...c, status: 'scanned' as const };
        }
        return c;
      })
    );

    const record: OperationRecord = {
      timestamp: Date.now(),
      type: 'scan',
      cellId,
      cellPosition: { x: cell.x, y: cell.y },
      equipment: equipmentId,
      powerCost: equipment.powerCost,
      result: {
        mineralType: cell.mineralType || 'empty'
      }
    };

    get().addMessage('success', `扫描完成！位置 (${cell.x + 1}, ${cell.y + 1})`);

    set({
      mineGrid: newGrid,
      power: newPower,
      operationHistory: [...state.operationHistory, record],
      powerHistory: [...state.powerHistory, { time: elapsedTime, power: newPower }]
    });

    if (newPower <= 0) {
      get().endGame();
    }
  },

  makeGuess: (cellId: string, mineralId: string) => {
    const state = get();
    const cell = state.mineGrid.flat().find((c) => c.id === cellId);
    if (!cell || cell.status !== 'scanned') return;

    const isCorrect = cell.mineralType === mineralId;

    const newGrid = state.mineGrid.map((row) =>
      row.map((c) => {
        if (c.id === cellId) {
          return { ...c, playerGuess: mineralId, isCorrect };
        }
        return c;
      })
    );

    const record: OperationRecord = {
      timestamp: Date.now(),
      type: 'guess',
      cellId,
      cellPosition: { x: cell.x, y: cell.y },
      equipment: 'manual',
      powerCost: 0,
      result: {
        playerGuess: mineralId,
        isCorrect
      }
    };

    const guessedMineral = getMineralById(mineralId);
    if (isCorrect) {
      get().addMessage('success', `识别正确！这是${guessedMineral?.nameCn || '矿石'}`);
    } else {
      get().addMessage('warning', `识别错误！你猜的是${guessedMineral?.nameCn || '未知'}，实际是${cell.mineral?.nameCn || '空'}`);
    }

    let newScore = state.score;
    if (!isCorrect) {
      newScore += calculateWrongGuessPenalty();
    }

    set({
      mineGrid: newGrid,
      score: Math.max(0, newScore),
      operationHistory: [...state.operationHistory, record]
    });
  },

  mineCell: (cellId: string, equipmentId: string) => {
    const state = get();
    const equipment = getEquipmentById(equipmentId);
    if (!equipment || equipment.type !== 'drill') return;
    if (state.power < equipment.powerCost) {
      get().addMessage('error', '电量不足，无法执行开采！');
      return;
    }

    const cell = state.mineGrid.flat().find((c) => c.id === cellId);
    if (!cell || cell.status !== 'scanned' || !cell.mineral) return;

    if (cell.playerGuess === null) {
      get().addMessage('warning', '请先判断矿石类型再开采！');
      return;
    }

    const newPower = state.power - equipment.powerCost;
    const quantity = Math.floor(GAME_CONFIG.MINING_BASE_QUANTITY * equipment.efficiency);
    const isCorrect = cell.isCorrect ?? false;
    const miningScore = calculateMiningScore(
      cell.mineral.value,
      quantity,
      equipment.efficiency,
      isCorrect
    );

    const inventoryResult = addToInventory(
      state.inventory,
      cell.mineral,
      quantity
    );

    const newGrid = state.mineGrid.map((row) =>
      row.map((c) => {
        if (c.id === cellId) {
          return { ...c, status: 'mined' as const, minedQuantity: quantity };
        }
        return c;
      })
    );

    const elapsedTime = Math.floor((Date.now() - state.gameStartTime) / 1000);
    const record: OperationRecord = {
      timestamp: Date.now(),
      type: 'mine',
      cellId,
      cellPosition: { x: cell.x, y: cell.y },
      equipment: equipmentId,
      powerCost: equipment.powerCost,
      result: {
        mineralType: cell.mineralType || undefined,
        quantity,
        scoreChange: miningScore
      }
    };

    get().addMessage(
      'success',
      `开采完成！获得 ${quantity} 单位 ${cell.mineral.nameCn}，得分 +${miningScore}`
    );

    if (inventoryResult.isMixed) {
      get().addMessage('warning', '注意：库存混放会降低价值！');
    }

    set({
      mineGrid: newGrid,
      power: newPower,
      score: state.score + miningScore,
      inventory: inventoryResult.newInventory,
      currentInventory: inventoryResult.currentTotal,
      operationHistory: [...state.operationHistory, record],
      powerHistory: [...state.powerHistory, { time: elapsedTime, power: newPower }]
    });

    if (newPower <= 0) {
      get().endGame();
    }
  },

  addMessage: (type, text) => {
    const state = get();
    const message: GameMessage = {
      id: `msg-${Date.now()}`,
      type,
      text,
      timestamp: Date.now()
    };
    set({ messages: [...state.messages.slice(-4), message] });
  },

  clearMessages: () => {
    set({ messages: [] });
  },

  endGame: () => {
    const state = get();
    get().addMessage('info', '游戏结束！查看结算报告了解详情。');
    set({ phase: 'ended', gameEndTime: Date.now() });
  },

  resetGame: () => {
    set(createInitialState());
  },

  setStateForReplay: (newState) => {
    set((state) => ({ ...state, ...newState }));
  }
}));
