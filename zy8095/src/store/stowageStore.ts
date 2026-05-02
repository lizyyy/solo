import { useState, useCallback } from 'react';
import type { StowageState, CargoPlacement, HistoryAction } from '@/types';

const EMPTY_STATE: StowageState = {
  bays: [],
  cargoItems: [],
  placements: [],
  rules: {
    maxTotalWeight: 1000,
    maxDeckWeight: 500,
    maxCargoHoldWeight: 500,
    balanceLimits: {
      maxPortStarboardDifference: 100,
      maxForeAftDifference: 100,
    },
    dangerousGoods: {
      isolationDistance: 5,
      incompatibleClasses: {},
    },
  },
};

export function useStowageStore() {
  const [state, setState] = useState<StowageState>(EMPTY_STATE);
  const [history, setHistory] = useState<HistoryAction[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const saveState = useCallback((newState: StowageState) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({
      type: 'PLACE',
      payload: null,
      previousState: { ...state },
    });
    setState(newState);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [state, history, historyIndex]);

  const placeCargo = useCallback((cargoId: string, bayId: string, position: { x: number; y: number; z: number }) => {
    const existingPlacement = state.placements.find(p => p.cargoId === cargoId);
    let newPlacements: CargoPlacement[];
    
    if (existingPlacement) {
      newPlacements = state.placements.map(p => 
        p.cargoId === cargoId ? { cargoId, bayId, position } : p
      );
    } else {
      newPlacements = [...state.placements, { cargoId, bayId, position }];
    }

    saveState({ ...state, placements: newPlacements });
  }, [state, saveState]);

  const removeCargo = useCallback((cargoId: string) => {
    const newPlacements = state.placements.filter(p => p.cargoId !== cargoId);
    saveState({ ...state, placements: newPlacements });
  }, [state, saveState]);

  const undo = useCallback(() => {
    if (historyIndex < 0) return;
    
    const action = history[historyIndex];
    setState(action.previousState);
    setHistoryIndex(historyIndex - 1);
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex >= history.length - 1) return;
    
    setHistoryIndex(historyIndex + 1);
    setState({ ...state });
  }, [history, historyIndex, state]);

  const canUndo = historyIndex >= 0;
  const canRedo = historyIndex < history.length - 1;

  const loadState = useCallback((newState: StowageState) => {
    setState(newState);
    setHistory([]);
    setHistoryIndex(-1);
  }, []);

  const clearPlacements = useCallback(() => {
    saveState({ ...state, placements: [] });
  }, [state, saveState]);

  return {
    state,
    placeCargo,
    removeCargo,
    undo,
    redo,
    canUndo,
    canRedo,
    loadState,
    clearPlacements,
  };
}

export function exportLoadPlan(state: StowageState): string {
  const lines = [
    '# 配载方案报告',
    '',
    '## 船舶舱位信息',
    '',
    `舱位总数: ${state.bays.length}`,
    `甲板舱位: ${state.bays.filter(b => b.isDeck).length}`,
    `货舱舱位: ${state.bays.filter(b => !b.isDeck).length}`,
    '',
    '## 货物清单',
    '',
    `货物总数: ${state.cargoItems.length}`,
    `已配载: ${state.placements.length}`,
    `未配载: ${state.cargoItems.length - state.placements.length}`,
    '',
    '### 配载明细',
    '',
    '| 箱号 | 舱位 | X坐标 | Y坐标 | Z坐标 | 重量 | 类别 |',
    '|------|------|-------|-------|-------|------|------|',
  ];

  for (const placement of state.placements) {
    const cargo = state.cargoItems.find(c => c.id === placement.cargoId);
    const bay = state.bays.find(b => b.id === placement.bayId);
    if (cargo && bay) {
      lines.push([
        cargo.containerNo,
        bay.name,
        placement.position.x.toFixed(2),
        placement.position.y.toFixed(2),
        placement.position.z.toFixed(2),
        cargo.weight ?? '未知',
        cargo.category,
      ].join(' | '));
    }
  }

  if (state.cargoItems.length - state.placements.length > 0) {
    lines.push('', '### 未配载货物', '');
    const placedIds = new Set(state.placements.map(p => p.cargoId));
    for (const cargo of state.cargoItems.filter(c => !placedIds.has(c.id))) {
      lines.push(`- ${cargo.containerNo} (${cargo.weight ?? '未知'}吨, ${cargo.category})`);
    }
  }

  lines.push('', '## 稳定性规则', '');
  lines.push(`最大总载重: ${state.rules.maxTotalWeight} 吨`);
  lines.push(`最大甲板载重: ${state.rules.maxDeckWeight} 吨`);
  lines.push(`最大货舱载重: ${state.rules.maxCargoHoldWeight} 吨`);
  lines.push(`左右平衡限制: ±${state.rules.balanceLimits.maxPortStarboardDifference} 吨`);
  lines.push(`前后平衡限制: ±${state.rules.balanceLimits.maxForeAftDifference} 吨`);
  lines.push(`危险品隔离距离: ${state.rules.dangerousGoods.isolationDistance} 米`);

  return lines.join('\n');
}

export function saveToLocalStorage(state: StowageState): void {
  localStorage.setItem('cargo-stowage-state', JSON.stringify(state));
}

export function loadFromLocalStorage(): StowageState | null {
  const saved = localStorage.getItem('cargo-stowage-state');
  if (!saved) return null;
  try {
    return JSON.parse(saved);
  } catch {
    return null;
  }
}