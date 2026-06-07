import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { GameState, GameConfig, Position, TradeRecord, NewsConfig, Settlement, SettleTrigger, ValidationError } from '../types/game';
import type { HistoryRecord, HistoryRound } from '../types/history';
import { defaultLevel, getLevelById } from '../data';
import { generateId, clamp } from '../utils/formatters';
import { saveHistoryRecord } from '../utils/storage';

interface GameStore extends GameState {
  gameId: string | null;
  settlement: Settlement | null;
  rounds: HistoryRound[];
  currentConfig: GameConfig | null;
  loadConfig: (config: GameConfig) => void;
  startGame: () => void;
  pauseGame: () => void;
  resumeGame: () => void;
  restartGame: () => void;
  nextRound: () => void;
  settleGame: (trigger: SettleTrigger) => void;
  executeTrade: (params: {
    newsEventId: string;
    symbol: string;
    action: 'buy' | 'sell' | 'hold';
    quantity: number;
    price: number;
    position: number;
    reason: string;
  }) => void;
  addNewsToHistory: (news: NewsConfig) => void;
  setValidationErrors: (errors: ValidationError[]) => void;
  confirmError: (errorPath: string) => void;
  updatePositions: (positions: Position[]) => void;
  updateMarketIndex: (index: number) => void;
  saveToHistory: () => void;
  resetAll: () => void;
}

