import type {
  Game,
  GameSession,
  Move,
  Phrase,
  Score,
  ChordProgression,
  RhythmPattern,
  ErrorDetail,
  Grade,
} from '@/types/music';
import { calculateChordScore } from './chordEngine';
import { calculateRhythmScore, estimateTimingData } from './rhythmEngine';
import { getChordById } from '@/data/chords';
import { getPhraseById } from '@/data/phrases';
import { getProgressionById, getRhythmById, getChordAtMeasure } from '@/data/progressions';

export interface GameContext {
  game: Game;
  progression: ChordProgression;
  rhythm: RhythmPattern;
  availablePhrases: Phrase[];
}

export function createGameContext(game: Game): GameContext | null {
  const progression = getProgressionById(game.chordProgressionId);
  const rhythm = getRhythmById(game.rhythmPatternId);
  
  if (!progression || !rhythm) return null;

  const availablePhrases = game.availablePhraseIds
    .map((id) => getPhraseById(id))
    .filter((p): p is Phrase => p !== undefined);

  return { game, progression, rhythm, availablePhrases };
}

export function createSession(
  gameId: string,
  studentId: string,
  studentName: string
): GameSession {
  return {
    id: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    gameId,
    studentId,
    studentName,
    startTime: Date.now(),
    moves: [],
    confirmed: false,
  };
}

