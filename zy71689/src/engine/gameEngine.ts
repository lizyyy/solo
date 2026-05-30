import type {
  Game,
  GameMode,
  Round,
  BondHolding,
  RatingAction,
  Anomaly,
  AnomalyType,
  NewsEvent,
  RatingLevel,
  GameReport,
  AccuracyResult,
} from '@/types';
import { GAME_CONFIG } from '@/data/constants';
import { generateInitialPortfolio } from '@/data/bonds';
import { getRandomNews } from '@/data/news';
import { RatingEngine } from './ratingEngine';
import { AnomalyEngine } from './anomalyEngine';

export class GameEngine {
  static generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  static initializeGame(mode: GameMode): Game {
    const holdings = generateInitialPortfolio();
    const initialNav = RatingEngine.calculatePortfolioNAV(holdings, GAME_CONFIG.INITIAL_CASH);
    const newsSequence = getRandomNews(GAME_CONFIG.TOTAL_ROUNDS);
    const rounds: Round[] = newsSequence.map((news, index) => ({
      id: GameEngine.generateId(),
      roundNumber: index + 1,
      news,
      affectedBondCodes: news.affectedBondCodes,
      anomalies: [],
      roundScore: 0,
      navBefore: initialNav,
      navAfter: initialNav,
      holdingsBefore: JSON.parse(JSON.stringify(holdings)),
      holdingsAfter: JSON.parse(JSON.stringify(holdings)),
      isTimeout: false,
      correctRating: news.expectedRating,
    }));

    const game: Game = {
      id: GameEngine.generateId(),
      mode,
      status: 'playing',
      studentName: mode === 'sample' ? '演示学员' : undefined,
      initialNav,
      currentNav: initialNav,
      cash: GAME_CONFIG.INITIAL_CASH,
      trustScore: GAME_CONFIG.INITIAL_TRUST,
      totalScore: 0,
      totalRounds: GAME_CONFIG.TOTAL_ROUNDS,
      currentRoundIndex: 0,
      holdings,
      rounds,
      selectedBond: null,
      createdAt: new Date().toISOString(),
    };

    return game;
  }

  static get currentRound(): Round | null {
    return null;
  }

  static getCurrentRound(game: Game): Round | null {
    if (game.currentRoundIndex >= 0 && game.currentRoundIndex < game.rounds.length) {
      return game.rounds[game.currentRoundIndex];
    }
    return null;
  }

  static submitRating(
    game: Game,
    action: RatingAction
  ): { game: Game; roundScore: number; anomalies: Anomaly[] } | null {
    const round = GameEngine.getCurrentRound(game);
    if (!round || round.action) return null;

    const updatedGame = JSON.parse(JSON.stringify(game)) as Game;
    const updatedRound = updatedGame.rounds[updatedGame.currentRoundIndex];

    const holding = updatedGame.holdings.find(h => h.bondCode === action.bondCode);
    if (!holding) return null;

    const previousActions: RatingAction[] = updatedGame.rounds
      .filter(r => r.action)
      .map(r => r.action!);

    const anomalies = AnomalyEngine.detectAnomalies(
      action,
      updatedGame,
      round.news!,
      previousActions
    );

    const oldRating = holding.currentRating;
    const newRating = action.newRating;
    const expectedRating = round.news!.expectedRating;
    const newsDirection = round.news!.direction;

    const accuracyResult = RatingEngine.evaluateRatingAccuracy(
      oldRating,
      newRating,
      expectedRating,
      newsDirection
    );

    const navImpact = RatingEngine.calculateNavImpact(holding, newRating);
    const timeSpent = action.timeSpent;
    const hasAnomaly = anomalies.length > 0;
    const isTimeout = round.isTimeout;

    const scoreResult = RatingEngine.calculateScore(
      accuracyResult,
      timeSpent,
      GAME_CONFIG.standardTimeLimit,
      hasAnomaly,
      isTimeout
    );

    holding.previousRating = oldRating;
    holding.currentRating = newRating;
    holding.riskWeight = RatingEngine.getRiskWeight(newRating);
    holding.adjustedValue = RatingEngine.calculateHoldingAdjustedValue(holding);

    updatedRound.action = action;
    updatedRound.anomalies = anomalies;
    updatedRound.roundScore = scoreResult.score;
    updatedRound.correctRating = expectedRating;
    updatedRound.holdingsAfter = JSON.parse(JSON.stringify(updatedGame.holdings));
    updatedRound.navAfter = RatingEngine.calculatePortfolioNAV(updatedGame.holdings, updatedGame.cash);
    updatedRound.feedback = GameEngine.generateFeedback(accuracyResult, anomalies);

    updatedGame.currentNav = updatedRound.navAfter;
    updatedGame.totalScore += scoreResult.score;
    updatedGame.trustScore = Math.max(
      0,
      Math.min(100, updatedGame.trustScore + RatingEngine.calculateTrustChange(accuracyResult.isCorrect, hasAnomaly, isTimeout))
    );

    return {
      game: updatedGame,
      roundScore: scoreResult.score,
      anomalies,
    };
  }

