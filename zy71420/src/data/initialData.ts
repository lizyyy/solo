import { Bond, GameState } from '../types/game';
import { calculateBondPrice } from '../logic/bondPricing';

export const GAME_VERSION = '1.0.0';
export const GAME_SOURCE = 'hamster_bond_exchange_edu_v1';

export const INITIAL_CASH = 10000;
export const INITIAL_RATE = 3.0;
export const TOTAL_ROUNDS = 10;

export function createInitialBonds(marketRate: number): Bond[] {
  const bonds: Bond[] = [
    {
      id: 'bond_short',
      name: '仓鼠短期债',
      faceValue: 100,
      couponRate: 3.0,
      currentPrice: 100,
      maturityRound: 3,
      issueRound: 0,
      source: GAME_SOURCE,
      version: GAME_VERSION
    },
    {
      id: 'bond_medium',
      name: '仓鼠中期债',
      faceValue: 100,
      couponRate: 4.0,
      currentPrice: 100,
      maturityRound: 6,
      issueRound: 0,
      source: GAME_SOURCE,
      version: GAME_VERSION
    },
    {
      id: 'bond_long',
      name: '仓鼠长期债',
      faceValue: 100,
      couponRate: 5.0,
      currentPrice: 100,
      maturityRound: 10,
      issueRound: 0,
      source: GAME_SOURCE,
      version: GAME_VERSION
    }
  ];

  return bonds.map(bond => ({
    ...bond,
    currentPrice: calculateBondPrice(
      bond.faceValue,
      bond.couponRate,
      marketRate,
      bond.maturityRound
    )
  }));
}

export function createInitialState(): GameState {
  const initialBonds = createInitialBonds(INITIAL_RATE);

  return {
    status: 'idle',
    currentRound: 0,
    totalRounds: TOTAL_ROUNDS,
    marketRate: INITIAL_RATE,
    initialRate: INITIAL_RATE,
    cash: INITIAL_CASH,
    initialCash: INITIAL_CASH,
    positions: [],
    bonds: initialBonds,
    events: [],
    transactions: [],
    couponRecords: [],
    errors: [],
    history: [],
    version: GAME_VERSION,
    source: GAME_SOURCE,
    selectedBondId: null,
    reviewMode: false,
    reviewRound: 0
  };
}
