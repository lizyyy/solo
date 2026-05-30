import type { Phrase, Chord, ErrorDetail, Note } from '@/types/music';
import { getNoteSimpleName } from './musicTheory';

export interface ChordScoreResult {
  score: number;
  errors: ErrorDetail[];
  correctNotes: number;
  totalNotes: number;
  passingNotesUsed: number;
  chordTonesUsed: number;
  outsideNotes: string[];
}

export function calculateChordScore(
  phrase: Phrase,
  targetChord: Chord,
  measureNumber: number
): ChordScoreResult {
  const errors: ErrorDetail[] = [];
  const totalNotes = phrase.notes.length;
  let correctNotes = 0;
  let chordTonesUsed = 0;
  let passingNotesUsed = 0;
  const outsideNotes: string[] = [];

  phrase.notes.forEach((note, index) => {
    const noteName = getNoteSimpleName(note);
    const isChordTone = targetChord.allowedNotes.includes(noteName);
    const isPassingTone = targetChord.passingNotes.includes(noteName);
    const beat = (index * note.duration * 4) + 1;

    if (isChordTone) {
      correctNotes++;
      chordTonesUsed++;
    } else if (isPassingTone) {
      correctNotes += 0.7;
      passingNotesUsed++;
    } else {
      outsideNotes.push(noteName);
      errors.push({
        id: `error-chord-${Date.now()}-${index}`,
        type: 'data',
        measure: measureNumber,
        beat,
        description: `和弦外音：${noteName} 不属于 ${targetChord.symbol} 的和弦内音或经过音`,
        deduction: 5,
        suggestion: `建议使用 ${targetChord.symbol} 的和弦内音 (${targetChord.allowedNotes.join(', ')}) 或经过音 (${targetChord.passingNotes.join(', ')})`,
      });
    }
  });

  const usedPhraseIds = new Set<string>();
  if (usedPhraseIds.has(phrase.id)) {
    errors.push({
      id: `error-material-${Date.now()}-repeat`,
      type: 'material',
      measure: measureNumber,
      beat: 1,
      description: `重复使用乐句："${phrase.name}" 在之前的小节中已使用过`,
      deduction: 8,
      suggestion: '尝试使用不同的乐句来增加音乐的变化性，或扩充乐句库',
    });
    correctNotes = Math.max(0, correctNotes - 1.5);
  }

  if (phrase.compatibleChords.length === 0) {
    errors.push({
      id: `error-material-${Date.now()}-nocomp`,
      type: 'material',
      measure: measureNumber,
      beat: 1,
      description: `乐句材料问题："${phrase.name}" 没有标记任何兼容和弦`,
      deduction: 3,
      suggestion: '请在材料库中为该乐句标记兼容和弦，或选择其他有明确标记的乐句',
    });
  } else if (!phrase.compatibleChords.includes(targetChord.id)) {
    const hasPartialMatch = phrase.compatibleChords.some((chordId) => {
      const chordRoot = chordId.split('-')[0];
      return targetChord.id.includes(chordRoot);
    });
    
    if (!hasPartialMatch) {
      errors.push({
        id: `error-material-${Date.now()}-incompat`,
        type: 'material',
        measure: measureNumber,
        beat: 1,
        description: `乐句兼容性："${phrase.name}" 主要适配 ${phrase.compatibleChords.join(', ')}，与 ${targetChord.symbol} 搭配可能不够理想`,
        deduction: 2,
        suggestion: '可以尝试选择明确标记为兼容该和弦的乐句，以获得更好的效果',
      });
    }
  }

  const rawScore = Math.round((correctNotes / totalNotes) * 100);
  const totalDeductions = errors.reduce((sum, e) => sum + e.deduction, 0);
  const finalScore = Math.max(0, Math.min(100, rawScore - totalDeductions * 0.5));

  return {
    score: finalScore,
    errors,
    correctNotes,
    totalNotes,
    passingNotesUsed,
    chordTonesUsed,
    outsideNotes,
  };
}

export function analyzeChordChoice(
  phrase: Phrase,
  targetChord: Chord,
  measureNumber: number
): {
  isCorrect: boolean;
  explanation: string;
  strengths: string[];
  improvements: string[];
} {
  const result = calculateChordScore(phrase, targetChord, measureNumber);
  
  const strengths: string[] = [];
  const improvements: string[] = [];

  if (result.chordTonesUsed > 0) {
    strengths.push(`使用了 ${result.chordTonesUsed} 个 ${targetChord.symbol} 的和弦内音`);
  }
  if (result.passingNotesUsed > 0) {
    strengths.push(`合理运用了 ${result.passingNotesUsed} 个经过音`);
  }

  if (result.outsideNotes.length > 0) {
    improvements.push(`避免使用和弦外音：${result.outsideNotes.join(', ')}`);
  }
  if (result.score < 80) {
    improvements.push('尝试更多地使用和弦内音来加强和声稳定性');
  }

  const isCorrect = result.score >= 70;
  let explanation = '';

  if (isCorrect) {
    explanation = `很好！"${phrase.name}" 与 ${targetChord.symbol} 搭配得当，使用了 ${result.chordTonesUsed} 个和弦内音，得分 ${result.score} 分。`;
  } else if (result.score >= 50) {
    explanation = `"${phrase.name}" 与 ${targetChord.symbol} 基本兼容，但存在 ${result.outsideNotes.length} 个和弦外音需要调整，得分 ${result.score} 分。`;
  } else {
    explanation = `"${phrase.name}" 与 ${targetChord.symbol} 匹配度较低，有 ${result.outsideNotes.length} 个明显的和弦外音，建议重新选择乐句，得分 ${result.score} 分。`;
  }

  return {
    isCorrect,
    explanation,
    strengths,
    improvements,
  };
}

export function suggestPhrases(
  availablePhrases: Phrase[],
  targetChord: Chord,
  count: number = 3
): Phrase[] {
  const scored = availablePhrases.map((phrase) => {
    const result = calculateChordScore(phrase, targetChord, 1);
    return { phrase, score: result.score };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .map((item) => item.phrase);
}
