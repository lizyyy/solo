import type { GameState, CustomerInstance } from '../types/game';

export interface ScoreBreakdown {
  baseScore: number;
  satisfactionBonus: number;
  efficiencyBonus: number;
  comboBonus: number;
  totalScore: number;
}

export function calculateSatisfactionScore(customer: CustomerInstance): number {
  const patienceRatio = customer.patience / customer.maxPatience;
  const waitTimePenalty = Math.max(0, customer.waitTime - 10) * 2;
  const baseSatisfaction = Math.floor(patienceRatio * 50) + 30;
  return Math.max(0, Math.min(100, baseSatisfaction - waitTimePenalty));
}

export function calculateOrderScore(
  _order: string,
  price: number,
  baseCost: number,
  satisfaction: number
): number {
  const profit = price - baseCost;
  const profitBonus = Math.max(0, profit * 2);
  const satisfactionMultiplier = 0.5 + (satisfaction / 100) * 1.5;
  const baseScore = 10 + profitBonus;
  return Math.floor(baseScore * satisfactionMultiplier);
}

export function calculateScoreBreakdown(gameState: GameState): ScoreBreakdown {
  const baseScore = gameState.revenue * 0.5;
  const satisfactionBonus = gameState.satisfaction * 10;
  const servedCustomers = gameState.totalCustomersServed;
  const lostCustomers = gameState.totalCustomersLost;
  const efficiencyRatio = servedCustomers / Math.max(1, servedCustomers + lostCustomers);
  const efficiencyBonus = Math.floor(efficiencyRatio * 500);
  const comboBonus = Math.max(0, servedCustomers - 5) * 20;

  const totalScore = Math.floor(baseScore + satisfactionBonus + efficiencyBonus + comboBonus);

  return {
    baseScore: Math.floor(baseScore),
    satisfactionBonus: Math.floor(satisfactionBonus),
    efficiencyBonus,
    comboBonus,
    totalScore,
  };
}

export function calculateFinalScore(gameState: GameState): number {
  return calculateScoreBreakdown(gameState).totalScore;
}

export function calculateOverallSatisfaction(
  servedCustomers: number,
  totalSatisfaction: number,
  lostCustomers: number
): number {
  const totalCustomers = servedCustomers + lostCustomers;
  if (totalCustomers === 0) return 100;
  const avgSatisfaction = totalSatisfaction / Math.max(1, servedCustomers);
  const lostPenalty = lostCustomers * 5;
  return Math.max(0, Math.min(100, avgSatisfaction - lostPenalty));
}
