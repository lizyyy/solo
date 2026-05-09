import { Explanation } from '../database';
import { TransactionData } from '../types';

interface Thresholds {
  amount: number;
  velocity_24h: number;
  amount_deviation: number;
}

const DEFAULT_THRESHOLDS: Thresholds = {
  amount: 50000,
  velocity_24h: 10,
  amount_deviation: 3,
};

const FEATURE_NAMES: Record<string, string> = {
  amount: '交易金额',
  velocity_24h: '24小时交易频次',
  amount_deviation: '金额偏离度',
  is_first_transaction: '首次交易',
  is_night: '夜间交易',
  is_weekend: '周末交易',
  device_id: '设备异常',
  country: '地区异常',
  category: '品类异常',
};

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
}

export function calculateRiskScore(tx: TransactionData): number {
  let score = 0;
  const weights: Record<string, number> = {
    amount_deviation: 25,
    velocity_24h: 20,
    amount: 15,
    is_first_transaction: 10,
    is_night: 8,
    is_weekend: 5,
  };

  if (tx.amount_deviation && tx.amount_deviation >= DEFAULT_THRESHOLDS.amount_deviation) {
    score += Math.min(weights.amount_deviation, tx.amount_deviation * 8);
  }

  if (tx.velocity_24h && tx.velocity_24h >= DEFAULT_THRESHOLDS.velocity_24h) {
    score += Math.min(weights.velocity_24h, tx.velocity_24h * 2);
  }

  if (tx.amount >= DEFAULT_THRESHOLDS.amount) {
    score += weights.amount;
  }

  if (tx.is_first_transaction) {
    score += weights.is_first_transaction;
  }

  if (tx.is_night) {
    score += weights.is_night;
  }

  if (tx.is_weekend) {
    score += weights.is_weekend;
  }

  return Math.min(100, score);
}

export function generateExplanations(tx: TransactionData, riskScore: number): Explanation[] {
  const explanations: Explanation[] = [];
  const now = new Date().toISOString();

  if (tx.amount >= DEFAULT_THRESHOLDS.amount) {
    const contribution = Math.min(15, (tx.amount / DEFAULT_THRESHOLDS.amount) * 15);
    explanations.push({
      id: generateId(),
      transaction_id: tx.transaction_id,
      feature: 'amount',
      feature_value: `¥${tx.amount.toLocaleString()}`,
      contribution: contribution,
      threshold: `¥${DEFAULT_THRESHOLDS.amount.toLocaleString()}`,
      reason: '单笔交易金额超过高风险阈值',
      created_at: now,
    });
  }

  if (tx.velocity_24h && tx.velocity_24h >= DEFAULT_THRESHOLDS.velocity_24h) {
    const contribution = Math.min(20, tx.velocity_24h * 2);
    explanations.push({
      id: generateId(),
      transaction_id: tx.transaction_id,
      feature: 'velocity_24h',
      feature_value: `${tx.velocity_24h} 笔`,
      contribution: contribution,
      threshold: `${DEFAULT_THRESHOLDS.velocity_24h} 笔/24h`,
      reason: '24小时内交易频次过高，可能存在账户异常',
      created_at: now,
    });
  }

  if (tx.amount_deviation && tx.amount_deviation >= DEFAULT_THRESHOLDS.amount_deviation) {
    const contribution = Math.min(25, tx.amount_deviation * 8);
    explanations.push({
      id: generateId(),
      transaction_id: tx.transaction_id,
      feature: 'amount_deviation',
      feature_value: `${tx.amount_deviation.toFixed(2)}x`,
      contribution: contribution,
      threshold: `${DEFAULT_THRESHOLDS.amount_deviation}x`,
      reason: '本次交易金额显著偏离用户历史平均水平',
      created_at: now,
    });
  }

  if (tx.is_first_transaction) {
    explanations.push({
      id: generateId(),
      transaction_id: tx.transaction_id,
      feature: 'is_first_transaction',
      feature_value: '是',
      contribution: 10,
      threshold: '首次交易',
      reason: '新用户或新设备首次交易，风险较高',
      created_at: now,
    });
  }

  if (tx.is_night) {
    explanations.push({
      id: generateId(),
      transaction_id: tx.transaction_id,
      feature: 'is_night',
      feature_value: '是',
      contribution: 8,
      threshold: '夜间时段(00:00-06:00)',
      reason: '夜间时段交易频率增加欺诈风险',
      created_at: now,
    });
  }

  if (tx.is_weekend) {
    explanations.push({
      id: generateId(),
      transaction_id: tx.transaction_id,
      feature: 'is_weekend',
      feature_value: '是',
      contribution: 5,
      threshold: '周末',
      reason: '周末大额交易需要额外关注',
      created_at: now,
    });
  }

  explanations.sort((a, b) => b.contribution - a.contribution);

  return explanations;
}

export function isAnomaly(riskScore: number): boolean {
  return riskScore >= 30;
}

export function getFeatureName(key: string): string {
  return FEATURE_NAMES[key] || key;
}
