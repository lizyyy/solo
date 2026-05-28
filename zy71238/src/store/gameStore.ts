import { create } from 'zustand';
import type { GameState, GameActions, IndexComponent, Holding, Warning } from '../types';
import {
  calculateTrackingError,
  calculateTotalAssets,
  checkCashWarning,
  checkSuspensionWarning,
  checkErrorAccumulationWarning,
  calculateReturn,
  generateRandomPriceChange,
} from '../utils/calculations';
import { generateRandomEvent, applyEventImpact } from '../utils/eventSystem';

type GameStore = GameState & GameActions;

const initialState: GameState = {
  round: 0,
  maxRounds: 10,
  cash: 0,
  totalAssets: 0,
  holdings: [],
  indexComponents: [],
  trackingError: 0,
  trackingErrorHistory: [],
  netValueHistory: [],
  indexValueHistory: [],
  currentEvent: null,
  operationLogs: [],
  warnings: [],
  gameStatus: 'idle',
  initialNav: 100000000,
  indexBaseValue: 1000,
};

export const useGameStore = create<GameStore>((set, get) => ({
  ...initialState,

  initializeGame: (components: IndexComponent[]) => {
    const initialFund = 100000000;
    const holdings: Holding[] = components.map(c => {
      const targetValue = initialFund * (c.weight / 100) * 0.95;
      const quantity = Math.floor(targetValue / c.price);
      return {
        code: c.code,
        name: c.name,
        quantity,
        avgCost: c.price,
        currentPrice: c.price,
        isSuspended: c.isSuspended,
      };
    });

    const totalBuyCost = holdings.reduce((sum, h) => sum + h.quantity * h.avgCost, 0);
    const cash = initialFund - totalBuyCost;
    const totalAssets = calculateTotalAssets(holdings, cash);
    const initialNav = totalAssets;
    const indexBaseValue = 1000;

    const initialWarnings: Warning[] = [];
    const cashWarning = checkCashWarning(cash, totalAssets);
    if (cashWarning) initialWarnings.push(cashWarning);
    
    const suspensionWarning = checkSuspensionWarning(holdings, components);
    if (suspensionWarning) initialWarnings.push(suspensionWarning);

    set({
      round: 1,
      maxRounds: 10,
      cash,
      totalAssets,
      holdings,
      indexComponents: components,
      trackingError: 0,
      trackingErrorHistory: [0],
      netValueHistory: [initialNav],
      indexValueHistory: [indexBaseValue],
      currentEvent: null,
      operationLogs: [],
      warnings: initialWarnings,
      gameStatus: 'playing',
      initialNav,
      indexBaseValue,
    });
  },

  buyStock: (code: string, quantity: number) => {
    const state = get();
    const component = state.indexComponents.find(c => c.code === code);
    if (!component || component.isSuspended) return;

    const cost = quantity * component.price;
    if (cost > state.cash) return;

    const existingHolding = state.holdings.find(h => h.code === code);
    let newHoldings: Holding[];

    if (existingHolding) {
      const totalQuantity = existingHolding.quantity + quantity;
      const totalCost = existingHolding.avgCost * existingHolding.quantity + cost;
      const newAvgCost = totalCost / totalQuantity;
      
      newHoldings = state.holdings.map(h =>
        h.code === code
          ? { ...h, quantity: totalQuantity, avgCost: newAvgCost, currentPrice: component.price }
          : h
      );
    } else {
      newHoldings = [
        ...state.holdings,
        {
          code,
          name: component.name,
          quantity,
          avgCost: component.price,
          currentPrice: component.price,
          isSuspended: component.isSuspended,
        },
      ];
    }

    const newCash = state.cash - cost;
    const newTotalAssets = calculateTotalAssets(newHoldings, newCash);

    const newWarnings: typeof state.warnings = [...state.warnings];
    const cashWarning = checkCashWarning(newCash, newTotalAssets);
    if (cashWarning) {
      const exists = newWarnings.some(w => w.type === cashWarning.type);
      if (!exists) newWarnings.push(cashWarning);
    } else {
      const idx = newWarnings.findIndex(w => w.type === 'cash_excess');
      if (idx !== -1) newWarnings.splice(idx, 1);
    }

    const newLog = {
      round: state.round,
      timestamp: Date.now(),
      type: 'buy' as const,
      stockCode: code,
      stockName: component.name,
      quantity,
      price: component.price,
      description: `买入 ${component.name} ${quantity} 股，价格 ${component.price.toFixed(2)} 元`,
      trackingErrorImpact: 0,
    };

    set({
      cash: newCash,
      holdings: newHoldings,
      totalAssets: newTotalAssets,
      warnings: newWarnings,
      operationLogs: [...state.operationLogs, newLog],
    });
  },

  sellStock: (code: string, quantity: number) => {
    const state = get();
    const holding = state.holdings.find(h => h.code === code);
    const component = state.indexComponents.find(c => c.code === code);
    
    if (!holding || holding.quantity < quantity) return;
    if (component?.isSuspended) return;

    const sellPrice = component?.price || holding.currentPrice;
    const proceeds = quantity * sellPrice;
    
    const newHoldings = state.holdings
      .map(h => {
        if (h.code === code) {
          const newQuantity = h.quantity - quantity;
          if (newQuantity === 0) return null;
          return { ...h, quantity: newQuantity, currentPrice: sellPrice };
        }
        return h;
      })
      .filter((h): h is Holding => h !== null);

    const newCash = state.cash + proceeds;
    const newTotalAssets = calculateTotalAssets(newHoldings, newCash);

    const newWarnings: typeof state.warnings = [...state.warnings];
    const cashWarning = checkCashWarning(newCash, newTotalAssets);
    if (cashWarning) {
      const exists = newWarnings.some(w => w.type === cashWarning.type);
      if (!exists) newWarnings.push(cashWarning);
    } else {
      const idx = newWarnings.findIndex(w => w.type === 'cash_excess');
      if (idx !== -1) newWarnings.splice(idx, 1);
    }

    const newLog = {
      round: state.round,
      timestamp: Date.now(),
      type: 'sell' as const,
      stockCode: code,
      stockName: holding.name,
      quantity,
      price: sellPrice,
      description: `卖出 ${holding.name} ${quantity} 股，价格 ${sellPrice.toFixed(2)} 元`,
      trackingErrorImpact: 0,
    };

    set({
      cash: newCash,
      holdings: newHoldings,
      totalAssets: newTotalAssets,
      warnings: newWarnings,
      operationLogs: [...state.operationLogs, newLog],
    });
  },

  handleEvent: () => {
    const state = get();
    if (!state.currentEvent) return;

    const { newCash, updatedComponents } = applyEventImpact(
      state.currentEvent,
      state.cash,
      state.indexComponents
    );

    const newHoldings = state.holdings.map(h => {
      const component = updatedComponents.find(c => c.code === h.code);
      return {
        ...h,
        currentPrice: component?.price || h.currentPrice,
        isSuspended: component?.isSuspended || h.isSuspended,
      };
    });

    const newTotalAssets = calculateTotalAssets(newHoldings, newCash);
    const newWarnings: typeof state.warnings = [...state.warnings];

    const suspensionWarning = checkSuspensionWarning(newHoldings, updatedComponents);
    if (suspensionWarning) {
      const exists = newWarnings.some(w => w.type === suspensionWarning.type);
      if (!exists) newWarnings.push(suspensionWarning);
    }

    const newLog = {
      round: state.round,
      timestamp: Date.now(),
      type: 'eventHandle' as const,
      description: `处理事件: ${state.currentEvent.title}`,
      trackingErrorImpact: 0,
    };

    set({
      cash: newCash,
      holdings: newHoldings,
      indexComponents: updatedComponents,
      totalAssets: newTotalAssets,
      currentEvent: null,
      warnings: newWarnings,
      operationLogs: [...state.operationLogs, newLog],
    });
  },

  nextRound: () => {
    const state = get();
    
    if (state.round >= state.maxRounds) {
      set({ gameStatus: 'ended' });
      return;
    }

    const updatedComponents = state.indexComponents.map(c => ({
      ...c,
      price: c.isSuspended ? c.price : c.price * (1 + generateRandomPriceChange()),
    }));

    const newHoldings = state.holdings.map(h => {
      const component = updatedComponents.find(c => c.code === h.code);
      return {
        ...h,
        currentPrice: component?.price || h.currentPrice,
        isSuspended: component?.isSuspended || h.isSuspended,
      };
    });

    const newTotalAssets = calculateTotalAssets(newHoldings, state.cash);
    const newNetValueHistory = [...state.netValueHistory, newTotalAssets];
    
    const indexReturn = updatedComponents.reduce((sum, c) => {
      const oldComponent = state.indexComponents.find(oc => oc.code === c.code);
      if (!oldComponent) return sum;
      const weight = c.weight / 100;
      const ret = (c.price - oldComponent.price) / oldComponent.price;
      return sum + weight * ret;
    }, 0);
    
    const lastIndexValue = state.indexValueHistory[state.indexValueHistory.length - 1];
    const newIndexValueHistory = [...state.indexValueHistory, lastIndexValue * (1 + indexReturn)];

    const portfolioReturns = newNetValueHistory.slice(1).map((_, i) => 
      calculateReturn(newNetValueHistory.slice(0, i + 2))
    );
    const indexReturns = newIndexValueHistory.slice(1).map((_, i) => 
      calculateReturn(newIndexValueHistory.slice(0, i + 2))
    );

    const newTrackingError = calculateTrackingError(portfolioReturns, indexReturns);
    const newTrackingErrorHistory = [...state.trackingErrorHistory, newTrackingError];

    const newWarnings: typeof state.warnings = state.warnings.filter(w => w.type !== 'error_accumulation');
    
    const errorWarning = checkErrorAccumulationWarning(newTrackingErrorHistory);
    if (errorWarning) {
      newWarnings.push(errorWarning);
    }

    const newEvent = generateRandomEvent(updatedComponents);

    set({
      round: state.round + 1,
      holdings: newHoldings,
      indexComponents: updatedComponents,
      totalAssets: newTotalAssets,
      netValueHistory: newNetValueHistory,
      indexValueHistory: newIndexValueHistory,
      trackingError: newTrackingError,
      trackingErrorHistory: newTrackingErrorHistory,
      currentEvent: newEvent,
      warnings: newWarnings,
    });
  },

  pauseGame: () => set({ gameStatus: 'paused' }),
  resumeGame: () => set({ gameStatus: 'playing' }),
  
  resetGame: () => set(initialState),
  
  endGame: () => set({ gameStatus: 'ended' }),
}));
