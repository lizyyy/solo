import { create } from 'zustand';
import type { BidRecord, ConflictLog, AnomalyEvent, AuctionRound, GameStatus, GameReport } from '../types';
import { createSampleRounds } from '../data/sampleData';

interface GameState {
  status: GameStatus;
  totalBudget: number;
  remainingBudget: number;
  currentRoundIndex: number;
  rounds: AuctionRound[];
  currentPrice: number;
  currentBidder: string | null;
  consecutivePasses: number;
  aiBidInProgress: boolean;

  startGame: () => void;
  reviewInfo: () => void;
  startBidding: () => void;
  placeBid: (amount: number) => void;
  passBid: () => void;
  pauseGame: () => void;
  resumeGame: () => void;
  restartGame: () => void;
  nextRound: () => void;
  settleGame: () => void;
  triggerAiBid: () => void;
  exportReport: () => GameReport;
}

function detectImpulsiveBid(amount: number, currentPrice: number): boolean {
  if (currentPrice === 0) return false;
  return (amount - currentPrice) / currentPrice > 0.2;
}

function detectReserveMisjudgment(amount: number, highEstimate: number): boolean {
  return amount > highEstimate;
}

function detectBudgetOverrun(remainingBudget: number, amount: number): boolean {
  return amount > remainingBudget;
}

function aiBidDecision(
  collector: { name: string; preferenceType: string; aggressiveness: number; maxBudget: number; favoriteCategory: string },
  currentPrice: number,
  valuation: { lowEstimate: number; highEstimate: number; confidence: number },
  artworkCategory: string,
): { willBid: boolean; amount: number; isImpulsive: boolean } {
  let willingness = collector.aggressiveness;
  const isFavorite = collector.favoriteCategory === artworkCategory;
  if (isFavorite) willingness += 0.3;

  const priceToHigh = currentPrice / valuation.highEstimate;
  if (priceToHigh > 1.3) willingness -= 0.6;
  else if (priceToHigh > 1.1) willingness -= 0.3;
  else if (priceToHigh > 0.9) willingness -= 0.1;

  if (currentPrice > collector.maxBudget) willingness = 0;

  willingness += (Math.random() - 0.5) * 0.15;

  const willBid = willingness > 0.35;

  const baseIncrement = Math.max(currentPrice * 0.05, 50000);
  const aggressiveExtra = currentPrice * collector.aggressiveness * 0.05;
  const randomExtra = Math.floor(Math.random() * 50000);
  const rawAmount = currentPrice + baseIncrement + aggressiveExtra + randomExtra;
  const roundedAmount = Math.ceil(rawAmount / 50000) * 50000;

  const isImpulsive = (roundedAmount - currentPrice) / currentPrice > 0.2;

  return { willBid, amount: roundedAmount, isImpulsive };
}

