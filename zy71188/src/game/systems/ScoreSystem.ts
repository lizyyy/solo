import type { Hazard, ScoreBreakdown, ScoreRule, MarkRecord } from '../types';
import { SCORE_RULES } from '../data/levels';

export class ScoreSystem {
  private rules: ScoreRule;

  constructor() {
    this.rules = SCORE_RULES;
  }

  calculateFinalScore(
    hazards: Hazard[],
    markedRecords: MarkRecord[],
    timeRemaining: number,
    totalTime: number
  ): ScoreBreakdown {
    const correctMarks = hazards.filter(h => h.marked && h.markCorrect).length * this.rules.correctMark;
    const wrongMarks = hazards.filter(h => h.marked && !h.markCorrect).length * this.rules.wrongMark;
    const duplicateMarks = markedRecords.filter(r => r.isDuplicate).length * this.rules.duplicateMark;
    const missedHazards = hazards.filter(h => h.isHazard && !h.marked).length * this.rules.missedHazard;
    
    const overtimeSeconds = Math.max(0, -timeRemaining);
    const overtimePenalty = overtimeSeconds > 0 ? overtimeSeconds * this.rules.overtimePerSecond : 0;
    
    const timeBonus = Math.max(0, timeRemaining) * this.rules.timeBonusPerSecond;
    
    const wastefulActions = markedRecords.filter(r => r.isDuplicate).length;
    const resourceWaste = wastefulActions * this.rules.resourceWaste;

    const totalScore = this.rules.baseScore 
      + correctMarks 
      + wrongMarks 
      + duplicateMarks
      + overtimePenalty
      + timeBonus 
      + missedHazards
      + resourceWaste;

    return {
      baseScore: this.rules.baseScore,
      correctMarks,
      wrongMarks,
      duplicateMarks,
      overtimePenalty,
      timeBonus,
      missedHazards,
      resourceWaste,
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

  getFailReasons(
    scoreBreakdown: ScoreBreakdown,
    hazards: Hazard[],
    timeRemaining: number
  ): string[] {
    const reasons: string[] = [];
    const missedCount = hazards.filter(h => h.isHazard && !h.marked).length;
    const wrongCount = hazards.filter(h => h.marked && !h.markCorrect).length;
    const duplicateCount = Math.abs(scoreBreakdown.duplicateMarks / this.rules.duplicateMark);
    
    if (missedCount > 0) {
      reasons.push(`未发现 ${missedCount} 个消防隐患，每个扣 ${Math.abs(this.rules.missedHazard)} 分`);
    }
    if (wrongCount > 0) {
      reasons.push(`错误标记 ${wrongCount} 次，每次扣 ${Math.abs(this.rules.wrongMark)} 分`);
    }
    if (duplicateCount > 0) {
      reasons.push(`重复标记 ${duplicateCount} 次，每次扣 ${Math.abs(this.rules.duplicateMark)} 分`);
    }
    if (timeRemaining < 0) {
      const overtime = Math.abs(timeRemaining);
      reasons.push(`超时 ${overtime.toFixed(1)} 秒，每秒扣 ${Math.abs(this.rules.overtimePerSecond)} 分`);
    }
    if (scoreBreakdown.resourceWaste < 0) {
      reasons.push(`资源浪费扣分 ${Math.abs(scoreBreakdown.resourceWaste)} 分`);
    }
    if (scoreBreakdown.totalScore < 600) {
      reasons.push('总分低于及格线（600分）');
    }
    
    return reasons;
  }

  getScoreRules(): ScoreRule {
    return { ...this.rules };
  }

  getScoreExplanation(): Array<{ label: string; value: number; description: string }> {
    return [
      { label: '基础分', value: this.rules.baseScore, description: '参与游戏的基础分数' },
      { label: '正确标记', value: this.rules.correctMark, description: '每发现一个真实隐患获得的分数' },
      { label: '错误标记', value: this.rules.wrongMark, description: '标记正常设施为隐患时扣除的分数' },
      { label: '重复标记', value: this.rules.duplicateMark, description: '对同一目标重复标记扣除的分数' },
      { label: '超时扣分', value: this.rules.overtimePerSecond, description: '超出时间限制每秒扣除的分数' },
      { label: '未发现扣分', value: this.rules.missedHazard, description: '未发现的隐患将扣除的分数' },
      { label: '资源浪费', value: this.rules.resourceWaste, description: '无效操作扣除的分数' },
      { label: '时间奖励', value: this.rules.timeBonusPerSecond, description: '每剩余1秒获得的奖励分数' }
    ];
  }
}