const getInitialState = (config: GameConfig = defaultLevel) => ({
  gameId: null as string | null,
  configId: config.id,
  configName: config.name,
  currentConfig: config,
  status: 'pending' as const,
  currentRound: 1,
  totalRounds: config.totalRounds,
  initialCapital: config.initialCapital,
  currentCapital: config.initialCapital,
  settlementReason: '',
  isLocked: false,
  startTime: null as string | null,
  endTime: null as string | null,
  marketIndex: config.rounds[0]?.marketIndex || 3000,
  positions: [],
  trades: [],
  newsHistory: [],
  settlement: null as Settlement | null,
  validationErrors: [],
  confirmedErrors: [],
});

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      ...getInitialState(),
      rounds: [],

      loadConfig: (config: GameConfig) => {
        set({
          ...getInitialState(config),
          rounds: [],
          gameId: generateId(),
        });
      },

      startGame: () => {
        const state = get();
        const now = new Date().toISOString();
        set({
          status: 'playing',
          startTime: now,
          gameId: state.gameId || generateId(),
          rounds: [],
        });
      },

      pauseGame: () => {
        set({
          status: 'paused',
          isLocked: true,
        });
      },

      resumeGame: () => {
        set({
          status: 'playing',
          isLocked: false,
        });
      },

      restartGame: () => {
        const state = get();
        const config = state.currentConfig || getLevelById(state.configId) || defaultLevel;
        set({
          ...getInitialState(config),
          rounds: [],
          gameId: generateId(),
        });
      },

      nextRound: () => {
        const state = get();
        const nextRound = state.currentRound + 1;
        const config = state.currentConfig || getLevelById(state.configId) || defaultLevel;

        const currentRoundData: HistoryRound = {
          roundNumber: state.currentRound,
          marketIndex: state.marketIndex,
          news: state.newsHistory.filter((n) => {
            const roundConfig = config.rounds.find((r) => r.roundNumber === state.currentRound);
            return roundConfig?.news.some((rn) => rn.id === n.id);
          }),
          trades: state.trades.filter((t) => t.roundNumber === state.currentRound),
          positions: [...state.positions],
          capital: state.currentCapital,
          timestamp: new Date().toISOString(),
        };

        if (nextRound > state.totalRounds) {
          get().settleGame('round_end');
        } else {
          const nextRoundConfig = config.rounds.find((r) => r.roundNumber === nextRound);
          set({
            currentRound: nextRound,
            marketIndex: nextRoundConfig?.marketIndex || state.marketIndex,
            rounds: [...state.rounds, currentRoundData],
          });
        }
      },

      settleGame: (trigger: SettleTrigger) => {
        const state = get();
        const now = new Date().toISOString();

        const totalReturn = state.currentCapital - state.initialCapital;
        const totalReturnPercent = totalReturn / state.initialCapital;

        const winningTrades = state.trades.filter((t) => {
          const position = state.positions.find((p) => p.symbol === t.symbol);
          return position && position.profitLoss > 0;
        });
        const winRate = state.trades.length > 0 ? winningTrades.length / state.trades.length : 0;

        let maxDrawdown = 0;
        let peak = state.initialCapital;
        state.rounds.forEach((round) => {
          if (round.capital > peak) peak = round.capital;
          const drawdown = (peak - round.capital) / peak;
          if (drawdown > maxDrawdown) maxDrawdown = drawdown;
        });

        const settlement: Settlement = {
          id: generateId(),
          gameId: state.gameId || '',
          totalReturn,
          totalReturnPercent,
          annualizedReturn: totalReturnPercent * 250,
          maxDrawdown,
          winRate,
          tradeCount: state.trades.length,
          triggerCondition: trigger,
          settleTime: now,
        };

        const reasonMap: Record<SettleTrigger, string> = {
          round_end: '回合结束自动结算',
          manual: '手动结算',
          stop_loss: '触发止损线',
          take_profit: '触发止盈线',
        };

        set({
          status: 'settled',
          isLocked: true,
          settlementReason: reasonMap[trigger],
          endTime: now,
          settlement,
        });

        get().saveToHistory();
      },

      executeTrade: (params) => {
        const state = get();
        if (state.isLocked) return;

        const { newsEventId, symbol, action, quantity, price, position, reason } = params;

        const trade: TradeRecord = {
          id: generateId(),
          gameId: state.gameId || '',
          newsEventId,
          roundNumber: state.currentRound,
          symbol,
          action,
          quantity,
          price,
          position,
          reason,
          timestamp: new Date().toISOString(),
        };

        let newCapital = state.currentCapital;
        const newPositions = [...state.positions];
        const posIndex = newPositions.findIndex((p) => p.symbol === symbol);

        if (action === 'buy') {
          const cost = quantity * price;
          newCapital -= cost;

          if (posIndex >= 0) {
            const pos = newPositions[posIndex];
            const totalQuantity = pos.quantity + quantity;
            const totalCost = pos.avgCost * pos.quantity + price * quantity;
            newPositions[posIndex] = {
              ...pos,
              quantity: totalQuantity,
              avgCost: totalCost / totalQuantity,
              currentPrice: price,
              marketValue: totalQuantity * price,
              profitLoss: (price - totalCost / totalQuantity) * totalQuantity,
              profitLossPercent: (price - totalCost / totalQuantity) / (totalCost / totalQuantity),
            };
          } else {
            const state = get();
            const config = state.currentConfig || getLevelById(state.configId) || defaultLevel;
            const stockConfig = config.stocks.find((s) => s.symbol === symbol);
            newPositions.push({
              symbol,
              name: stockConfig?.name || symbol,
              quantity,
              avgCost: price,
              currentPrice: price,
              marketValue: quantity * price,
              profitLoss: 0,
              profitLossPercent: 0,
            });
          }
        } else if (action === 'sell') {
          const revenue = quantity * price;
          newCapital += revenue;

          if (posIndex >= 0) {
            const pos = newPositions[posIndex];
            const remainingQuantity = pos.quantity - quantity;
            if (remainingQuantity <= 0) {
              newPositions.splice(posIndex, 1);
            } else {
              newPositions[posIndex] = {
                ...pos,
                quantity: remainingQuantity,
                currentPrice: price,
                marketValue: remainingQuantity * price,
                profitLoss: (price - pos.avgCost) * remainingQuantity,
                profitLossPercent: (price - pos.avgCost) / pos.avgCost,
              };
            }
          }
        }

        set({
          trades: [...state.trades, trade],
          positions: newPositions,
          currentCapital: newCapital,
        });
      },

      addNewsToHistory: (news: NewsConfig) => {
        const state = get();
        if (!state.newsHistory.find((n) => n.id === news.id)) {
          set({
            newsHistory: [...state.newsHistory, news],
          });
        }
      },

      setValidationErrors: (errors: ValidationError[]) => {
        set({
          validationErrors: errors,
        });
      },

      confirmError: (errorPath: string) => {
        const state = get();
        set({
          confirmedErrors: [...state.confirmedErrors, errorPath],
        });
      },

      updatePositions: (positions: Position[]) => {
        set({ positions });
      },

      updateMarketIndex: (index: number) => {
        set({ marketIndex: index });
      },

      saveToHistory: () => {
        const state = get();
        if (!state.settlement) return;

        const record: HistoryRecord = {
          id: generateId(),
          gameId: state.gameId || '',
          configId: state.configId,
          configName: state.configName,
          startTime: state.startTime || new Date().toISOString(),
          endTime: state.endTime || new Date().toISOString(),
          totalRounds: state.totalRounds,
          initialCapital: state.initialCapital,
          finalCapital: state.currentCapital,
          totalReturn: state.settlement.totalReturn,
          totalReturnPercent: state.settlement.totalReturnPercent,
          settlement: state.settlement,
          finalPositions: state.positions,
          newsHistory: state.newsHistory,
          trades: state.trades,
          rounds: state.rounds,
        };

        saveHistoryRecord(record);
      },

      resetAll: () => {
        const state = get();
        const config = state.currentConfig || getLevelById(state.configId) || defaultLevel;
        set({
          ...getInitialState(config),
          rounds: [],
          gameId: generateId(),
        });
      },
    }),
    {
      name: 'stock-news-game-storage',
      partialize: (state) => ({
        gameId: state.gameId,
        configId: state.configId,
        configName: state.configName,
        currentConfig: state.currentConfig,
        status: state.status,
        currentRound: state.currentRound,
        totalRounds: state.totalRounds,
        initialCapital: state.initialCapital,
        currentCapital: state.currentCapital,
        settlementReason: state.settlementReason,
        isLocked: state.isLocked,
        startTime: state.startTime,
        endTime: state.endTime,
        marketIndex: state.marketIndex,
        positions: state.positions,
        trades: state.trades,
        newsHistory: state.newsHistory,
        settlement: state.settlement,
        rounds: state.rounds,
        validationErrors: state.validationErrors,
        confirmedErrors: state.confirmedErrors,
      }),
    }
  )
);
