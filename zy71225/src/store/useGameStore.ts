import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  GameState,
  GameMaterials,
  Position,
  ActionRecord,
  PositionChange,
  MarketSnapshot,
} from '@/types';
import { calculatePortfolioGreeks } from '@/engine/greekCalculator';
import { calculateMargin, updateMarginWithCash, checkBankruptcy } from '@/engine/marginCalculator';
import { calculateTradingFee, calculateTotalFees } from '@/engine/feeCalculator';
import { generateId } from '@/data/defaultMaterials';
import { generateReviewReport, calculateTotalFees as calcTotalFees } from '@/engine/reviewEngine';
import type { ReviewReport } from '@/types';

interface GameStore {
  currentGame: GameState | null;
  materials: GameMaterials | null;
  reviewReport: ReviewReport | null;
  savedGames: Array<{ id: string; name: string; status: string; date: number }>;
  
  startGame: (materials: GameMaterials) => void;
  loadMarketEvent: (round: number) => void;
  executeAction: (
    actionType: 'adjust' | 'stopLoss' | 'hold',
    positionChanges: Array<{ positionId: string; changeQuantity: number }>
  ) => { success: boolean; error?: string };
  nextRound: () => void;
  forceLiquidation: (reason: string) => void;
  endGame: () => void;
  loadGame: (gameId: string) => void;
  saveGame: () => void;
  clearCurrentGame: () => void;
  exportReview: () => string;
}