  static handleTimeout(game: Game): { game: Game; anomalies: Anomaly[] } {
    const updatedGame = JSON.parse(JSON.stringify(game)) as Game;
    const updatedRound = updatedGame.rounds[updatedGame.currentRoundIndex];

    updatedRound.isTimeout = true;
    updatedRound.roundScore = GAME_CONFIG.SCORING.timeoutPenalty;
    updatedRound.feedback = '⏰ 超时未操作，未能及时调整评级。建议提高决策速度，在时间压力下保持冷静分析。';

    const timeoutAnomaly: Anomaly = {
      id: GameEngine.generateId(),
      type: 'RULE_ISSUE',
      severity: 'high',
      description: '评级调整超时',
      rootCause: '未能在规定时间内完成评级决策，导致客户信任度下降',
      suggestion: '建议加强时间管理训练，先快速判断方向，再细化评级档位',
      timestamp: new Date().toISOString(),
    };

    updatedRound.anomalies = [timeoutAnomaly];

    updatedGame.totalScore += GAME_CONFIG.SCORING.timeoutPenalty;
    updatedGame.trustScore = Math.max(0, updatedGame.trustScore - 10);

    return {
      game: updatedGame,
      anomalies: [timeoutAnomaly],
    };
  }

  static nextRound(game: Game): Game {
    const updatedGame = JSON.parse(JSON.stringify(game)) as Game;

    if (updatedGame.currentRoundIndex < updatedGame.rounds.length - 1) {
      updatedGame.currentRoundIndex++;
      const nextRound = updatedGame.rounds[updatedGame.currentRoundIndex];
      nextRound.navBefore = updatedGame.currentNav;
      nextRound.holdingsBefore = JSON.parse(JSON.stringify(updatedGame.holdings));
      nextRound.holdingsAfter = JSON.parse(JSON.stringify(updatedGame.holdings));
      nextRound.navAfter = updatedGame.currentNav;
    }

    return updatedGame;
  }

  static finishGame(game: Game): Game {
    const updatedGame = JSON.parse(JSON.stringify(game)) as Game;
    updatedGame.status = 'finished';
    updatedGame.finishedAt = new Date().toISOString();
    return updatedGame;
  }

  static generateReport(game: Game): GameReport {
    const actions = game.rounds.filter(r => r.action).map(r => r.action!);
    const totalActions = actions.length;
    const correctActions = game.rounds.filter(r => r.roundScore > 0).length;
    const accuracyRate = totalActions > 0 ? (correctActions / game.totalRounds) * 100 : 0;
    const avgReactionTime = totalActions > 0
      ? actions.reduce((sum, a) => sum + a.timeSpent, 0) / totalActions
      : 0;

    const navChangePercent = ((game.currentNav - game.initialNav) / game.initialNav) * 100;

    const ratingDistribution = game.holdings.reduce(
      (acc, h) => {
        acc[h.currentRating] = (acc[h.currentRating] || 0) + 1;
        return acc;
      },
      {} as Record<RatingLevel, number>
    );

    const allAnomalies = game.rounds.flatMap(r => r.anomalies || []);
    const anomalies = allAnomalies.reduce(
      (acc, a) => {
        acc[a.type] = (acc[a.type] || 0) + 1;
        return acc;
      },
      { DATA_ISSUE: 0, RULE_ISSUE: 0, MATERIAL_ISSUE: 0 } as Record<AnomalyType, number>
    );

    const actionTimeline = actions.map((action, index) => {
      const round = game.rounds[index];
      return {
        ...action,
        reactionTime: action.timeSpent,
        isCorrect: round ? round.roundScore > 0 : false,
        scoreImpact: round ? round.roundScore : 0,
        hasAnomaly: round ? round.anomalies.length > 0 : false,
        timestamp: action.submittedAt,
      };
    });

    const suggestions = GameEngine.generateSuggestions(game, accuracyRate, avgReactionTime);

    return {
      id: GameEngine.generateId(),
      gameId: game.id,
      finalScore: game.totalScore,
      finalNav: game.currentNav,
      navChangePercent,
      accuracyRate,
      avgReactionTime,
      totalActions,
      correctActions,
      suggestions,
      ratingDistribution,
      generatedAt: new Date().toISOString(),
      anomalies,
      actionTimeline,
      anomalyDetails: allAnomalies,
    };
  }

