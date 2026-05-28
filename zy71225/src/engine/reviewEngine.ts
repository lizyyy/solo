import type {
  GameState,
  GreekTarget,
  MarketSnapshot,
  ReviewReport,
  ErrorAnalysis,
  ReviewScores,
  ActionRecord,
  PositionChange,
} from '@/types';
import { getGreekStatus } from './greekCalculator';

export function generateReviewReport(
  gameState: GameState,
  greekTargets: GreekTarget,
  feeTotal: number
): ReviewReport {
  const timeline = gameState.marketHistory;
  const errors = analyzeErrors(gameState, greekTargets);
  const scores = calculateScores(gameState, greekTargets, feeTotal);

  const playedRounds = gameState.status === 'bankrupt'
    ? (gameState.bankruptRound || gameState.currentRound)
    : gameState.currentRound;

  return {
    gameId: gameState.id,
    materialName: gameState.materialName,
    scores,
    errors,
    timeline,
    finalPnL: gameState.totalPnL,
    totalRounds: gameState.totalRounds,
    playedRounds,
  };
}

function analyzeErrors(
  gameState: GameState,
  greekTargets: GreekTarget
): ErrorAnalysis[] {
  const errors: ErrorAnalysis[] = [];

  for (let i = 0; i < gameState.marketHistory.length; i++) {
    const snapshot = gameState.marketHistory[i];
    const round = snapshot.round;

    const greekErrors = checkGreekViolations(snapshot, greekTargets, round);
    errors.push(...greekErrors);

    if (snapshot.action) {
      const actionErrors = checkActionErrors(snapshot.action, snapshot, greekTargets, round);
      errors.push(...actionErrors);
    }

    const marginErrors = checkMarginViolations(snapshot, round);
    errors.push(...marginErrors);
  }

  if (gameState.status === 'bankrupt') {
    errors.push({
      round: gameState.bankruptRound || gameState.currentRound,
      type: '爆仓',
      severity: 'critical',
      description: gameState.bankruptReason || '保证金不足导致强制平仓',
      consequence: '所有头寸被强制平仓，游戏结束，损失全部本金',
      correctAction: '应在保证金接近预警线时及时减仓或补充保证金，避免触发爆仓',
    });
  }

  return errors;
}

function checkGreekViolations(
  snapshot: MarketSnapshot,
  targets: GreekTarget,
  round: number
): ErrorAnalysis[] {
  const errors: ErrorAnalysis[] = [];
  const { greeks } = snapshot;

  const deltaStatus = getGreekStatus(greeks.delta, targets.delta);
  if (deltaStatus === 'danger') {
    errors.push({
      round,
      type: 'Delta暴露过高',
      severity: greeks.delta > targets.delta.max * 2 ? 'high' : 'medium',
      description: `Delta = ${greeks.delta.toFixed(2)}，超出目标区间 [${targets.delta.min}, ${targets.delta.max}]`,
      consequence: deltaStatus === 'danger' 
        ? '方向性风险过大，标的价格波动将导致巨额盈亏' 
        : '方向性风险偏高，需关注价格变动影响',
      correctAction: '通过买卖标的或调整期权头寸将Delta调回中性区间',
    });
  }

  const gammaStatus = getGreekStatus(greeks.gamma, targets.gamma);
  if (gammaStatus !== 'safe') {
    const isCritical = Math.abs(greeks.gamma) > Math.abs(targets.gamma.max) * 2;
    errors.push({
      round,
      type: 'Gamma暴露过高',
      severity: isCritical ? 'high' : 'medium',
      description: `Gamma = ${greeks.gamma.toFixed(2)}，超出目标区间 [${targets.gamma.min}, ${targets.gamma.max}]`,
      consequence: isCritical
        ? '凸性风险极高，价格大幅波动时会产生巨额亏损，保证金消耗极快'
        : '凸性风险偏高，价格波动会加速盈亏变化',
      correctAction: '买入期权（尤其是虚值期权）增加正Gamma，或减少空头期权头寸',
    });
  }

  const vegaStatus = getGreekStatus(greeks.vega, targets.vega);
  if (vegaStatus !== 'safe') {
    const isCritical = Math.abs(greeks.vega) > Math.abs(targets.vega.max) * 1.5;
    errors.push({
      round,
      type: 'Vega暴露过高',
      severity: isCritical ? 'high' : 'medium',
      description: `Vega = ${greeks.vega.toFixed(2)}，超出目标区间 [${targets.vega.min}, ${targets.vega.max}]`,
      consequence: isCritical
        ? '波动率风险极高，IV突变将导致灾难性损失'
        : '波动率风险偏高，IV变动对组合价值影响较大',
      correctAction: '买卖期权调整Vega暴露，或使用Vega中性策略对冲',
    });
  }

  return errors;
}

