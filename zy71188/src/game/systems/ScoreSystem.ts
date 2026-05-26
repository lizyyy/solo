import type { Hazard, ScoreBreakdown, ScoreRule, MarkRecord } from '../types';
import { SCORE_RULES } from '../data/levels';

export class ScoreSystem {
  private rules: ScoreRule;

  constructor() {
    this.rules = SCORE_RULES;
  }

  calculateFinalScore(
    hazards: Hazard[],
    timeRemaining: number,
    totalTime: number
  ): ScoreBreakdown {
    const correctMarks = hazards.filter(h => h.marked && h.markCorrect).length * this.rules.correctMark;
    const wrongMarks = hazards.filter(h => h.marked && !h.markCorrect).length * this.rules.wrongMark;
    const missedHazards = hazards.filter(h => h.isHazard && !h.marked).length * this.rules.missedHazard;
    const timeBonus = Math.max(0, timeRemaining) * this.rules.timeBonusPerSecond;

    const totalScore = this.rules.baseScore + correctMarks + wrongMarks + missedHazards + timeBonus;

    return {
      baseScore: this.rules.baseScore,
      correctMarks,
      wrongMarks,
      timeBonus,
      missedHazards,
      totalScore: Math.max(0, totalScore)
    };
  }

  getGrade(score: number): 'S' | 'A' | 'B' | 'C' | 'D' | 'F' {
    if (score >= 1800) return 'S';
    if (score >= 1500) return 'A';
    if (score >= 1200) return 'B';
    if (score >= 900) return 'C';
    if (score >= 600) return 'D';
    return 'F';
  }

  getScoreRules(): ScoreRule {
    return { ...this.rules };
  }

  getScoreExplanation(): { label: string; value: number; description: string }[] {
    return [
      { label: '基础分', value: this.rules.baseScore, description: '参与游戏的基础分数' },
      { label: '正确标记', value: this.rules.correctMark, description: '每发现一个真实隐患获得的分数' },
      { label: '错误标记', value: this.rules.wrongMark, description: '标记正常设施为隐患时扣除的分数' },
      { label: '超时扣分', value: -this.rules.missedHazard, description: '未发现的隐患将扣除的分数' },
      { label: '时间奖励', value: this.rules.timeBonusPerSecond, description: '每剩余1秒获得的奖励分数' }
    ];
  }
}
