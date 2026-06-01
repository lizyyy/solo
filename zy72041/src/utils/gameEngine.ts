import type { GameState, PlayerChoice, Level, Round, Choice, ImportedData } from '@/types';
import { getLevelById, getDefaultLevel } from '@/data/levels';

export const generateGameId = (): string => {
  return `game-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

export class GameEngine {
  static startGame(levelId: string, importData?: ImportedData): GameState {
    let level = getLevelById(levelId);
    if (!level) {
      level = getDefaultLevel();
    }

    const initialState: GameState = {
      gameId: generateGameId(),
      levelId: level.id,
      status: 'playing',
      currentRound: 1,
      totalRounds: level.totalRounds,
      score: 0,
      maxScore: level.totalScore,
      playerChoices: [],
      startTime: Date.now(),
      totalPauseTime: 0,
      historyGameIds: [],
      importData,
    };

    return initialState;
  }

  static pauseGame(state: GameState): GameState {
    if (state.status !== 'playing') {
      return state;
    }
    return {
      ...state,
      status: 'paused',
      pausedAt: Date.now(),
    };
  }

  static resumeGame(state: GameState): GameState {
    if (state.status !== 'paused') {
      return state;
    }
    const now = Date.now();
    const pauseDuration = state.pausedAt ? now - state.pausedAt : 0;
    return {
      ...state,
      status: 'playing',
      pausedAt: undefined,
      resumedAt: now,
      totalPauseTime: state.totalPauseTime + pauseDuration,
    };
  }

  static restartGame(state: GameState): GameState {
    const level = getLevelById(state.levelId) || getDefaultLevel();
    const newGameId = generateGameId();
    
    return {
      gameId: newGameId,
      levelId: state.levelId,
      status: 'playing',
      currentRound: 1,
      totalRounds: level.totalRounds,
      score: 0,
      maxScore: level.totalScore,
      playerChoices: [],
      startTime: Date.now(),
      totalPauseTime: 0,
      historyGameIds: [...state.historyGameIds, state.gameId],
      importData: state.importData,
      conflicts: state.conflicts,
    };
  }

  static makeChoice(state: GameState, choiceId: string, level: Level): GameState {
    if (state.status !== 'playing') {
      return state;
    }

    const currentRound = level.rounds[state.currentRound - 1];
    if (!currentRound) {
      return {
        ...state,
        status: 'error',
        errorMessage: `回合${state.currentRound}不存在`,
      };
    }

    const choice = currentRound.choices.find(c => c.id === choiceId);
    if (!choice) {
      return {
        ...state,
        status: 'error',
        errorMessage: `选项${choiceId}不存在`,
      };
    }

    const playerChoice: PlayerChoice = {
      roundId: state.currentRound,
      choiceId,
      isCorrect: choice.isCorrect,
      score: choice.score,
      timestamp: Date.now(),
      reason: choice.reasonReference,
      deductionReasonId: this.getDeductionReasonId(currentRound, choice),
    };

    const newScore = state.score + choice.score;
    const newChoices = [...state.playerChoices, playerChoice];
    const nextRound = state.currentRound + 1;

    if (nextRound > state.totalRounds) {
      return {
        ...state,
        status: 'completed',
        score: newScore,
        playerChoices: newChoices,
        endTime: Date.now(),
      };
    }

    return {
      ...state,
      currentRound: nextRound,
      score: newScore,
      playerChoices: newChoices,
    };
  }

  private static getDeductionReasonId(round: Round, choice: Choice): string | undefined {
    if (choice.isCorrect) {
      return undefined;
    }

    for (const reason of round.deductionReasons) {
      if (choice.reasonReference.includes(reason.reason)) {
        return reason.id;
      }
    }

    return round.deductionReasons[0]?.id;
  }

  static isGameComplete(state: GameState): boolean {
    return state.status === 'completed' || state.currentRound > state.totalRounds;
  }

  static calculateScore(state: GameState): number {
    return state.playerChoices.reduce((sum, choice) => sum + choice.score, 0);
  }

  static getCurrentRound(state: GameState, level: Level): Round | undefined {
    return level.rounds[state.currentRound - 1];
  }

  static getChoiceFeedback(state: GameState, choiceId: string, level: Level): string {
    const round = this.getCurrentRound(state, level);
    const choice = round?.choices.find(c => c.id === choiceId);
    return choice?.feedback || '暂无反馈';
  }

  static getDeductionReasons(state: GameState, level: Level) {
    const reasons: Array<{
      round: number;
      reason: string;
      evidence: string;
      deduction: number;
      choiceId: string;
    }> = [];

    state.playerChoices.forEach(choice => {
      if (!choice.isCorrect && choice.deductionReasonId) {
        const round = level.rounds[choice.roundId - 1];
        const deductionReason = round?.deductionReasons.find(r => r.id === choice.deductionReasonId);
        if (deductionReason) {
          const maxScore = round?.choices.find(c => c.isCorrect)?.score || 0;
          reasons.push({
            round: choice.roundId,
            reason: deductionReason.reason,
            evidence: deductionReason.evidence,
            deduction: maxScore - choice.score,
            choiceId: choice.choiceId,
          });
        }
      }
    });

    return reasons;
  }
}
