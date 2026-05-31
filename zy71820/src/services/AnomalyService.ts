import { getFromIndex } from '../utils/idb';
import { calculateStandardDeviation, calculateMean } from '../utils/helpers';
import type { AnomalyDetail, SourceType } from '../types/data';
import type { GameState } from '../types/game';

export interface CheatingDetectionResult {
  isCheating: boolean;
  confidence: number;
  reason: string;
  sourceType: SourceType;
  contact: string;
}

export async function detectCheating(
  score: number,
  levelId: string,
  gameState: GameState
): Promise<CheatingDetectionResult> {
  const allScores = await getFromIndex('player_score', 'by-levelId', levelId);
  const normalScores = allScores
    .filter((s) => s.status === 'normal')
    .map((s) => s.score);

  if (normalScores.length < 5) {
    return {
      isCheating: false,
      confidence: 0,
      reason: '历史数据不足，暂不检测',
      sourceType: 'level_draft',
      contact: '运营组 @关卡策划',
    };
  }

  const mean = calculateMean(normalScores);
  const stdDev = calculateStandardDeviation(normalScores);
  const threshold = mean + 3 * stdDev;

  let isCheating = false;
  let confidence = 0;
  let reason = '';
  let sourceType: SourceType = 'level_draft';
  let contact = '运营组 @数据审核员';

  if (score > threshold) {
    isCheating = true;
    confidence = Math.min(0.95, (score - threshold) / (mean + stdDev));
    reason = `分数(${score})超出正常范围(均值:${Math.floor(mean)}, 阈值:${Math.floor(threshold)})`;
  }

  const servedCustomers = gameState.totalCustomersServed;
  const duration = gameState.timeRemaining > 0 ? 120 - gameState.timeRemaining : 120;
  const serveRate = servedCustomers / Math.max(1, duration);

  if (serveRate > 1.5) {
    isCheating = true;
    confidence = Math.max(confidence, 0.8);
    reason += ` 服务速率异常(${serveRate.toFixed(2)}人/秒)`;
    sourceType = 'player_feedback';
    contact = '运营组 @玩家反馈专员';
  }

  const revenuePerCustomer = gameState.revenue / Math.max(1, servedCustomers);
  if (revenuePerCustomer > 50) {
    isCheating = true;
    confidence = Math.max(confidence, 0.7);
    reason += ` 单客收入异常(${revenuePerCustomer.toFixed(2)}元)`;
    sourceType = 'player_feedback';
    contact = '运营组 @玩家反馈专员';
  }

  return {
    isCheating,
    confidence,
    reason: reason.trim(),
    sourceType,
    contact,
  };
}

export function createAnomalyDetail(
  detectionResult: CheatingDetectionResult
): AnomalyDetail {
  return {
    sourceType: detectionResult.sourceType,
    contact: detectionResult.contact,
    description: detectionResult.reason,
    detectedAt: Date.now(),
    confidence: detectionResult.confidence,
  };
}

export async function checkDuplicateScore(
  playerName: string,
  levelId: string
): Promise<boolean> {
  const allScores = await getFromIndex('player_score', 'by-levelId', levelId);
  return allScores.some(
    (s) => s.playerName === playerName && s.status !== 'rejected'
  );
}

export function getSourceTypeLabel(sourceType: SourceType): string {
  const labels: Record<SourceType, string> = {
    level_draft: '关卡草表',
    player_feedback: '玩家反馈',
  };
  return labels[sourceType];
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    normal: '正常',
    pending: '待复核',
    corrected: '已修正',
    rejected: '已驳回',
  };
  return labels[status] || status;
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    normal: 'bg-neon-green/20 text-neon-green border-neon-green/50',
    pending: 'bg-neon-yellow/20 text-neon-yellow border-neon-yellow/50',
    corrected: 'bg-neon-blue/20 text-neon-blue border-neon-blue/50',
    rejected: 'bg-neon-pink/20 text-neon-pink border-neon-pink/50',
  };
  return colors[status] || 'bg-gray-500/20 text-gray-400 border-gray-500/50';
}