  private static generateFeedback(
    accuracyResult: AccuracyResult,
    anomalies: Anomaly[]
  ): string {
    if (accuracyResult.accuracy === 'correct') {
      if (accuracyResult.levelMatch) {
        return '🎉 完美！评级方向和档位都完全正确。继续保持这种精准的判断力！';
      }
      return '✅ 评级方向正确！虽然档位略有偏差，但整体判断准确。可以进一步细化分析以提高精确度。';
    }

    if (accuracyResult.accuracy === 'near_miss') {
      return '⚠️ 评级方向正确，但档位偏差较大。建议仔细分析新闻的影响程度，选择更合适的评级档位。';
    }

    if (anomalies.length > 0) {
      const dataIssues = anomalies.filter(a => a.type === 'DATA_ISSUE');
      const ruleIssues = anomalies.filter(a => a.type === 'RULE_ISSUE');
      const materialIssues = anomalies.filter(a => a.type === 'MATERIAL_ISSUE');

      const issues: string[] = [];
      if (dataIssues.length > 0) issues.push('评级调整幅度过大');
      if (ruleIssues.length > 0) issues.push('评级方向与新闻影响矛盾');
      if (materialIssues.length > 0) issues.push('调整理由不充分');

      return `❌ 评级判断存在问题：${issues.join('、')}。请重新分析新闻对债券信用风险的影响。`;
    }

    return '❌ 评级方向与新闻影响方向相反。请仔细分析新闻内容，判断其对债券信用风险的实际影响。';
  }

  private static generateSuggestions(
    game: Game,
    accuracyRate: number,
    avgReactionTime: number
  ): string[] {
    const suggestions: string[] = [];
    const allAnomalies = game.rounds.flatMap(r => r.anomalies);

    if (accuracyRate < 60) {
      suggestions.push('评级准确率较低，建议加强债券信用分析基础知识的学习，熟悉各评级档位的核心区别。');
    }

    if (avgReactionTime > 45) {
      suggestions.push('决策速度偏慢，建议多进行限时练习，提高快速阅读和信息提取能力。');
    }

    const dataIssues = allAnomalies.filter(a => a.type === 'DATA_ISSUE');
    if (dataIssues.length > 0) {
      suggestions.push(`存在${dataIssues.length}次数据质量问题，请注意评级调整的渐进性原则，避免单次调整超过2个档位。`);
    }

    const ruleIssues = allAnomalies.filter(a => a.type === 'RULE_ISSUE');
    if (ruleIssues.length > 0) {
      suggestions.push(`存在${ruleIssues.length}次规则违反问题，请确保评级调整方向与新闻影响方向保持一致。`);
    }

    const materialIssues = allAnomalies.filter(a => a.type === 'MATERIAL_ISSUE');
    if (materialIssues.length > 0) {
      suggestions.push(`存在${materialIssues.length}次材料完整性问题，请务必填写评级调整理由，这是重要的工作留痕和专业体现。`);
    }

    const timeoutRounds = game.rounds.filter(r => r.isTimeout);
    if (timeoutRounds.length > 0) {
      suggestions.push(`有${timeoutRounds.length}回合超时未操作，建议提升时间管理能力，可以先快速判断方向再细化分析。`);
    }

    if (suggestions.length === 0) {
      suggestions.push('表现优秀！评级判断准确，操作规范，建议尝试更高难度的挑战以进一步提升能力。');
    }

    return suggestions;
  }

  static saveToStorage(game: Game): void {
    const saveData = {
      game,
      savedAt: Date.now(),
    };
    localStorage.setItem(`bond-rating-game-${game.id}`, JSON.stringify(saveData));
  }

  static loadFromStorage(gameId: string): Game | null {
    const savedData = localStorage.getItem(`bond-rating-game-${gameId}`);
    if (!savedData) return null;

    try {
      const data = JSON.parse(savedData);
      return data.game as Game;
    } catch {
      return null;
    }
  }

  static getSavedGames(): { gameId: string; game: Game; savedAt: number }[] {
    const result: { gameId: string; game: Game; savedAt: number }[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('bond-rating-game-')) {
        const gameId = key.replace('bond-rating-game-', '');
        const savedData = localStorage.getItem(key);
        if (savedData) {
          try {
            const data = JSON.parse(savedData);
            result.push({
              gameId,
              game: data.game as Game,
              savedAt: data.savedAt,
            });
          } catch {
            // skip invalid data
          }
        }
      }
    }

    return result.sort((a, b) => b.savedAt - a.savedAt);
  }

  static deleteFromStorage(gameId: string): void {
    localStorage.removeItem(`bond-rating-game-${gameId}`);
  }
}

export const gameEngine = new GameEngine();