export const useGameStore = create<GameState>((set, get) => ({
  status: 'idle',
  totalBudget: 20000000,
  remainingBudget: 20000000,
  currentRoundIndex: 0,
  rounds: [],
  currentPrice: 0,
  currentBidder: null,
  consecutivePasses: 0,
  aiBidInProgress: false,

  startGame: () => {
    const rounds = createSampleRounds();
    set({
      status: 'info_review',
      totalBudget: 20000000,
      remainingBudget: 20000000,
      currentRoundIndex: 0,
      rounds,
      currentPrice: 0,
      currentBidder: null,
      consecutivePasses: 0,
      aiBidInProgress: false,
    });
  },

  reviewInfo: () => {
    set({ status: 'info_review' });
  },

  startBidding: () => {
    const { rounds, currentRoundIndex } = get();
    const round = rounds[currentRoundIndex];
    const startPrice = round.valuation.lowEstimate * 0.7;
    const updatedRounds = [...rounds];
    updatedRounds[currentRoundIndex] = { ...round, status: 'bidding' };
    set({
      status: 'bidding',
      rounds: updatedRounds,
      currentPrice: Math.floor(startPrice / 50000) * 50000,
      currentBidder: null,
      consecutivePasses: 0,
    });
  },

  placeBid: (amount: number) => {
    const { rounds, currentRoundIndex, remainingBudget, currentPrice } = get();
    const round = rounds[currentRoundIndex];

    const newAnomalies: AnomalyEvent[] = [...round.anomalyEvents];
    const isImpulsive = detectImpulsiveBid(amount, currentPrice);
    const isOverBudget = detectBudgetOverrun(remainingBudget, amount);
    const isReserveMisjudge = detectReserveMisjudgment(amount, round.valuation.highEstimate);

    if (isImpulsive) {
      newAnomalies.push({
        anomalyType: 'impulsive_bid',
        description: `你在当前价 ¥${(currentPrice / 10000).toFixed(0)}万 时加价至 ¥${(amount / 10000).toFixed(0)}万，加价幅度达 ${Math.round(((amount - currentPrice) / currentPrice) * 100)}%，属于冲动加价。`,
        severity: 3,
        context: `当前价: ¥${(currentPrice / 10000).toFixed(0)}万, 出价: ¥${(amount / 10000).toFixed(0)}万, 估价上限: ¥${(round.valuation.highEstimate / 10000).toFixed(0)}万`,
        roundIndex: currentRoundIndex,
      });
    }

    if (isOverBudget) {
      newAnomalies.push({
        anomalyType: 'budget_overrun',
        description: `你的出价 ¥${(amount / 10000).toFixed(0)}万 超出剩余预算 ¥${(remainingBudget / 10000).toFixed(0)}万，构成预算透支。此出价已记录但可能导致后续回合资金不足。`,
        severity: 5,
        context: `剩余预算: ¥${(remainingBudget / 10000).toFixed(0)}万, 出价: ¥${(amount / 10000).toFixed(0)}万, 透支: ¥${((amount - remainingBudget) / 10000).toFixed(0)}万`,
        roundIndex: currentRoundIndex,
      });
    }

    if (isReserveMisjudge) {
      newAnomalies.push({
        anomalyType: 'reserve_misjudgment',
        description: `你的出价 ¥${(amount / 10000).toFixed(0)}万 超过估价上限 ¥${(round.valuation.highEstimate / 10000).toFixed(0)}万，可能构成保留价误判。需评估是否因信息冲突或竞争压力导致估值偏离。`,
        severity: 4,
        context: `出价: ¥${(amount / 10000).toFixed(0)}万, 估价上限: ¥${(round.valuation.highEstimate / 10000).toFixed(0)}万, 超出: ¥${((amount - round.valuation.highEstimate) / 10000).toFixed(0)}万`,
        roundIndex: currentRoundIndex,
      });
    }

    const newBid: BidRecord = {
      bidder: '你',
      amount,
      timestamp: Date.now(),
      isImpulsive,
    };

    const updatedRounds = [...rounds];
    updatedRounds[currentRoundIndex] = {
      ...round,
      bidRecords: [...round.bidRecords, newBid],
      anomalyEvents: newAnomalies,
    };

    set({
      rounds: updatedRounds,
      currentPrice: amount,
      currentBidder: '你',
      consecutivePasses: 0,
    });
  },

  passBid: () => {
    const state = get();
    const newPasses = state.consecutivePasses + 1;

    if (newPasses >= 2 && state.currentBidder) {
      const { rounds, currentRoundIndex, remainingBudget, currentPrice, currentBidder } = state;
      const round = rounds[currentRoundIndex];
      const updatedRounds = [...rounds];
      const wonByPlayer = currentBidder === '你';
      const newRemaining = wonByPlayer ? remainingBudget - currentPrice : remainingBudget;

      const newAnomalies = [...round.anomalyEvents];
      if (currentPrice < round.reservePrice && wonByPlayer) {
        // shouldn't happen but just in case
      }
      if (wonByPlayer && currentPrice > round.valuation.highEstimate) {
        const alreadyHas = newAnomalies.some(a => a.anomalyType === 'reserve_misjudgment' && a.roundIndex === currentRoundIndex);
        if (!alreadyHas) {
          newAnomalies.push({
            anomalyType: 'reserve_misjudgment',
            description: `你以 ¥${(currentPrice / 10000).toFixed(0)}万 成交，超过估价上限 ¥${(round.valuation.highEstimate / 10000).toFixed(0)}万，需重新审视出价依据。`,
            severity: 4,
            context: `成交价: ¥${(currentPrice / 10000).toFixed(0)}万, 估价上限: ¥${(round.valuation.highEstimate / 10000).toFixed(0)}万`,
            roundIndex: currentRoundIndex,
          });
        }
      }

      updatedRounds[currentRoundIndex] = {
        ...round,
        finalPrice: currentPrice,
        winner: currentBidder,
        status: 'ended',
        anomalyEvents: newAnomalies,
      };

      set({
        status: 'round_end',
        rounds: updatedRounds,
        remainingBudget: Math.max(0, newRemaining),
        consecutivePasses: 0,
      });
    } else {
      set({ consecutivePasses: newPasses });
    }
  },

  pauseGame: () => {
    set({ status: 'paused' });
  },

  resumeGame: () => {
    set({ status: 'bidding' });
  },

  restartGame: () => {
    const rounds = createSampleRounds();
    set({
      status: 'idle',
      totalBudget: 20000000,
      remainingBudget: 20000000,
      currentRoundIndex: 0,
      rounds,
      currentPrice: 0,
      currentBidder: null,
      consecutivePasses: 0,
      aiBidInProgress: false,
    });
  },

  nextRound: () => {
    const { currentRoundIndex, rounds } = get();
    const nextIndex = currentRoundIndex + 1;
    if (nextIndex >= rounds.length) {
      set({ status: 'settled' });
    } else {
      set({
        currentRoundIndex: nextIndex,
        status: 'info_review',
        currentPrice: 0,
        currentBidder: null,
        consecutivePasses: 0,
      });
    }
  },

  settleGame: () => {
    set({ status: 'settled' });
  },

  triggerAiBid: () => {
    const state = get();
    if (state.status !== 'bidding' || state.aiBidInProgress) return;

    set({ aiBidInProgress: true });

    const round = state.rounds[state.currentRoundIndex];
    const activeBidders = round.activeCollectors.filter(
      c => state.currentBidder !== c.name && c.maxBudget > state.currentPrice
    );

    if (activeBidders.length === 0) {
      set({ aiBidInProgress: false });
      const newPasses = state.consecutivePasses + 1;
      if (newPasses >= 2 && state.currentBidder) {
        get().passBid();
      } else {
        set({ consecutivePasses: newPasses });
      }
      return;
    }

    const chosenCollector = activeBidders[Math.floor(Math.random() * activeBidders.length)];
    const decision = aiBidDecision(
      chosenCollector,
      state.currentPrice,
      round.valuation,
      round.artwork.category,
    );

    if (decision.willBid) {
      const newBid: BidRecord = {
        bidder: chosenCollector.name,
        amount: decision.amount,
        timestamp: Date.now(),
        isImpulsive: decision.isImpulsive,
      };

      const newAnomalies = [...round.anomalyEvents];
      if (decision.isImpulsive) {
        newAnomalies.push({
          anomalyType: 'impulsive_bid',
          description: `藏家${chosenCollector.name}从 ¥${(state.currentPrice / 10000).toFixed(0)}万 加价至 ¥${(decision.amount / 10000).toFixed(0)}万，加价幅度达 ${Math.round(((decision.amount - state.currentPrice) / state.currentPrice) * 100)}%，属于冲动加价。`,
          severity: 2,
          context: `藏家: ${chosenCollector.name}, 当前价: ¥${(state.currentPrice / 10000).toFixed(0)}万, 出价: ¥${(decision.amount / 10000).toFixed(0)}万`,
          roundIndex: state.currentRoundIndex,
        });
      }

      const updatedRounds = [...state.rounds];
      updatedRounds[state.currentRoundIndex] = {
        ...round,
        bidRecords: [...round.bidRecords, newBid],
        anomalyEvents: newAnomalies,
      };

      set({
        rounds: updatedRounds,
        currentPrice: decision.amount,
        currentBidder: chosenCollector.name,
        consecutivePasses: 0,
        aiBidInProgress: false,
      });
    } else {
      set({ aiBidInProgress: false });
      const newPasses = state.consecutivePasses + 1;
      if (newPasses >= 2 && state.currentBidder) {
        get().passBid();
      } else {
        set({ consecutivePasses: newPasses });
      }
    }
  },

  exportReport: () => {
    const state = get();
    const allConflicts = state.rounds.flatMap(r => r.conflictLogs);
    const allAnomalies = state.rounds.flatMap(r => r.anomalyEvents);
    const playerBids = state.rounds.flatMap(r => r.bidRecords.filter(b => b.bidder === '你'));
    const itemsWon = state.rounds.filter(r => r.winner === '你').length;

    return {
      sessionId: `auction-${Date.now()}`,
      totalBudget: state.totalBudget,
      totalSpent: state.totalBudget - state.remainingBudget,
      remainingBudget: state.remainingBudget,
      rounds: state.rounds.map(r => ({
        artworkName: r.artwork.name,
        artist: r.artwork.artist,
        finalPrice: r.finalPrice,
        winner: r.winner,
        reservePrice: r.reservePrice,
        bidCount: r.bidRecords.length,
        conflicts: r.conflictLogs,
        anomalies: r.anomalyEvents,
      })),
      allConflicts,
      allAnomalies,
      summary: {
        itemsWon,
        totalBids: playerBids.length,
        impulsiveBids: allAnomalies.filter(a => a.anomalyType === 'impulsive_bid').length,
        reserveMisjudgments: allAnomalies.filter(a => a.anomalyType === 'reserve_misjudgment').length,
        budgetOverruns: allAnomalies.filter(a => a.anomalyType === 'budget_overrun').length,
      },
    };
  },
}));
