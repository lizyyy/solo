import { create } from 'zustand';
import type {
  GameStatus,
  BoxType,
  Commodity,
  CommodityInstance,
  PlacedItem,
  Violation,
  Operation,
  SettlementResult,
  Level,
  ToastMessage,
} from '../types/game';
import { getLevelById, getNextLevel } from '../data/levels';
import { getBoxTypeById } from '../data/boxTypes';
import { getCommodityById } from '../data/commodities';
import { checkCollision, isWithinBox, snapToGrid } from '../utils/rules/collision';
import { runAllChecks, checkFatalViolations } from '../utils/rules/rulesEngine';
import { calculateScore } from '../utils/rules/scoreCalculator';
import { generateInstanceId, generateId } from '../utils/idGenerator';

interface GameState {
  status: GameStatus;
  currentLevelId: string | null;
  currentLevel: Level | null;
  score: number;
  timeElapsed: number;
  isPaused: boolean;
  totalCommodities: number;
  
  selectedBoxType: BoxType | null;
  placedItems: PlacedItem[];
  pendingCommodities: CommodityInstance[];
  selectedCommodity: CommodityInstance | null;
  
  operationStack: Operation[];
  currentStackIndex: number;
  
  violations: Violation[];
  settlementResult: SettlementResult | null;
  
  toasts: ToastMessage[];
  unlockedLevels: string[];
  levelScores: Record<string, number>;
  
  startLevel: (levelId: string) => void;
  selectCommodity: (commodity: CommodityInstance | null) => void;
  placeItem: (instanceId: string, x: number, y: number, layer: number, rotation?: number) => boolean;
  removeItem: (instanceId: string) => void;
  rotateSelected: () => void;
  undo: () => void;
  redo: () => void;
  pause: () => void;
  resume: () => void;
  restart: () => void;
  submit: () => void;
  reset: () => void;
  updateTime: (delta: number) => void;
  
  addToast: (message: Omit<ToastMessage, 'id'>) => void;
  removeToast: (id: string) => void;
  
  loadProgress: () => void;
  saveProgress: () => void;
  
  canUndo: () => boolean;
  canRedo: () => boolean;
  canSubmit: () => boolean;
  validatePlacement: (commodity: CommodityInstance, x: number, y: number, layer: number, rotation: number) => {
    isValid: boolean;
    collisionItem?: PlacedItem;
    outOfBounds?: boolean;
  };
}

const STORAGE_KEY = 'warehouse_packing_progress';

const createCommodityInstance = (commodity: Commodity): CommodityInstance => ({
  ...commodity,
  instanceId: generateInstanceId(),
});