export function createMove(
  measureNumber: number,
  phrase: Phrase,
  context: GameContext,
  usedPhraseIds: Set<string>
): Move {
  const chordId = getChordAtMeasure(context.progression, measureNumber);
  const chord = chordId ? getChordById(chordId) : null;
  
  let chordScore = 0;
  let rhythmScore = 0;
  let errors: ErrorDetail[] = [];

  if (chord) {
    const chordResult = calculateChordScore(phrase, chord, measureNumber);
    if (usedPhraseIds.has(phrase.id)) {
      chordResult.errors.push({
        id: `error-material-repeat-${Date.now()}`,
        type: 'material',
        measure: measureNumber,
        beat: 1,
        description: `重复乐句："${phrase.name}" 已在之前的小节中使用`,
        deduction: 8,
        suggestion: '尝试使用不同的乐句增加变化性，或考虑扩充材料库',
      });
      chordResult.score = Math.max(0, chordResult.score - 8);
    }
    chordScore = chordResult.score;
    errors = [...errors, ...chordResult.errors];
  }

  const timingData = estimateTimingData(phrase, context.rhythm, Date.now(), false);
  const rhythmResult = calculateRhythmScore(phrase, context.rhythm, measureNumber, timingData);
  rhythmScore = rhythmResult.score;
  errors = [...errors, ...rhythmResult.errors];

  const hasErrors = errors.some((e) => e.deduction > 0);
  const isCorrect = !hasErrors && chordScore >= 70 && rhythmScore >= 70;

  return {
    id: `move-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    measureNumber,
    phraseId: phrase.id,
    phrase,
    timestamp: Date.now(),
    isCorrect,
    errors,
    chordScore,
    rhythmScore,
  };
}

export function calculateFinalScore(
  session: GameSession,
  context: GameContext
): Score {
  const totalMeasures = context.progression.totalMeasures;
  const moves = session.moves;

  let totalChordScore = 0;
  let totalRhythmScore = 0;
  let allErrors: ErrorDetail[] = [];
  const keyDecisions: Score['keyDecisions'] = [];

  moves.forEach((move) => {
    totalChordScore += move.chordScore;
    totalRhythmScore += move.rhythmScore;
    allErrors = [...allErrors, ...move.errors];

    const chordId = getChordAtMeasure(context.progression, move.measureNumber);
    const chord = chordId ? getChordById(chordId) : null;
    const chordSymbol = chord?.symbol || '未知和弦';

    let decisionType = '';
    if (move.chordScore >= 80 && move.rhythmScore >= 80) {
      decisionType = '优秀选择';
    } else if (move.chordScore >= 60 && move.rhythmScore >= 60) {
      decisionType = '合理选择';
    } else {
      decisionType = '需要改进';
    }

    keyDecisions.push({
      measure: move.measureNumber,
      choice: `"${move.phrase.name}" → ${chordSymbol}`,
      isCorrect: move.isCorrect,
      explanation: `${decisionType}：和弦得分 ${move.chordScore}，节拍得分 ${move.rhythmScore}`,
    });
  });

  const avgChordScore = moves.length > 0 ? Math.round(totalChordScore / moves.length) : 0;
  const avgRhythmScore = moves.length > 0 ? Math.round(totalRhythmScore / moves.length) : 0;

  const completenessBonus = moves.length >= totalMeasures ? 5 : 0;
  const totalScore = Math.min(100, Math.round((avgChordScore * 0.5 + avgRhythmScore * 0.5) + completenessBonus));

  const grade = getGrade(totalScore);
  const suggestions = generateSuggestions(avgChordScore, avgRhythmScore, allErrors, context);

  return {
    chordScore: avgChordScore,
    rhythmScore: avgRhythmScore,
    totalScore,
    grade,
    errors: allErrors,
    keyDecisions,
    suggestions,
  };
}

function getGrade(score: number): Grade {
  if (score >= 95) return 'S';
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

function generateSuggestions(
  chordScore: number,
  rhythmScore: number,
  errors: ErrorDetail[],
  context: GameContext
): string[] {
  const suggestions: string[] = [];

  const dataErrors = errors.filter((e) => e.type === 'data' && e.deduction > 0);
  const ruleErrors = errors.filter((e) => e.type === 'rule' && e.deduction > 0);
  const materialErrors = errors.filter((e) => e.type === 'material' && e.deduction > 0);

  if (chordScore < 70) {
    suggestions.push('加强和弦内音的练习，确保每个选择的乐句主要由当前和弦的和弦音组成');
    suggestions.push(`重点练习 ${context.progression.name} 中每个和弦的琶音和音阶`);
  }

  if (rhythmScore < 70) {
    suggestions.push(`使用节拍器在 ${context.rhythm.bpm} BPM 速度下练习节奏稳定性`);
    suggestions.push('先放慢速度练习，确保每个音符的时值准确后再逐渐提速');
  }

  if (dataErrors.length > 0) {
    suggestions.push(`注意避免和弦外音：共有 ${dataErrors.length} 处数据问题，主要是音高选择不当`);
    suggestions.push('建议先分析每个和弦的构成音，再选择对应的乐句');
  }

  if (ruleErrors.length > 0) {
    suggestions.push(`节拍规则需要注意：共有 ${ruleErrors.length} 处规则问题，主要是时值和小节超拍`);
    suggestions.push('选择乐句时注意总时长，确保不超过小节容量');
  }

  if (materialErrors.length > 0) {
    suggestions.push(`材料库问题：共有 ${materialErrors.length} 处材料问题，建议扩充乐句库或标注更准确的兼容和弦`);
    suggestions.push('可以为同一个和弦准备多个不同的乐句选项，增加变化性');
  }

  if (context.rhythm.swingFactor && context.rhythm.swingFactor > 0.3) {
    suggestions.push('注意摇摆（Swing）节奏的感觉，八分音符不要演奏得太平均');
  }

  if (chordScore >= 80 && rhythmScore >= 80) {
    suggestions.push('很好！可以尝试更复杂的经过音和装饰音，丰富音乐表现力');
    suggestions.push('尝试在不同调性上练习同样的和弦进行');
  }

  return suggestions.slice(0, 5);
}

export function getGameProgress(session: GameSession, context: GameContext): number {
  const completedMeasures = new Set(session.moves.map((m) => m.measureNumber));
  return Math.round((completedMeasures.size / context.progression.totalMeasures) * 100);
}

export function getNextMeasure(session: GameSession, context: GameContext): number {
  const completedMeasures = new Set(session.moves.map((m) => m.measureNumber));
  for (let i = 1; i <= context.progression.totalMeasures; i++) {
    if (!completedMeasures.has(i)) {
      return i;
    }
  }
  return context.progression.totalMeasures + 1;
}

export function isGameComplete(session: GameSession, context: GameContext): boolean {
  const completedMeasures = new Set(session.moves.map((m) => m.measureNumber));
  return completedMeasures.size >= context.progression.totalMeasures;
}

export function getErrorTypeSummary(errors: ErrorDetail[]): {
  data: { count: number; totalDeduction: number };
  rule: { count: number; totalDeduction: number };
  material: { count: number; totalDeduction: number };
} {
  const summary = {
    data: { count: 0, totalDeduction: 0 },
    rule: { count: 0, totalDeduction: 0 },
    material: { count: 0, totalDeduction: 0 },
  };

  errors.forEach((error) => {
    if (error.deduction > 0) {
      summary[error.type].count++;
      summary[error.type].totalDeduction += error.deduction;
    }
  });

  return summary;
}

export function getGradeColor(grade: Grade): string {
  const colors: Record<Grade, string> = {
    S: 'text-jazz-gold',
    A: 'text-jazz-green',
    B: 'text-blue-400',
    C: 'text-yellow-400',
    D: 'text-jazz-orange',
    F: 'text-jazz-burgundy',
  };
  return colors[grade];
}

export function getGradeBg(grade: Grade): string {
  const colors: Record<Grade, string> = {
    S: 'bg-jazz-gold',
    A: 'bg-jazz-green',
    B: 'bg-blue-500',
    C: 'bg-yellow-500',
    D: 'bg-jazz-orange',
    F: 'bg-jazz-burgundy',
  };
  return colors[grade];
}
