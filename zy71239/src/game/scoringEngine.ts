import { GameEvent, ScoreBreakdown, GameStats } from './types';

export class ScoringEngine {
  private readonly BASE_SCORE = 100;

  calculateAccuracy(events: GameEvent[]): number {
    const missedContraband = events.filter(
      e => e.type === 'pass' && e.needReview && e.scoreChange < 0
    ).length;
    
    const falsePositive = events.filter(
      e => e.type === 'block' && !e.needReview
    ).length;

    return Math.max(0, this.BASE_SCORE - missedContraband * 10 - falsePositive * 5);
  }

  calculateEfficiency(avgWaitTime: number, totalAudience: number): number {
    if (totalAudience === 0) return 100;
    if (avgWaitTime <= 30) return 100;
    return Math.max(0, this.BASE_SCORE - Math.floor((avgWaitTime - 30) / 10) * 5);
  }

  calculateVIPService(vipAvgWaitTime: number, warnings: number): number {
    const waitScore = vipAvgWaitTime <= 15 
      ? 100 
      : Math.max(0, 100 - Math.floor(vipAvgWaitTime * 2));
    return Math.max(0, waitScore - warnings * 10);
  }

  calculateEmergency(events: GameEvent[], stats: GameStats): number {
    const specialEvents = events.filter(e => 
      e.type === 'pass' && e.description.includes('特殊观众')
    );
    
    const correctHandling = specialEvents.filter(e => e.scoreChange > 0).length;
    const total = Math.max(stats.specialHandled, specialEvents.length);
    
    if (total === 0) return 100;
    
    const bonusScore = events.filter(e => e.scoreChange > 0 && e.type !== 'warning')
      .reduce((sum, e) => sum + e.scoreChange, 0);
    
    return Math.min(100, Math.round((correctHandling / total) * 100 + bonusScore));
  }

  calculateBreakdown(events: GameEvent[], stats: GameStats): ScoreBreakdown {
    return {
      accuracy: this.calculateAccuracy(events),
      efficiency: this.calculateEfficiency(stats.avgWaitTime, stats.totalScanned),
      vipService: this.calculateVIPService(stats.vipAvgWaitTime, stats.warnings),
      emergency: this.calculateEmergency(events, stats)
    };
  }

  calculateFinalScore(breakdown: ScoreBreakdown): number {
    return Math.round(
      breakdown.accuracy * 0.4 +
      breakdown.efficiency * 0.25 +
      breakdown.vipService * 0.2 +
      breakdown.emergency * 0.15
    );
  }

  getScoreRating(score: number): { grade: string; color: string; message: string } {
    if (score >= 90) return { grade: 'S', color: 'text-yellow-400', message: '优秀！安检专家！' };
    if (score >= 80) return { grade: 'A', color: 'text-success', message: '良好，继续保持！' };
    if (score >= 70) return { grade: 'B', color: 'text-blue-400', message: '中等，还有提升空间' };
    if (score >= 60) return { grade: 'C', color: 'text-vip', message: '及格，需要加强训练' };
    return { grade: 'D', color: 'text-warning', message: '不合格，建议重新培训' };
  }
}

export const scoringEngine = new ScoringEngine();
