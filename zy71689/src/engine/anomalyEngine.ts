import type {
  RatingAction,
  Game,
  NewsEvent,
  Anomaly,
  AnomalyType,
  AnomalySeverity,
  RatingLevel,
} from '@/types';
import { ANOMALY_TYPES, GAME_CONFIG, getRatingDelta } from '@/data/constants';

export class AnomalyEngine {
  static detectAnomalies(
    action: RatingAction,
    gameState: Game,
    news: NewsEvent,
    previousActions: RatingAction[]
  ): Anomaly[] {
    const anomalies: Omit<Anomaly, 'id' | 'timestamp'>[] = [];

    const dataAnomalies = this.checkDataIssues(action, gameState);
    anomalies.push(...dataAnomalies);

    const ruleAnomalies = this.checkRuleConflicts(action, previousActions, news);
    anomalies.push(...ruleAnomalies);

    const materialAnomalies = this.checkMaterialCompleteness(action);
    anomalies.push(...materialAnomalies);

    return anomalies.map((anomaly, index) => ({
      ...anomaly,
      id: `anomaly-${action.id}-${index}`,
      timestamp: new Date().toISOString(),
    }));
  }

  static checkDataIssues(action: RatingAction, gameState: Game): Omit<Anomaly, 'id' | 'timestamp'>[] {
    const issues: Omit<Anomaly, 'id' | 'timestamp'>[] = [];

    if (this.checkRatingRegression(action.oldRating, action.newRating)) {
      const delta = Math.abs(getRatingDelta(action.oldRating, action.newRating));
      issues.push({
        type: 'DATA_ISSUE',
        severity: delta > 4 ? 'high' : 'medium',
        description: `评级大幅倒退：${action.oldRating} → ${action.newRating}，跨越${delta}个档位`,
        rootCause: '评级调整过于激进，不符合评级调整的渐进性原则',
        suggestion: '单次评级调整不宜超过2个档位，重大变化应分阶段调整',
      });
    }

    const expectedNav = this.calculateExpectedNav(action, gameState);
    const navDiff = Math.abs(expectedNav - gameState.currentNav);
    if (navDiff > gameState.initialNav * 0.01) {
      issues.push({
        type: 'DATA_ISSUE',
        severity: 'medium',
        description: `净值计算不一致：预期${expectedNav.toFixed(2)}，实际${gameState.currentNav.toFixed(2)}`,
        rootCause: '可能存在计算逻辑错误或数据同步问题',
        suggestion: '请检查评级调整后的风险权重和调整后市值计算是否正确',
      });
    }

    return issues;
  }

  static checkRuleConflicts(
    action: RatingAction,
    previousActions: RatingAction[],
    news: NewsEvent
  ): Omit<Anomaly, 'id' | 'timestamp'>[] {
    const issues: Omit<Anomaly, 'id' | 'timestamp'>[] = [];

    if (this.checkDuplicateRating(action, previousActions)) {
      issues.push({
        type: 'RULE_ISSUE',
        severity: 'low',
        description: `同一新闻下重复调整${action.bondCode}评级`,
        rootCause: '在同一新闻事件中对同一债券进行了多次评级调整',
        suggestion: '每条新闻对每只债券只需进行一次评级调整',
      });
    }

    if (this.checkDirectionConflict(action, news)) {
      const delta = getRatingDelta(action.oldRating, action.newRating);
      issues.push({
        type: 'RULE_ISSUE',
        severity: 'high',
        description: `评级调整与新闻方向矛盾：${news.direction === 'upgrade' ? '利好' : '利空'}消息但${delta > 0 ? '上调' : '下调'}评级`,
        rootCause: '评级调整方向与新闻影响方向完全相反，违反基本逻辑',
        suggestion: '评级调整方向应与新闻影响方向一致，负面新闻应下调或维持评级',
      });
    }

    return issues;
  }

  static checkMaterialCompleteness(action: RatingAction): Omit<Anomaly, 'id' | 'timestamp'>[] {
    const issues: Omit<Anomaly, 'id' | 'timestamp'>[] = [];

    if (!action.reason || action.reason.trim().length < GAME_CONFIG.MIN_REASON_LENGTH) {
      issues.push({
        type: 'MATERIAL_ISSUE',
        severity: 'low',
        description: '评级调整理由为空或过于简短',
        rootCause: '操作时未填写调整理由，缺少必要的评级依据',
        suggestion: '每次评级调整都应填写充分的理由，包括分析逻辑和参考依据',
      });
    }

    return issues;
  }

