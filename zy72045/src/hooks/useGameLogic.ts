import { useMemo } from 'react';
import { useGameStore } from '../store/useGameStore';
import { defaultLevel } from '../data';
import type { NewsConfig } from '../types/game';

export function useGameLogic() {
  const {
    status,
    currentRound,
    totalRounds,
    marketIndex,
    positions,
    trades,
    newsHistory,
    currentCapital,
    initialCapital,
    isLocked,
    settlement,
    settlementReason,
    nextRound,
    executeTrade,
    addNewsToHistory,
  } = useGameStore();

  const currentRoundConfig = useMemo(() => {
    return defaultLevel.rounds.find((r) => r.roundNumber === currentRound);
  }, [currentRound]);

  const currentNews = useMemo(() => {
    return currentRoundConfig?.news || [];
  }, [currentRoundConfig]);

  const availableStocks = useMemo(() => {
    return defaultLevel.stocks;
  }, []);

  const totalReturn = useMemo(() => {
    return currentCapital - initialCapital;
  }, [currentCapital, initialCapital]);

  const totalReturnPercent = useMemo(() => {
    return initialCapital > 0 ? (currentCapital - initialCapital) / initialCapital : 0;
  }, [currentCapital, initialCapital]);

  const totalMarketValue = useMemo(() => {
    return positions.reduce((sum, pos) => sum + pos.marketValue, 0);
  }, [positions]);

  const totalAssets = useMemo(() => {
    return currentCapital + totalMarketValue;
  }, [currentCapital, totalMarketValue]);

  const totalAssetsReturn = useMemo(() => {
    return totalAssets - initialCapital;
  }, [totalAssets, initialCapital]);

  const totalAssetsReturnPercent = useMemo(() => {
    return initialCapital > 0 ? totalAssetsReturn / initialCapital : 0;
  }, [totalAssetsReturn, initialCapital]);

  const canStart = status === 'pending';
  const canPause = status === 'playing';
  const canResume = status === 'paused';
  const canSettle = status === 'playing' || status === 'paused';
  const canRestart = status === 'settled' || status === 'paused' || status === 'playing';
  const canTrade = status === 'playing' && !isLocked;

  const handleTrade = (params: {
    newsEventId: string;
    symbol: string;
    action: 'buy' | 'sell' | 'hold';
    quantity: number;
    price: number;
    position: number;
    reason: string;
  }) => {
    if (!canTrade) return;
    executeTrade(params);
  };

  const handleNewsPublish = (news: NewsConfig) => {
    addNewsToHistory(news);
  };

  const handleNextRound = () => {
    if (status !== 'playing') return;
    nextRound();
  };

  const getCurrentPrice = (symbol: string): number => {
    const stock = availableStocks.find((s) => s.symbol === symbol);
    const position = positions.find((p) => p.symbol === symbol);
    if (position) return position.currentPrice;
    return stock?.basePrice || 0;
  };

  const getMaxBuyQuantity = (symbol: string): number => {
    const price = getCurrentPrice(symbol);
    if (price <= 0) return 0;
    return Math.floor(currentCapital / price / 100) * 100;
  };

  const getMaxSellQuantity = (symbol: string): number => {
    const position = positions.find((p) => p.symbol === symbol);
    return position?.quantity || 0;
  };

  return {
    status,
    currentRound,
    totalRounds,
    marketIndex,
    positions,
    trades,
    newsHistory,
    currentCapital,
    initialCapital,
    settlement,
    settlementReason,
    isLocked,
    currentRoundConfig,
    currentNews,
    availableStocks,
    totalReturn,
    totalReturnPercent,
    totalMarketValue,
    totalAssets,
    totalAssetsReturn,
    totalAssetsReturnPercent,
    canStart,
    canPause,
    canResume,
    canSettle,
    canRestart,
    canTrade,
    handleTrade,
    handleNewsPublish,
    handleNextRound,
    getCurrentPrice,
    getMaxBuyQuantity,
    getMaxSellQuantity,
  };
}
