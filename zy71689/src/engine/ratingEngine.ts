import type {
  BondHolding,
  RatingLevel,
  NewsEvent,
  AccuracyResult,
  NewsDirection,
} from '@/types';
import { RATING_LEVELS, GAME_CONFIG } from '@/data/constants';

export class RatingEngine {
  static getRiskWeight(rating: RatingLevel): number {
    const level = RATING_LEVELS.find(r => r.level === rating);
    return level?.riskWeight || 0.5;
  }

  static getRatingScore(rating: RatingLevel): number {
    const level = RATING_LEVELS.find(r => r.level === rating);
    return level?.score || 4;
  }

  static getRatingDelta(oldRating: RatingLevel, newRating: RatingLevel): number {
    return RatingEngine.getRatingScore(newRating) - RatingEngine.getRatingScore(oldRating);
  }

  static getRatingComparison(oldRating: RatingLevel, newRating: RatingLevel): 'upgrade' | 'downgrade' | 'unchanged' {
    const delta = RatingEngine.getRatingDelta(oldRating, newRating);
    if (delta > 0) return 'upgrade';
    if (delta < 0) return 'downgrade';
    return 'unchanged';
  }

  static calculateHoldingAdjustedValue(holding: BondHolding): number {
    return (holding.marketValue * holding.position * holding.riskWeight) / 100;
  }

  static calculatePortfolioNAV(holdings: BondHolding[], cash: number): number {
    const holdingsValue = holdings.reduce((sum, holding) => {
      return sum + holding.adjustedValue;
    }, 0);
    return holdingsValue + cash;
  }

  static recalculateHoldingAdjustedValue(holding: BondHolding): BondHolding {
    const riskWeight = RatingEngine.getRiskWeight(holding.currentRating);
    const adjustedValue = (holding.marketValue * holding.position * riskWeight) / 100;
    return {
      ...holding,
      riskWeight,
      adjustedValue,
    };
  }

  static evaluateRatingAccuracy(
    oldRating: RatingLevel,
    newRating: RatingLevel,
    expectedRating: RatingLevel,
    newsDirection: NewsDirection
  ): AccuracyResult {
    const actualDelta = RatingEngine.getRatingDelta(oldRating, newRating);
    const expectedDelta = RatingEngine.getRatingDelta(oldRating, expectedRating);

    const actualDirection = actualDelta > 0 ? 'upgrade' : actualDelta < 0 ? 'downgrade' : 'neutral';
    const directionMatch = newsDirection === 'neutral' 
      ? actualDirection === 'neutral'
      : actualDirection === newsDirection;

    const levelMatch = newRating === expectedRating;

    if (levelMatch) {
      return {
        isCorrect: true,
        accuracy: 'correct',
        directionMatch,
        levelMatch: true,
      };
    }

    if (directionMatch) {
      const levelDiff = Math.abs(actualDelta - expectedDelta);
      if (levelDiff <= 1) {
        return {
          isCorrect: true,
          accuracy: 'correct',
          directionMatch: true,
          levelMatch: false,
        };
      } else {
        return {
          isCorrect: true,
          accuracy: 'near_miss',
          directionMatch: true,
          levelMatch: false,
        };
      }
    }

    return {
      isCorrect: false,
      accuracy: 'wrong_direction',
      directionMatch: false,
      levelMatch: false,
    };
  }

  static calculateScore(
    accuracy: AccuracyResult,
    reactionTime: number,
    timeLimit: number,
    hasAnomaly: boolean,
    isTimeout: boolean
  ): { score: number; scoreBreakdown: Record<string, number> } {
    const breakdown: Record<string, number> = {};
    let totalScore = 0;

    if (isTimeout) {
      breakdown.timeoutPenalty = GAME_CONFIG.SCORING.timeoutPenalty;
      totalScore += GAME_CONFIG.SCORING.timeoutPenalty;
      return { score: totalScore, scoreBreakdown: breakdown };
    }

    if (accuracy.levelMatch) {
      breakdown.perfectMatch = GAME_CONFIG.SCORING.perfectMatch;
      totalScore += GAME_CONFIG.SCORING.perfectMatch;
    }

    if (accuracy.directionMatch && accuracy.accuracy === 'correct') {
      breakdown.directionCorrect = GAME_CONFIG.SCORING.directionCorrect;
      totalScore += GAME_CONFIG.SCORING.directionCorrect;
    } else if (accuracy.accuracy === 'near_miss') {
      breakdown.nearMiss = GAME_CONFIG.SCORING.nearMiss;
      totalScore += GAME_CONFIG.SCORING.nearMiss;
    } else if (accuracy.accuracy === 'wrong_direction') {
      breakdown.wrongDirection = GAME_CONFIG.SCORING.wrongDirection;
      totalScore += GAME_CONFIG.SCORING.wrongDirection;
    }

    const timeRatio = reactionTime / timeLimit;
    if (timeRatio < GAME_CONFIG.SCORING.speedBonusThreshold) {
      breakdown.speedBonus = GAME_CONFIG.SCORING.speedBonus;
      totalScore += GAME_CONFIG.SCORING.speedBonus;
    }

    if (hasAnomaly) {
      breakdown.anomalyPenalty = GAME_CONFIG.SCORING.anomalyPenalty;
      totalScore += GAME_CONFIG.SCORING.anomalyPenalty;
    }

    return { score: totalScore, scoreBreakdown: breakdown };
  }

  static calculateTrustChange(
    isCorrect: boolean,
    hasAnomaly: boolean,
    isTimeout: boolean
  ): number {
    let change = 0;

    if (isTimeout) {
      return GAME_CONFIG.TRUST.timeoutPenalty;
    }

    if (isCorrect) {
      change += GAME_CONFIG.TRUST.correctBonus;
    } else {
      change += GAME_CONFIG.TRUST.wrongPenalty;
    }

    if (hasAnomaly) {
      change += GAME_CONFIG.TRUST.anomalyPenalty;
    }

    return change;
  }

  static calculateNavImpact(
    holding: BondHolding,
    newRating: RatingLevel
  ): number {
    const oldRiskWeight = holding.riskWeight;
    const newRiskWeight = RatingEngine.getRiskWeight(newRating);

    const oldAdjusted = (holding.marketValue * holding.position * oldRiskWeight) / 100;
    const newAdjusted = (holding.marketValue * holding.position * newRiskWeight) / 100;

    return newAdjusted - oldAdjusted;
  }

  static validateRatingChange(
    oldRating: RatingLevel,
    newRating: RatingLevel,
    news: NewsEvent
  ): { valid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    const delta = RatingEngine.getRatingDelta(oldRating, newRating);
    const absDelta = Math.abs(delta);

    if (absDelta > GAME_CONFIG.RATING_REGRESSION_THRESHOLD) {
      errors.push(`评级调整幅度过大：${oldRating} → ${newRating}，跨越${absDelta}个档位`);
    }

    const actualDirection = delta > 0 ? 'upgrade' : delta < 0 ? 'downgrade' : 'neutral';
    if (news.direction !== 'neutral' && actualDirection !== 'neutral' && news.direction !== actualDirection) {
      warnings.push(`评级调整方向与新闻影响方向相反：${news.direction === 'upgrade' ? '利好' : '利空'}消息但${actualDirection === 'upgrade' ? '上调' : '下调'}评级`);
    }

    if (oldRating === 'AAA' && delta > 0) {
      warnings.push('AAA已是最高评级，无法进一步上调');
    }

    if (oldRating === 'CCC' && delta < 0) {
      warnings.push('CCC已是最低评级，无法进一步下调');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
}