const createInitialGameState = (materials: GameMaterials): GameState => {
  const initialUnderlyingPrice = materials.initialUnderlyingPrice;
  const initialVolatility = materials.marketEvents[0]?.volatility || 20;
  
  const { portfolioGreeks, updatedPositions, totalPnL, totalMarketValue } = calculatePortfolioGreeks(
    materials.initialPositions,
    initialUnderlyingPrice,
    initialVolatility
  );

  const margin = calculateMargin(
    updatedPositions,
    materials.marginConfig,
    initialUnderlyingPrice,
    initialVolatility
  );

  const marginWithCash = updateMarginWithCash(margin, materials.initialCash, materials.marginConfig);

  return {
    id: generateId(),
    materialId: materials.id,
    materialName: materials.name,
    currentRound: 0,
    totalRounds: materials.marketEvents.length,
    status: 'idle',
    positions: updatedPositions,
    currentGreeks: portfolioGreeks,
    marginStatus: marginWithCash,
    cash: materials.initialCash,
    totalPnL,
    realizedPnL: 0,
    unrealizedPnL: totalPnL,
    actionHistory: [],
    marketHistory: [],
    currentMarket: null,
  };
};

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      currentGame: null,
      materials: null,
      reviewReport: null,
      savedGames: [],

      startGame: (materials: GameMaterials) => {
        const initialState = createInitialGameState(materials);
        set({
          currentGame: { ...initialState, status: 'playing' },
          materials,
          reviewReport: null,
        });
      },

      loadMarketEvent: (round: number) => {
        const { currentGame, materials } = get();
        if (!currentGame || !materials || round <= 0 || round > materials.marketEvents.length) return;

        const marketEvent = materials.marketEvents[round - 1];
        const { portfolioGreeks, updatedPositions, totalPnL, unrealizedPnL } = calculatePortfolioGreeks(
          currentGame.positions,
          marketEvent.underlyingPrice,
          marketEvent.volatility
        );

        const margin = calculateMargin(
          updatedPositions,
          materials.marginConfig,
          marketEvent.underlyingPrice,
          marketEvent.volatility
        );

        const marginWithCash = updateMarginWithCash(margin, currentGame.cash, materials.marginConfig);

        const snapshot: MarketSnapshot = {
          round,
          underlyingPrice: marketEvent.underlyingPrice,
          volatility: marketEvent.volatility,
          greeks: portfolioGreeks,
          margin: marginWithCash,
          totalPnL,
        };

        const isBankrupt = checkBankruptcy(marginWithCash, currentGame.cash);

        set({
          currentGame: {
            ...currentGame,
            currentRound: round,
            positions: updatedPositions,
            currentGreeks: portfolioGreeks,
            marginStatus: marginWithCash,
            totalPnL,
            unrealizedPnL,
            currentMarket: marketEvent,
            marketHistory: [...currentGame.marketHistory, snapshot],
            status: isBankrupt ? 'bankrupt' : currentGame.status,
            bankruptRound: isBankrupt ? round : undefined,
            bankruptReason: isBankrupt ? '行情突变导致保证金耗尽' : undefined,
          },
        });

        if (isBankrupt) {
          get().forceLiquidation('行情突变导致保证金耗尽');
        }
      },

      executeAction: (
        actionType: 'adjust' | 'stopLoss' | 'hold',
        positionChangesInput: Array<{ positionId: string; changeQuantity: number }>
      ) => {
        const { currentGame, materials } = get();
        if (!currentGame || !materials || currentGame.status !== 'playing') {
          return { success: false, error: '游戏未在进行中' };
        }

        const greeksBefore = { ...currentGame.currentGreeks };

        if (actionType === 'hold') {
          const action: ActionRecord = {
            round: currentGame.currentRound,
            timestamp: Date.now(),
            type: 'hold',
            positionChanges: [],
            totalCost: 0,
            greeksBefore,
            greeksAfter: greeksBefore,
          };

          const lastSnapshot = currentGame.marketHistory[currentGame.marketHistory.length - 1];
          if (lastSnapshot) {
            lastSnapshot.action = action;
          }

          set({
            currentGame: {
              ...currentGame,
              actionHistory: [...currentGame.actionHistory, action],
              marketHistory: [...currentGame.marketHistory],
            },
          });

          return { success: true };
        }

        const changesWithDetails = positionChangesInput
          .filter(pc => pc.changeQuantity !== 0)
          .map(pc => {
            const position = currentGame.positions.find(p => p.id === pc.positionId);
            if (!position) return null;

            const price = position.type === 'underlying'
              ? currentGame.currentMarket?.underlyingPrice || materials.initialUnderlyingPrice
              : position.currentPrice || position.costPrice;

            const { fee, executionPrice } = calculateTradingFee(
              position,
              pc.changeQuantity,
              price,
              materials.feeConfig
            );

            let pnlRealized = 0;
            if ((pc.changeQuantity < 0 && position.quantity > 0) || 
                (pc.changeQuantity > 0 && position.quantity < 0)) {
              const closeQuantity = Math.min(Math.abs(pc.changeQuantity), Math.abs(position.quantity));
              pnlRealized = (executionPrice - position.costPrice) * closeQuantity * 
                (position.type === 'underlying' ? 1 : 100) * Math.sign(pc.changeQuantity) * -1;
            }

            return {
              position,
              changeQuantity: pc.changeQuantity,
              price,
              fee,
              executionPrice,
              pnlRealized,
            };
          })
          .filter(Boolean) as Array<{
            position: Position;
            changeQuantity: number;
            price: number;
            fee: number;
            executionPrice: number;
            pnlRealized: number;
          }>;

        const { totalFee, positionResults } = calculateTotalFees(
          changesWithDetails.map(c => ({
            position: c.position,
            changeQuantity: c.changeQuantity,
            price: c.price,
          })),
          materials.feeConfig
        );

        let totalCost = totalFee;
        let totalRealizedPnL = 0;

        const finalPositionChanges: PositionChange[] = changesWithDetails.map((c, idx) => {
          const tradeValue = c.changeQuantity * c.executionPrice * (c.position.type === 'underlying' ? 1 : 100);
          if (c.changeQuantity > 0) {
            totalCost += Math.abs(tradeValue);
          } else {
            totalCost -= Math.abs(tradeValue);
          }
          totalRealizedPnL += positionResults[idx].pnlRealized;

          return {
            positionId: c.position.id,
            contractCode: c.position.contractCode,
            changeQuantity: c.changeQuantity,
            executionPrice: c.executionPrice,
            fee: c.fee,
            pnlRealized: positionResults[idx].pnlRealized,
          };
        });

        if (totalCost > currentGame.cash) {
          return { success: false, error: '现金不足，无法完成交易' };
        }

        let updatedPositions = currentGame.positions.map(pos => {
          const change = finalPositionChanges.find(pc => pc.positionId === pos.id);
          if (!change) return pos;

          const newQuantity = pos.quantity + change.changeQuantity;
          
          if (newQuantity === 0) {
            return { ...pos, quantity: 0, pnl: 0, marketValue: 0 };
          }

          let newCostPrice = pos.costPrice;
          if ((change.changeQuantity > 0 && pos.quantity >= 0) || 
              (change.changeQuantity < 0 && pos.quantity <= 0)) {
            const totalOldCost = pos.costPrice * Math.abs(pos.quantity);
            const totalNewCost = change.executionPrice * Math.abs(change.changeQuantity);
            const totalQuantity = Math.abs(newQuantity);
            newCostPrice = (totalOldCost + totalNewCost) / totalQuantity;
          }

          return {
            ...pos,
            quantity: newQuantity,
            costPrice: newCostPrice,
          };
        }).filter(pos => pos.quantity !== 0 || pos.type === 'underlying');

        const underlyingPosition = updatedPositions.find(p => p.type === 'underlying');
        if (!underlyingPosition) {
          updatedPositions.push({
            id: 'underlying-' + generateId(),
            contractCode: 'UNDERLYING',
            type: 'underlying',
            strike: 0,
            expiryDays: 0,
            quantity: 0,
            costPrice: currentGame.currentMarket?.underlyingPrice || materials.initialUnderlyingPrice,
          });
        }

        const currentPrice = currentGame.currentMarket?.underlyingPrice || materials.initialUnderlyingPrice;
        const currentVolatility = currentGame.currentMarket?.volatility || 20;

        const { portfolioGreeks: greeksAfter, updatedPositions: positionsWithGreeks, totalPnL, unrealizedPnL } = calculatePortfolioGreeks(
          updatedPositions,
          currentPrice,
          currentVolatility
        );

        const newMargin = calculateMargin(
          positionsWithGreeks,
          materials.marginConfig,
          currentPrice,
          currentVolatility
        );

        const newCash = currentGame.cash - totalCost + totalRealizedPnL;
        const marginWithCash = updateMarginWithCash(newMargin, newCash, materials.marginConfig);

        const action: ActionRecord = {
          round: currentGame.currentRound,
          timestamp: Date.now(),
          type: actionType,
          positionChanges: finalPositionChanges,
          totalCost: totalFee,
          greeksBefore,
          greeksAfter,
        };

        const lastSnapshot = currentGame.marketHistory[currentGame.marketHistory.length - 1];
        if (lastSnapshot) {
          lastSnapshot.action = action;
          lastSnapshot.greeks = greeksAfter;
          lastSnapshot.margin = marginWithCash;
          lastSnapshot.totalPnL = totalPnL;
        }

        const isBankrupt = checkBankruptcy(marginWithCash, newCash);

        set({
          currentGame: {
            ...currentGame,
            positions: positionsWithGreeks,
            currentGreeks: greeksAfter,
            marginStatus: marginWithCash,
            cash: newCash,
            totalPnL,
            realizedPnL: currentGame.realizedPnL + totalRealizedPnL,
            unrealizedPnL,
            actionHistory: [...currentGame.actionHistory, action],
            marketHistory: [...currentGame.marketHistory],
            status: isBankrupt ? 'bankrupt' : currentGame.status,
            bankruptRound: isBankrupt ? currentGame.currentRound : undefined,
            bankruptReason: isBankrupt ? '调仓后保证金不足' : undefined,
          },
        });

        if (isBankrupt) {
          get().forceLiquidation('调仓后保证金不足');
        }

        return { success: true };
      },

      nextRound: () => {
        const { currentGame, materials } = get();
        if (!currentGame || !materials) return;

        if (currentGame.currentRound >= materials.marketEvents.length) {
          get().endGame();
          return;
        }

        get().loadMarketEvent(currentGame.currentRound + 1);
      },

      forceLiquidation: (reason: string) => {
        const { currentGame, materials } = get();
        if (!currentGame || !materials) return;

        const currentPrice = currentGame.currentMarket?.underlyingPrice || materials.initialUnderlyingPrice;
        
        let totalLiquidationValue = 0;
        let totalRealizedPnL = 0;
        const liquidationChanges: PositionChange[] = [];

        for (const position of currentGame.positions) {
          if (position.quantity === 0) continue;

          const closeQuantity = -position.quantity;
          const { fee, executionPrice } = calculateTradingFee(
            position,
            closeQuantity,
            currentPrice,
            materials.feeConfig
          );

          const pnlRealized = (executionPrice - position.costPrice) * Math.abs(position.quantity) * 
            (position.type === 'underlying' ? 1 : 100) * Math.sign(position.quantity);

          const tradeValue = Math.abs(closeQuantity * executionPrice * (position.type === 'underlying' ? 1 : 100));
          totalLiquidationValue += tradeValue - fee;
          totalRealizedPnL += pnlRealized - fee;

          liquidationChanges.push({
            positionId: position.id,
            contractCode: position.contractCode,
            changeQuantity: closeQuantity,
            executionPrice,
            fee,
            pnlRealized,
          });
        }

        const newCash = currentGame.cash + totalLiquidationValue + totalRealizedPnL;

        const action: ActionRecord = {
          round: currentGame.currentRound,
          timestamp: Date.now(),
          type: 'stopLoss',
          positionChanges: liquidationChanges,
          totalCost: liquidationChanges.reduce((sum, pc) => sum + pc.fee, 0),
          greeksBefore: currentGame.currentGreeks,
          greeksAfter: { delta: 0, gamma: 0, vega: 0, theta: 0, rho: 0 },
        };

        const lastSnapshot = currentGame.marketHistory[currentGame.marketHistory.length - 1];
        if (lastSnapshot) {
          lastSnapshot.action = action;
        }

        set({
          currentGame: {
            ...currentGame,
            positions: currentGame.positions.map(p => ({ ...p, quantity: 0, pnl: 0, marketValue: 0 })),
            currentGreeks: { delta: 0, gamma: 0, vega: 0, theta: 0, rho: 0 },
            cash: newCash,
            totalPnL: currentGame.realizedPnL + totalRealizedPnL,
            realizedPnL: currentGame.realizedPnL + totalRealizedPnL,
            unrealizedPnL: 0,
            status: 'bankrupt',
            actionHistory: [...currentGame.actionHistory, action],
            marketHistory: [...currentGame.marketHistory],
            bankruptReason: reason,
          },
        });

        get().endGame();
      },

      endGame: () => {
        const { currentGame, materials } = get();
        if (!currentGame || !materials) return;

        const totalFee = calcTotalFees(currentGame.actionHistory);
        const report = generateReviewReport(currentGame, materials.greekTargets, totalFee);

        set({
          currentGame: { ...currentGame, status: 'ended' },
          reviewReport: report,
          savedGames: [
            {
              id: currentGame.id,
              name: currentGame.materialName,
              status: currentGame.status === 'bankrupt' ? '爆仓' : '完成',
              date: Date.now(),
            },
            ...get().savedGames,
          ],
        });
      },

      loadGame: (gameId: string) => {
      },

      saveGame: () => {
      },

      clearCurrentGame: () => {
        set({
          currentGame: null,
          materials: null,
          reviewReport: null,
        });
      },

      exportReview: () => {
        const { reviewReport, currentGame } = get();
        if (!reviewReport) return '';
        
        const exportData = {
          report: reviewReport,
          gameState: currentGame,
          exportedAt: Date.now(),
        };
        
        return JSON.stringify(exportData, null, 2);
      },
    }),
    {
      name: 'greek-defense-game-store',
      partialize: (state) => ({
        savedGames: state.savedGames,
      }),
    }
  )
);