function checkActionErrors(
  action: ActionRecord,
  snapshot: MarketSnapshot,
  targets: GreekTarget,
  round: number
): ErrorAnalysis[] {
  const errors: ErrorAnalysis[] = [];

  if (action.type === 'hold') {
    const hasDanger = 
      getGreekStatus(snapshot.greeks.delta, targets.delta) === 'danger' ||
      getGreekStatus(snapshot.greeks.gamma, targets.gamma) !== 'safe' ||
      getGreekStatus(snapshot.greeks.vega, targets.vega) !== 'safe';
    
    if (hasDanger) {
      errors.push({
        round,
        type: '不作为风险',
        severity: 'medium',
        description: '希腊值已处于危险区间，但未采取任何调仓行动',
        consequence: '风险持续累积，下一轮行情波动可能导致无法挽回的损失',
        correctAction: '应及时分析风险来源，采取对冲或减仓措施',
      });
    }
  }

  if (action.type === 'adjust') {
    const totalFee = action.totalCost;
    const positionChanges = action.positionChanges;
    const totalTradeValue = positionChanges.reduce((sum, pc) => {
      return sum + Math.abs(pc.changeQuantity * pc.executionPrice * 100);
    }, 0);
    
    if (totalTradeValue > 0 && totalFee / totalTradeValue > 0.01) {
      errors.push({
        round,
        type: '调仓费用过高',
        severity: 'low',
        description: `调仓费用占交易金额的 ${((totalFee / totalTradeValue) * 100).toFixed(2)}%，超过1%`,
        consequence: '频繁调仓产生的交易成本会侵蚀利润，甚至导致亏损',
        correctAction: '优化调仓策略，减少不必要的交易，或批量执行订单降低滑点',
      });
    }

    const greekImprovement = calculateGreekImprovement(action.greeksBefore, action.greeksAfter, targets);
    if (greekImprovement < -0.1) {
      errors.push({
        round,
        type: '调仓方向错误',
        severity: 'medium',
        description: '调仓后希腊值偏离目标区间更远',
        consequence: '风险非但没有降低反而增加，浪费了交易成本',
        correctAction: '在调仓前应使用估算工具预览调仓对希腊值的影响',
      });
    }

    if (positionChanges.some(pc => 
      pc.changeQuantity > 0 && 
      snapshot.margin.availableMargin < Math.abs(pc.changeQuantity * pc.executionPrice * 100 * 0.15)
    )) {
      errors.push({
        round,
        type: '保证金不足时开仓',
        severity: 'high',
        description: '在保证金紧张的情况下仍增加头寸',
        consequence: '进一步降低保证金安全垫，增加爆仓风险',
        correctAction: '保证金不足时应优先减仓释放保证金，而非增加新头寸',
      });
    }
  }

  if (action.type === 'stopLoss') {
    const totalClosed = action.positionChanges
      .filter(pc => pc.changeQuantity < 0)
      .reduce((sum, pc) => sum + Math.abs(pc.changeQuantity), 0);
    
    if (totalClosed === 0) {
      errors.push({
        round,
        type: '止损执行不彻底',
        severity: 'medium',
        description: '止损操作未实际减少任何风险敞口',
        consequence: '止损流于形式，风险依然存在',
        correctAction: '止损应果断减仓或平仓，至少降低50%的风险敞口',
      });
    }
  }

  return errors;
}

function checkMarginViolations(
  snapshot: MarketSnapshot,
  round: number
): ErrorAnalysis[] {
  const errors: ErrorAnalysis[] = [];
  const { margin } = snapshot;

  if (margin.marginCall) {
    errors.push({
      round,
      type: '保证金追缴',
      severity: 'high',
      description: `保证金比例 = ${margin.marginRatio.toFixed(1)}%，已触发追缴通知`,
      consequence: '需在规定时间内补充保证金，否则将被强制平仓',
      correctAction: '立即减仓释放保证金，或转入额外资金',
    });
  }

  if (margin.availableMargin < 0) {
    errors.push({
      round,
      type: '保证金透支',
      severity: 'critical',
      description: `可用保证金 = ${margin.availableMargin.toFixed(2)}，已出现负值`,
      consequence: '随时可能触发强制平仓',
      correctAction: '必须立即平仓降低风险，避免爆仓',
    });
  }

  return errors;
}

function calculateScores(
  gameState: GameState,
  targets: GreekTarget,
  totalFee: number
): ReviewScores {
  const timeline = gameState.marketHistory;

  const riskManagementScore = calculateRiskManagementScore(timeline, targets);
  const costControlScore = calculateCostControlScore(gameState.actionHistory, gameState.totalPnL, totalFee);
  const decisionTimingScore = calculateDecisionTimingScore(timeline, targets);
  const greekStabilityScore = calculateGreekStabilityScore(timeline, targets);

  const overall = Math.round(
    riskManagementScore * 0.35 +
    costControlScore * 0.2 +
    decisionTimingScore * 0.2 +
    greekStabilityScore * 0.25
  );

  return {
    riskManagement: riskManagementScore,
    costControl: costControlScore,
    decisionTiming: decisionTimingScore,
    greekStability: greekStabilityScore,
    overall,
  };
}

