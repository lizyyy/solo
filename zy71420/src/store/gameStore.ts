import { create } from 'zustand';
import { GameState, Position, RoundSnapshot } from '../types/game';
import { createInitialState } from '../data/initialData';
import { updateBondPrices } from '../logic/bondPricing';
import { executeBuy, executeSell, calculateTotalAssets } from '../logic/trading';
import { generateRandomEvent } from '../logic/events';
import { calculateCouponPayment } from '../logic/settlement';

interface GameStore extends GameState {
  startGame: () => void;
  pauseGame: () => void;
  resumeGame: () => void;
  resetGame: () => void;
  nextRound: () => void;
  endGame: () => void;
  selectBond: (bondId: string | null) => void;
  buyBond: (bondId: string, quantity: number) => void;
  sellBond: (bondId: string, quantity: number) => void;
  setReviewMode: (enabled: boolean, round?: number) => void;
  getPosition: (bondId: string) => Position | undefined;
  getTotalAssets: () => number;
  getRoundSnapshot: (round: number) => RoundSnapshot | undefined;
}

export const useGameStore = create<GameStore>((set, get) => ({
  ...createInitialState(),

  startGame: () => {
    const state = createInitialState();
    set({
      ...state,
      status: 'playing',
      currentRound: 1,
      events: [generateRandomEvent(1)]
    });
  },

  pauseGame: () => {
    set(state => ({
      status: state.status === 'playing' ? 'paused' : state.status
    }));
  },

  resumeGame: () => {
    set(state => ({
      status: state.status === 'paused' ? 'playing' : state.status
    }));
  },

  resetGame: () => {
    set(createInitialState());
  },

  nextRound: () => {
    const state = get();
    if (state.status !== 'playing') return;

    const { totalCoupon, records } = calculateCouponPayment(state.positions, state.bonds);
    const updatedRecords = records.map(r => ({ ...r, round: state.currentRound }));

    const newCash = state.cash + totalCoupon;

    const nextRound = state.currentRound + 1;
    const isGameEnd = nextRound > state.totalRounds;

    if (isGameEnd) {
      const finalBonds = updateBondPrices(state.bonds, state.marketRate, state.currentRound);
      const finalCash = finalBonds.reduce((cash, bond) => {
        const pos = state.positions.find(p => p.bondId === bond.id);
        if (pos && bond.maturityRound === state.currentRound) {
          return cash + pos.quantity * bond.faceValue;
        }
        return cash;
      }, newCash);

      const finalPositions: Position[] = state.positions
        .filter(p => {
          const bond = state.bonds.find(b => b.id === p.bondId);
          return bond && bond.maturityRound !== state.currentRound;
        })
        .map(p => ({ ...p }));

      const bondPrices: { [key: string]: number } = {};
      finalBonds.forEach(b => { bondPrices[b.id] = b.currentPrice; });

      const snapshot: RoundSnapshot = {
        round: state.currentRound,
        marketRate: state.marketRate,
        cash: finalCash,
        totalAssets: calculateTotalAssets(finalCash, finalPositions, finalBonds),
        bondPrices,
        positions: finalPositions,
        event: state.events.find(e => e.round === state.currentRound) || null,
        errors: [],
        couponIncome: totalCoupon
      };

      set({
        status: 'ended',
        cash: finalCash,
        positions: finalPositions,
        bonds: finalBonds,
        couponRecords: [...state.couponRecords, ...updatedRecords],
        history: [...state.history, snapshot]
      });
      return;
    }

    const newEvent = generateRandomEvent(nextRound);
    const newRate = state.marketRate + newEvent.rateChange / 100;
    const newBonds = updateBondPrices(state.bonds, newRate, state.currentRound);

    const bondPrices: { [key: string]: number } = {};
    newBonds.forEach(b => { bondPrices[b.id] = b.currentPrice; });

    const snapshot: RoundSnapshot = {
      round: state.currentRound,
      marketRate: state.marketRate,
      cash: newCash,
      totalAssets: calculateTotalAssets(newCash, state.positions, newBonds),
      bondPrices,
      positions: [...state.positions],
      event: state.events.find(e => e.round === state.currentRound) || null,
      errors: [],
      couponIncome: totalCoupon
    };

    set({
      currentRound: nextRound,
      marketRate: Math.round(newRate * 100) / 100,
      cash: newCash,
      bonds: newBonds,
      events: [...state.events, newEvent],
      couponRecords: [...state.couponRecords, ...updatedRecords],
      history: [...state.history, snapshot]
    });
  },

  endGame: () => {
    const state = get();
    
    const bondPrices: { [key: string]: number } = {};
    state.bonds.forEach(b => { bondPrices[b.id] = b.currentPrice; });

    const snapshot: RoundSnapshot = {
      round: state.currentRound,
      marketRate: state.marketRate,
      cash: state.cash,
      totalAssets: calculateTotalAssets(state.cash, state.positions, state.bonds),
      bondPrices,
      positions: [...state.positions],
      event: state.events.find(e => e.round === state.currentRound) || null,
      errors: [],
      couponIncome: 0
    };

    set({
      status: 'ended',
      history: [...state.history, snapshot]
    });
  },

  selectBond: (bondId: string | null) => {
    set({ selectedBondId: bondId });
  },

  buyBond: (bondId: string, quantity: number) => {
    const state = get();
    if (state.status !== 'playing') return;

    const result = executeBuy(
      state.cash,
      state.positions,
      state.bonds,
      bondId,
      quantity,
      state.currentRound
    );

    if (result.success) {
      set({
        cash: result.newCash,
        positions: result.newPositions,
        transactions: [...state.transactions, result.transaction]
      });
    }
  },

  sellBond: (bondId: string, quantity: number) => {
    const state = get();
    if (state.status !== 'playing') return;

    const result = executeSell(
      state.cash,
      state.positions,
      state.bonds,
      bondId,
      quantity,
      state.currentRound
    );

    if (result.success) {
      set({
        cash: result.newCash,
        positions: result.newPositions,
        transactions: [...state.transactions, result.transaction]
      });
    }
  },

  setReviewMode: (enabled: boolean, round?: number) => {
    set({
      reviewMode: enabled,
      reviewRound: round ?? 0
    });
  },

  getPosition: (bondId: string) => {
    return get().positions.find(p => p.bondId === bondId);
  },

  getTotalAssets: () => {
    const state = get();
    return calculateTotalAssets(state.cash, state.positions, state.bonds);
  },

  getRoundSnapshot: (round: number) => {
    return get().history.find(h => h.round === round);
  }
}));