export const useGameStore = create<GameState>((set, get) => ({
  status: 'idle',
  currentLevelId: null,
  currentLevel: null,
  score: 0,
  timeElapsed: 0,
  isPaused: false,
  totalCommodities: 0,
  
  selectedBoxType: null,
  placedItems: [],
  pendingCommodities: [],
  selectedCommodity: null,
  
  operationStack: [],
  currentStackIndex: -1,
  
  violations: [],
  settlementResult: null,
  
  toasts: [],
  unlockedLevels: ['level_1'],
  levelScores: {},
  
  loadProgress: () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        set({
          unlockedLevels: data.unlockedLevels || ['level_1'],
          levelScores: data.levelScores || {},
        });
      }
    } catch (e) {
      console.error('Failed to load progress:', e);
    }
  },
  
  saveProgress: () => {
    try {
      const { unlockedLevels, levelScores } = get();
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        unlockedLevels,
        levelScores,
      }));
    } catch (e) {
      console.error('Failed to save progress:', e);
    }
  },
  
  startLevel: (levelId: string) => {
    const level = getLevelById(levelId);
    if (!level) return;
    
    const boxType = getBoxTypeById(level.boxTypeId);
    if (!boxType) return;
    
    const commodityInstances = level.commodityIds
      .map(id => getCommodityById(id))
      .filter(Boolean)
      .map(commodity => createCommodityInstance(commodity!)) as CommodityInstance[];
    
    set({
      status: 'playing',
      currentLevelId: levelId,
      currentLevel: level,
      score: 100,
      timeElapsed: 0,
      isPaused: false,
      totalCommodities: commodityInstances.length,
      selectedBoxType: boxType,
      placedItems: [],
      pendingCommodities: commodityInstances,
      selectedCommodity: null,
      operationStack: [],
      currentStackIndex: -1,
      violations: [],
      settlementResult: null,
    });
  },
  
  selectCommodity: (commodity: CommodityInstance | null) => {
    set({ selectedCommodity: commodity });
  },
  
  validatePlacement: (
    commodity: CommodityInstance,
    x: number,
    y: number,
    layer: number,
    rotation: number
  ) => {
    const { placedItems, selectedBoxType } = get();
    if (!selectedBoxType) return { isValid: false, outOfBounds: true };
    
    const isRotated = rotation % 180 !== 0;
    const width = isRotated ? commodity.height : commodity.width;
    const height = isRotated ? commodity.width : commodity.height;
    
    const snapped = snapToGrid(x, y);
    const testItem: PlacedItem = {
      instanceId: 'temp',
      commodityId: commodity.id,
      x: snapped.x,
      y: snapped.y,
      layer,
      rotation,
    };
    
    const originalCommodity = { ...commodity, width, height };
    const collisionItem = checkCollision(
      testItem,
      placedItems,
      layer
    );
    
    const outOfBounds = !isWithinBox(
      testItem,
      selectedBoxType
    );
    
    return {
      isValid: !collisionItem && !outOfBounds,
      collisionItem: collisionItem || undefined,
      outOfBounds,
    };
  },
  
  placeItem: (instanceId: string, x: number, y: number, layer: number, rotation: number = 0) => {
    const { pendingCommodities, placedItems, selectedBoxType, operationStack, currentStackIndex, status } = get();
    if (status !== 'playing') return false;
    
    const commodityInstance = pendingCommodities.find(c => c.instanceId === instanceId);
    if (!commodityInstance || !selectedBoxType) return false;
    
    const snapped = snapToGrid(x, y);
    
    const isRotated = rotation % 180 !== 0;
    const width = isRotated ? commodityInstance.height : commodityInstance.width;
    const height = isRotated ? commodityInstance.width : commodityInstance.height;
    const testItem: PlacedItem = {
      instanceId,
      commodityId: commodityInstance.id,
      x: snapped.x,
      y: snapped.y,
      layer,
      rotation,
    };
    
    if (checkCollision(testItem, placedItems, layer)) {
      get().addToast({
        type: 'error',
        message: '该位置与其他商品重叠',
        duration: 2000,
      });
      return false;
    }
    
    if (!isWithinBox(testItem, selectedBoxType)) {
      get().addToast({
        type: 'error',
        message: '商品超出箱子范围',
        duration: 2000,
      });
      return false;
    }
    
    const newItem: PlacedItem = {
      instanceId,
      commodityId: commodityInstance.id,
      x: snapped.x,
      y: snapped.y,
      layer,
      rotation,
    };
    
    const newPlacedItems = [...placedItems, newItem];
    const newPendingCommodities = pendingCommodities.filter(c => c.instanceId !== instanceId);
    
    const violations = runAllChecks(newPlacedItems, selectedBoxType);
    const fatalViolation = checkFatalViolations(violations);
    
    const operation: Operation = {
      type: 'place',
      item: newItem,
      timestamp: Date.now(),
    };
    
    const newStack = operationStack.slice(0, currentStackIndex + 1);
    newStack.push(operation);
    
    set({
      placedItems: newPlacedItems,
      pendingCommodities: newPendingCommodities,
      selectedCommodity: null,
      operationStack: newStack,
      currentStackIndex: newStack.length - 1,
      violations,
    });
    
    if (fatalViolation) {
      get().addToast({
        type: 'error',
        message: `致命违规：${fatalViolation.description}`,
        duration: 3000,
      });
    } else if (violations.length > 0) {
      get().addToast({
        type: 'warning',
        message: `检测到${violations.length}项违规`,
        duration: 2000,
      });
    }
    
    return true;
  },
  
  removeItem: (instanceId: string) => {
    const { placedItems, pendingCommodities, selectedBoxType, operationStack, currentStackIndex, status } = get();
    if (status !== 'playing') return;
    
    const item = placedItems.find(i => i.instanceId === instanceId);
    if (!item) return;
    
    const commodity = getCommodityById(item.commodityId);
    if (!commodity) return;
    
    const commodityInstance: CommodityInstance = {
      ...commodity,
      instanceId,
    };
    
    const newPlacedItems = placedItems.filter(i => i.instanceId !== instanceId);
    const newPendingCommodities = [...pendingCommodities, commodityInstance];
    
    const violations = selectedBoxType ? runAllChecks(newPlacedItems, selectedBoxType) : [];
    
    const operation: Operation = {
      type: 'remove',
      item,
      timestamp: Date.now(),
    };
    
    const newStack = operationStack.slice(0, currentStackIndex + 1);
    newStack.push(operation);
    
    set({
      placedItems: newPlacedItems,
      pendingCommodities: newPendingCommodities,
      operationStack: newStack,
      currentStackIndex: newStack.length - 1,
      violations,
    });
  },
  
  rotateSelected: () => {
    const { selectedCommodity } = get();
    if (!selectedCommodity) return;
    
    get().addToast({
      type: 'info',
      message: '按 R 键可旋转商品',
      duration: 1500,
    });
  },
  
  undo: () => {
    const { operationStack, currentStackIndex, placedItems, pendingCommodities, status } = get();
    if (status !== 'playing' || currentStackIndex < 0) return;
    
    const operation = operationStack[currentStackIndex];
    let newPlacedItems = [...placedItems];
    let newPendingCommodities = [...pendingCommodities];
    
    if (operation.type === 'place') {
      newPlacedItems = newPlacedItems.filter(i => i.instanceId !== operation.item.instanceId);
      const commodity = getCommodityById(operation.item.commodityId);
      if (commodity) {
        const commodityInstance: CommodityInstance = {
          ...commodity,
          instanceId: operation.item.instanceId,
        };
        newPendingCommodities.push(commodityInstance);
      }
    } else if (operation.type === 'remove') {
      newPlacedItems.push(operation.item);
      newPendingCommodities = newPendingCommodities.filter(c => c.instanceId !== operation.item.instanceId);
    }
    
    const { selectedBoxType } = get();
    const violations = selectedBoxType ? runAllChecks(newPlacedItems, selectedBoxType) : [];
    
    set({
      placedItems: newPlacedItems,
      pendingCommodities: newPendingCommodities,
      currentStackIndex: currentStackIndex - 1,
      violations,
    });
  },
  
  redo: () => {
    const { operationStack, currentStackIndex, placedItems, pendingCommodities, status } = get();
    if (status !== 'playing' || currentStackIndex >= operationStack.length - 1) return;
    
    const nextIndex = currentStackIndex + 1;
    const operation = operationStack[nextIndex];
    let newPlacedItems = [...placedItems];
    let newPendingCommodities = [...pendingCommodities];
    
    if (operation.type === 'place') {
      newPlacedItems.push(operation.item);
      newPendingCommodities = newPendingCommodities.filter(c => c.instanceId !== operation.item.instanceId);
    } else if (operation.type === 'remove') {
      newPlacedItems = newPlacedItems.filter(i => i.instanceId !== operation.item.instanceId);
      const commodity = getCommodityById(operation.item.commodityId);
      if (commodity) {
        const commodityInstance: CommodityInstance = {
          ...commodity,
          instanceId: operation.item.instanceId,
        };
        newPendingCommodities.push(commodityInstance);
      }
    }
    
    const { selectedBoxType } = get();
    const violations = selectedBoxType ? runAllChecks(newPlacedItems, selectedBoxType) : [];
    
    set({
      placedItems: newPlacedItems,
      pendingCommodities: newPendingCommodities,
      currentStackIndex: nextIndex,
      violations,
    });
  },
  
  pause: () => {
    set({ isPaused: true, status: 'paused' });
  },
  
  resume: () => {
    set({ isPaused: false, status: 'playing' });
  },
  
  restart: () => {
    const { currentLevelId } = get();
    if (currentLevelId) {
      get().startLevel(currentLevelId);
    }
  },
  
  submit: () => {
    const { placedItems, selectedBoxType, timeElapsed, currentLevel, currentLevelId, unlockedLevels, levelScores, totalCommodities, operationStack } = get();
    if (!selectedBoxType || !currentLevel) return;
    
    if (placedItems.length !== totalCommodities) {
      get().addToast({
        type: 'error',
        message: `还有 ${totalCommodities - placedItems.length} 件商品未装箱`,
        duration: 3000,
      });
      return;
    }
    
    const result = calculateScore(
      placedItems,
      selectedBoxType,
      timeElapsed,
      currentLevel.timeLimit,
      currentLevel.commodityIds.length
    );
    
    let newUnlockedLevels = [...unlockedLevels];
    let newLevelScores = { ...levelScores };
    
    if (result.isPassed) {
      const nextLevel = getNextLevel(currentLevelId!);
      if (nextLevel && !newUnlockedLevels.includes(nextLevel.id)) {
        newUnlockedLevels.push(nextLevel.id);
        get().addToast({
          type: 'success',
          message: `解锁新关卡：${nextLevel.name}`,
          duration: 3000,
        });
      }
      
      const currentBest = newLevelScores[currentLevelId!] || 0;
      if (result.score > currentBest) {
        newLevelScores[currentLevelId!] = result.score;
      }
    }
    
    set({
      status: result.isPassed ? 'submitted' : 'failed',
      settlementResult: result,
      score: result.score,
      unlockedLevels: newUnlockedLevels,
      levelScores: newLevelScores,
    });
    
    get().saveProgress();
  },
  
  reset: () => {
    set({
      status: 'idle',
      currentLevelId: null,
      currentLevel: null,
      score: 0,
      timeElapsed: 0,
      isPaused: false,
      totalCommodities: 0,
      selectedBoxType: null,
      placedItems: [],
      pendingCommodities: [],
      selectedCommodity: null,
      operationStack: [],
      currentStackIndex: -1,
      violations: [],
      settlementResult: null,
    });
  },
  
  updateTime: (delta: number) => {
    const { status, isPaused, timeElapsed, currentLevel } = get();
    if (status !== 'playing' || isPaused) return;
    
    const newTime = timeElapsed + delta;
    
    if (currentLevel && currentLevel.timeLimit > 0 && newTime >= currentLevel.timeLimit) {
      get().addToast({
        type: 'warning',
        message: '时间到！请尽快提交',
        duration: 2000,
      });
    }
    
    set({ timeElapsed: newTime });
  },
  
  addToast: (toast) => {
    const id = generateId();
    const newToast = { ...toast, id };
    set(state => ({ toasts: [...state.toasts, newToast] }));
    
    setTimeout(() => {
      get().removeToast(id);
    }, toast.duration);
  },
  
  removeToast: (id: string) => {
    set(state => ({ toasts: state.toasts.filter(t => t.id !== id) }));
  },
  
  canUndo: () => {
    const { currentStackIndex, status } = get();
    return status === 'playing' && currentStackIndex >= 0;
  },
  
  canRedo: () => {
    const { currentStackIndex, operationStack, status } = get();
    return status === 'playing' && currentStackIndex < operationStack.length - 1;
  },
  
  canSubmit: () => {
    const { placedItems, totalCommodities, status } = get();
    return status === 'playing' && placedItems.length === totalCommodities && totalCommodities > 0;
  },
}));