function calculateRiskManagementScore(
  timeline: MarketSnapshot[],
  targets: GreekTarget
): number {
  if (timeline.length === 0) return 0;

  let safeRounds = 0;
  let penalty = 0;

  for (const snapshot of timeline) {
    const deltaSafe = getGreekStatus(snapshot.greeks.delta, targets.delta) === 'safe';
    const gammaSafe = getGreekStatus(snapshot.greeks.gamma, targets.gamma) === 'safe';
    const vegaSafe = getGreekStatus(snapshot.greeks.vega, targets.vega) === 'safe';
    const marginSafe = !snapshot.margin.marginCall && snapshot.margin.availableMargin >= 0;

    if (deltaSafe && gammaSafe && vegaSafe && marginSafe) {
      safeRounds++;
    }

    if (getGreekStatus(snapshot.greeks.gamma, targets.gamma) === 'danger') {
      penalty += 15;
    }
    if (snapshot.margin.marginCall) {
      penalty += 20;
    }
  }

  const baseScore = (safeRounds / timeline.length) * 100;
  return Math.max(0, Math.min(100, Math.round(baseScore - penalty)));
}

function calculateCostControlScore(
  actions: ActionRecord[],
  totalPnL: number,
  totalFee: number
): number {
  if (actions.length === 0) return 100;

  const feeToPnLRatio = totalPnL > 0 ? totalFee / totalPnL : Math.abs(totalFee / (totalPnL - totalFee));

  let score: number;
  if (feeToPnLRatio < 0.05) score = 100;
  else if (feeToPnLRatio < 0.1) score = 85;
  else if (feeToPnLRatio < 0.2) score = 70;
  else if (feeToPnLRatio < 0.3) score = 55;
  else if (feeToPnLRatio < 0.5) score = 40;
  else score = Math.max(0, 40 - (feeToPnLRatio - 0.5) * 100);

  return Math.round(score);
}

function calculateDecisionTimingScore(
  timeline: MarketSnapshot[],
  targets: GreekTarget
): number {
  let score = 100;
  let dangerDuration = 0;

  for (let i = 0; i < timeline.length; i++) {
    const snapshot = timeline[i];
    const hasDanger = 
      getGreekStatus(snapshot.greeks.gamma, targets.gamma) === 'danger' ||
      snapshot.margin.marginCall;

    if (hasDanger) {
      dangerDuration++;
      
      if (snapshot.action?.type === 'hold') {
        score -= 10 * dangerDuration;
      } else if (snapshot.action?.type === 'adjust' || snapshot.action?.type === 'stopLoss') {
        const improvement = calculateGreekImprovement(
          snapshot.action.greeksBefore,
          snapshot.action.greeksAfter,
          targets
        );
        if (improvement > 0.2) {
          score += 5;
          dangerDuration = 0;
        }
      }
    }
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

function calculateGreekStabilityScore(
  timeline: MarketSnapshot[],
  targets: GreekTarget
): number {
  if (timeline.length < 2) return 100;

  let totalDeviation = 0;

  for (const snapshot of timeline) {
    const deltaDeviation = calculateDeviation(snapshot.greeks.delta, targets.delta);
    const gammaDeviation = calculateDeviation(snapshot.greeks.gamma, targets.gamma);
    const vegaDeviation = calculateDeviation(snapshot.greeks.vega, targets.vega);
    
    totalDeviation += deltaDeviation * 0.3 + gammaDeviation * 0.4 + vegaDeviation * 0.3;
  }

  const avgDeviation = totalDeviation / timeline.length;
  const score = Math.max(0, 100 - avgDeviation * 50);

  return Math.round(score);
}

function calculateDeviation(value: number, target: { min: number; max: number }): number {
  if (value >= target.min && value <= target.max) return 0;
  const range = target.max - target.min;
  if (range === 0) return Math.abs(value - target.min);
  const midPoint = (target.min + target.max) / 2;
  return Math.abs((value - midPoint) / (range / 2));
}

function calculateGreekImprovement(
  before: { delta: number; gamma: number; vega: number },
  after: { delta: number; gamma: number; vega: number },
  targets: GreekTarget
): number {
  const scoreBefore = 
    calculateDeviation(before.delta, targets.delta) * 0.3 +
    calculateDeviation(before.gamma, targets.gamma) * 0.4 +
    calculateDeviation(before.vega, targets.vega) * 0.3;
  
  const scoreAfter =
    calculateDeviation(after.delta, targets.delta) * 0.3 +
    calculateDeviation(after.gamma, targets.gamma) * 0.4 +
    calculateDeviation(after.vega, targets.vega) * 0.3;

  return scoreBefore - scoreAfter;
}

export function calculateTotalFees(actions: ActionRecord[]): number {
  return actions.reduce((sum, action) => sum + action.totalCost, 0);
}
