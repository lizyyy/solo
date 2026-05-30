
import { GameState, MineCell, ScoreBreakdown, InventoryItem } from '../types';
import { GAME_CONFIG } from '../data/config';
import { getMineralById } from '../data/minerals';

export function calculateMiningScore(
  mineralValue: number,
  quantity: number,
  efficiency: number,
  isCorrect: boolean
): number {
  const baseScore = mineralValue * quantity * efficiency * 10;
  return isCorrect ? baseScore : Math.floor(baseScore * 0.5);
}

export function calculateWrongGuessPenalty(): number {
  return -GAME_CONFIG.WRONG_GUESS_PENALTY;
}

export function calculatePowerDepletionPenalty(): number {
  return -GAME_CONFIG.POWER_DEPLETION_PENALTY;
}

export function calculateMixedInventoryPenalty(item: InventoryItem): number {
  if (!item.isMixed) return 0;
  return -Math.floor(item.unitValue * item.quantity * GAME_CONFIG.MIXED_INVENTORY_FACTOR);
}

export function generateScoreBreakdown(state: GameState): ScoreBreakdown {
  let correctMiningScore = 0;
  let wrongGuessPenalty = 0;
  let mixedInventoryPenalty = 0;

  const correctMiningDetails: { mineral: string; quantity: number; value: number }[] = [];
  const wrongGuessDetails: { cell: string; guessed: string; actual: string }[] = [];
  const mixedInventoryDetails: { mineral: string; quantity: number }[] = [];
  const reasons: string[] = [];

  let correctCount = 0;
  let wrongCount = 0;

  state.mineGrid.forEach((row) => {
    row.forEach((cell) => {
      if (cell.status === 'mined' && cell.mineral) {
        if (cell.isCorrect) {
          const score = calculateMiningScore(
            cell.mineral.value,
            cell.minedQuantity,
            1.0,
            true
          );
          correctMiningScore += score;
          correctCount++;
          correctMiningDetails.push({
            mineral: cell.mineral.nameCn,
            quantity: cell.minedQuantity,
            value: score
          });
        } else if (cell.playerGuess && cell.playerGuess !== cell.mineralType) {
          wrongGuessPenalty += calculateWrongGuessPenalty();
          wrongCount++;
          wrongGuessDetails.push({
            cell: `(${cell.x + 1}, ${cell.y + 1})`,
            guessed: getMineralById(cell.playerGuess)?.nameCn || '未知',
            actual: cell.mineral.nameCn
          });
        }
      }
    });
  });

  state.inventory.forEach((item) => {
    if (item.isMixed) {
      mixedInventoryPenalty += calculateMixedInventoryPenalty(item);
      mixedInventoryDetails.push({
        mineral: item.mineralName,
        quantity: item.quantity
      });
    }
  });

  const remainingPowerBonus = Math.floor(state.power * 0.5);
  const totalScore = correctMiningScore + wrongGuessPenalty + mixedInventoryPenalty + remainingPowerBonus;

  if (wrongCount > 0) {
    reasons.push(`光谱误判 ${wrongCount} 次，每次扣除 ${GAME_CONFIG.WRONG_GUESS_PENALTY} 分，影响：识别准确率降低`);
  }

  if (state.power <= 0) {
    reasons.push(`电量耗尽，额外扣除 ${GAME_CONFIG.POWER_DEPLETION_PENALTY} 分，影响：无法继续开采剩余矿石`);
  }

  if (mixedInventoryDetails.length > 0) {
    reasons.push(`库存混放 ${mixedInventoryDetails.length} 批，价值减半，影响：库存利用率降低`);
  }

  let finalVerdict: 'success' | 'failed' | 'partial';
  if (totalScore >= GAME_CONFIG.PASSING_SCORE && wrongCount === 0) {
    finalVerdict = 'success';
  } else if (totalScore >= GAME_CONFIG.PASSING_SCORE * 0.5) {
    finalVerdict = 'partial';
  } else {
    finalVerdict = 'failed';
  }

  if (reasons.length === 0) {
    reasons.push('任务完成出色！矿石识别准确，资源调度合理。');
  }

  return {
    totalScore: Math.max(0, totalScore),
    correctMining: {
      count: correctCount,
      score: correctMiningScore,
      details: correctMiningDetails
    },
    wrongGuess: {
      count: wrongCount,
      penalty: wrongGuessPenalty,
      details: wrongGuessDetails
    },
    mixedInventory: {
      count: mixedInventoryDetails.length,
      penalty: mixedInventoryPenalty,
      details: mixedInventoryDetails
    },
    powerEfficiency: {
      remainingPower: state.power,
      bonus: remainingPowerBonus
    },
    finalVerdict,
    reasons
  };
}

export function getScoreRating(score: number): { grade: string; color: string } {
  if (score >= 300) return { grade: 'S', color: '#FFD700' };
  if (score >= 250) return { grade: 'A', color: '#C0C0C0' };
  if (score >= 200) return { grade: 'B', color: '#CD7F32' };
  if (score >= 150) return { grade: 'C', color: '#8B4513' };
  return { grade: 'D', color: '#666666' };
}
