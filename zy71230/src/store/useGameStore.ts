import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { GameState, GameActions, StopPhase } from '../types/game';
import type { Tour, Stop, MerchItem, DecisionLog, RiskEvent, StopResult, GamePhase } from '../types/tour';

const initialState: GameState = {
  currentTour: null,
  stops: [],
  merchItems: [],
  currentStopIndex: 0,
  currentStopPhase: 'risk_check',
  gamePhase: 'setup',
  cashFlow: 0,
  totalRevenue: 0,
  totalExpense: 0,
  riskIndex: 0,
  decisions: [],
  riskEvents: [],
  stopResults: [],
  isPaused: false,
  isGameOver: false,
  dailySalesRate: {},
};

export const useGameStore = create<GameState & GameActions>()(
  persist(
    (set) => ({
      ...initialState,

      startTour: (tour: Tour, stops: Stop[], merchItems: MerchItem[]) => {
        const dailySalesRate: Record<string, number> = {};
        merchItems.forEach((item) => {
          dailySalesRate[item.id] = item.initialStock / Math.max(1, stops.length * 2);
        });

        set({
          currentTour: tour,
          stops: stops.map((s, i) => ({ ...s, status: i === 0 ? 'current' : 'pending' })),
          merchItems,
          currentStopIndex: 0,
          currentStopPhase: 'risk_check',
          gamePhase: 'playing',
          cashFlow: tour.initialBudget,
          totalRevenue: 0,
          totalExpense: 0,
          riskIndex: 0,
          decisions: [],
          riskEvents: [],
          stopResults: [],
          isPaused: false,
          isGameOver: false,
          dailySalesRate,
        });
      },

      processStop: (stopId: string, results: StopResult) => {
        set((state) => {
          const newStops = state.stops.map((stop) => {
            if (stop.id === stopId) {
              return { ...stop, status: 'completed' as const, actualAttendance: results.actualAttendance };
            }
            return stop;
          });

          const nextIndex = state.currentStopIndex + 1;
          if (nextIndex < newStops.length) {
            newStops[nextIndex] = { ...newStops[nextIndex], status: 'current' as const };
          }

          const newCashFlow = state.cashFlow + results.netProfit;
          const isGameOver = newCashFlow < 0 || nextIndex >= newStops.length;

          return {
            stops: newStops,
            currentStopIndex: nextIndex,
            currentStopPhase: nextIndex >= newStops.length ? 'settled' : 'risk_check',
            cashFlow: newCashFlow,
            totalRevenue: state.totalRevenue + results.totalRevenue,
            totalExpense: state.totalExpense + results.totalExpense,
            stopResults: [...state.stopResults, results],
            isGameOver,
            gameOverReason: newCashFlow < 0 ? '现金流耗尽，巡演无法继续' : undefined,
            gamePhase: isGameOver ? 'review' : state.gamePhase,
          };
        });
      },

      recordDecision: (decision: Omit<DecisionLog, 'id' | 'createdAt'>) => {
        set((state) => ({
          decisions: [
            ...state.decisions,
            {
              ...decision,
              id: `decision-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              createdAt: new Date().toISOString(),
            },
          ],
        }));
      },

      recordRiskEvent: (event: Omit<RiskEvent, 'id' | 'triggeredAt'>) => {
        set((state) => ({
          riskEvents: [
            ...state.riskEvents,
            {
              ...event,
              id: `risk-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              triggeredAt: new Date().toISOString(),
            },
          ],
        }));
      },

      resolveRisk: (riskId: string, optionId?: string) => {
        set((state) => ({
          riskEvents: state.riskEvents.map((r) =>
            r.id === riskId
              ? { ...r, resolvedAt: new Date().toISOString(), chosenOptionId: optionId }
              : r
          ),
        }));
      },

      dismissRisk: (riskId: string, impact: { cashFlow: number; description: string }) => {
        set((state) => ({
          riskEvents: state.riskEvents.map((r) =>
            r.id === riskId
              ? {
                  ...r,
                  dismissed: true,
                  resolvedAt: new Date().toISOString(),
                  dismissedImpact: impact,
                }
              : r
          ),
          cashFlow: state.cashFlow + impact.cashFlow,
          totalExpense: impact.cashFlow < 0 ? state.totalExpense + Math.abs(impact.cashFlow) : state.totalExpense,
        }));
      },

      updateCashFlow: (amount: number) => {
        set((state) => {
          const newCashFlow = state.cashFlow + amount;
          return {
            cashFlow: newCashFlow,
            totalExpense: amount < 0 ? state.totalExpense + Math.abs(amount) : state.totalExpense,
            totalRevenue: amount > 0 ? state.totalRevenue + amount : state.totalRevenue,
            isGameOver: newCashFlow < 0 ? true : state.isGameOver,
            gameOverReason: newCashFlow < 0 ? '现金流耗尽，巡演无法继续' : state.gameOverReason,
            gamePhase: newCashFlow < 0 ? 'review' : state.gamePhase,
          };
        });
      },

      updateMerchStock: (merchItemId: string, quantityChange: number) => {
        set((state) => ({
          merchItems: state.merchItems.map((item) =>
            item.id === merchItemId
              ? { ...item, currentStock: Math.max(0, item.currentStock + quantityChange) }
              : item
          ),
        }));
      },

      updateRiskIndex: (delta: number) => {
        set((state) => ({
          riskIndex: Math.max(0, Math.min(100, state.riskIndex + delta)),
        }));
      },

      setCurrentStopIndex: (index: number) => {
        set((state) => ({
          currentStopIndex: index,
          currentStopPhase: 'risk_check' as StopPhase,
          stops: state.stops.map((stop, i) => ({
            ...stop,
            status: i === index ? 'current' : i < index ? 'completed' : 'pending',
          })),
        }));
      },

      setCurrentStopPhase: (phase: StopPhase) => {
        set({ currentStopPhase: phase });
      },

      goToPhase: (phase: GamePhase) => {
        set({ gamePhase: phase });
      },

      setPaused: (paused: boolean) => {
        set({ isPaused: paused });
      },

      endGame: (reason?: string) => {
        set({
          isGameOver: true,
          gameOverReason: reason,
          gamePhase: 'review',
        });
      },

      resetGame: () => {
        set(initialState);
      },

      loadGame: (state: GameState) => {
        set(state);
      },
    }),
    {
      name: 'tour-budget-game-storage',
      partialize: (state) => ({
        currentTour: state.currentTour,
        stops: state.stops,
        merchItems: state.merchItems,
        currentStopIndex: state.currentStopIndex,
        currentStopPhase: state.currentStopPhase,
        gamePhase: state.gamePhase,
        cashFlow: state.cashFlow,
        totalRevenue: state.totalRevenue,
        totalExpense: state.totalExpense,
        riskIndex: state.riskIndex,
        decisions: state.decisions,
        riskEvents: state.riskEvents,
        stopResults: state.stopResults,
        isGameOver: state.isGameOver,
        gameOverReason: state.gameOverReason,
        dailySalesRate: state.dailySalesRate,
      }),
    }
  )
);
