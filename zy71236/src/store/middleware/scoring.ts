import { Score, HistoryItem, Warning, SynthParams } from '../../types/synth';
import { updateScore, calculateScoreImpact } from '../../utils/scoring';

export function scoringMiddleware(
  currentScore: Score,
  params: SynthParams,
  history: HistoryItem[],
  lastWarning: Warning | null,
  newHistoryItem: HistoryItem
): {
  newScore: Score;
  scoreImpact: { dimension: string; delta: number } | null;
} {
  const updatedHistory = [...history, newHistoryItem];
  const newScore = updateScore(currentScore, params, updatedHistory, lastWarning);
  const scoreImpact = calculateScoreImpact(currentScore, newScore);

  return { newScore, scoreImpact };
}