  static checkRatingRegression(oldRating: RatingLevel, newRating: RatingLevel): boolean {
    const delta = Math.abs(getRatingDelta(oldRating, newRating));
    return delta > GAME_CONFIG.RATING_REGRESSION_THRESHOLD;
  }

  static checkDuplicateRating(action: RatingAction, previousActions: RatingAction[]): boolean {
    return previousActions.some(
      (a) =>
        a.bondCode === action.bondCode &&
        a.id !== action.id
    );
  }

  static checkDirectionConflict(action: RatingAction, news: NewsEvent): boolean {
    const delta = getRatingDelta(action.oldRating, action.newRating);

    if (news.direction === 'upgrade' && delta < 0) {
      return true;
    }
    if (news.direction === 'downgrade' && delta > 0) {
      return true;
    }
    return false;
  }

  static classifyAnomaly(anomaly: Anomaly): AnomalyType {
    return anomaly.type;
  }

  static getAnomalyConfig(type: AnomalyType) {
    return ANOMALY_TYPES[type];
  }

  static getAnomalySeverityColor(severity: AnomalySeverity): string {
    switch (severity) {
      case 'high':
        return '#D62828';
      case 'medium':
        return '#F77F00';
      case 'low':
        return '#FCBF49';
      default:
        return '#999999';
    }
  }

  static getAnomalySeverityLabel(severity: AnomalySeverity): string {
    switch (severity) {
      case 'high':
        return '严重';
      case 'medium':
        return '中等';
      case 'low':
        return '轻微';
      default:
        return '未知';
    }
  }

  static generateFixSuggestion(anomaly: Anomaly): string {
    return anomaly.suggestion || '请参考相关评级规则进行修正';
  }

  static diagnoseRootCause(anomaly: Anomaly): {
    category: string;
    possibleCauses: string[];
    preventionTips: string[];
  } {
    const baseResult = {
      category: '',
      possibleCauses: [] as string[],
      preventionTips: [] as string[],
    };

    switch (anomaly.type) {
      case 'DATA_ISSUE':
        return {
          category: '数据质量问题',
          possibleCauses: [
            '评级调整幅度过大，未遵循渐进原则',
            '数据录入错误或计算逻辑有误',
            '未考虑历史评级的连续性',
          ],
          preventionTips: [
            '建立评级调整档位限制机制',
            '加强数据录入后的校验环节',
            '定期复核计算逻辑的正确性',
          ],
        };

      case 'RULE_ISSUE':
        return {
          category: '业务规则违反',
          possibleCauses: [
            '对新闻影响方向判断错误',
            '未理解评级调整的基本原则',
            '操作失误或对系统不熟悉',
          ],
          preventionTips: [
            '加强债券信用分析培训',
            '建立评级调整前的逻辑校验',
            '增加操作确认环节',
          ],
        };

      case 'MATERIAL_ISSUE':
        return {
          category: '材料完整性问题',
          possibleCauses: [
            '时间紧迫导致忽略填写理由',
            '未意识到评级理由的重要性',
            '系统未做必填项校验',
          ],
          preventionTips: [
            '将评级理由设为必填项',
            '提供评级理由模板供参考',
            '加强工作留痕意识培训',
          ],
        };

      default:
        return baseResult;
    }
  }

  static summarizeAnomalies(anomalies: Anomaly[]): {
    total: number;
    byType: Record<AnomalyType, number>;
    bySeverity: Record<AnomalySeverity, number>;
    mostCommon: string[];
  } {
    const result = {
      total: anomalies.length,
      byType: {
        DATA_ISSUE: 0,
        RULE_ISSUE: 0,
        MATERIAL_ISSUE: 0,
      } as Record<AnomalyType, number>,
      bySeverity: {
        low: 0,
        medium: 0,
        high: 0,
      } as Record<AnomalySeverity, number>,
      mostCommon: [] as string[],
    };

    const descriptionCount: Record<string, number> = {};

    anomalies.forEach((anomaly) => {
      result.byType[anomaly.type]++;
      result.bySeverity[anomaly.severity]++;
      descriptionCount[anomaly.description] = (descriptionCount[anomaly.description] || 0) + 1;
    });

    result.mostCommon = Object.entries(descriptionCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([desc]) => desc);

    return result;
  }

  private static calculateExpectedNav(action: RatingAction, gameState: Game): number {
    const navChangePerAction = action.navImpact;
    return gameState.currentNav + navChangePerAction;
  }
}
