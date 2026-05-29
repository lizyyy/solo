import { ContourCode } from '@/types';

export function encodeContour(pitches: number[]): ContourCode {
  if (pitches.length === 0) {
    return {
      relative: [],
      direction: [],
      intervals: [],
      rawSequence: '',
    };
  }

  const basePitch = pitches[0];
  const relative: number[] = pitches.map((p) => p - basePitch);

  const direction: ('up' | 'down' | 'flat')[] = [];
  const intervals: number[] = [];

  for (let i = 1; i < pitches.length; i++) {
    const diff = pitches[i] - pitches[i - 1];
    intervals.push(diff);
    if (diff > 0) {
      direction.push('up');
    } else if (diff < 0) {
      direction.push('down');
    } else {
      direction.push('flat');
    }
  }

  const directionCodes = direction.map((d) => {
    if (d === 'up') return 'U';
    if (d === 'down') return 'D';
    return 'F';
  });

  const intervalCodes = intervals.map((i) => {
    const abs = Math.abs(i);
    if (abs === 0) return '0';
    if (abs === 1) return 'm';
    if (abs === 2) return 'M';
    if (abs === 3) return 'm3';
    if (abs === 4) return 'M3';
    if (abs === 5) return 'P4';
    if (abs === 7) return 'P5';
    return 'L';
  });

  const rawSequence = `R[${relative.join(',')}]-D[${directionCodes.join('')}]-I[${intervalCodes.join('-')}]`;

  return {
    relative,
    direction,
    intervals,
    rawSequence,
  };
}

export function getContourEncodingSteps(pitches: number[]): string[] {
  const steps: string[] = [];
  steps.push(`输入音高序列: [${pitches.join(', ')}]`);

  if (pitches.length === 0) return steps;

  const basePitch = pitches[0];
  steps.push(`基准音高: ${basePitch} (MIDI编号)`);

  const relative = pitches.map((p) => p - basePitch);
  steps.push(`相对音高: [${relative.join(', ')}]`);

  const directionSymbols: string[] = [];
  for (let i = 1; i < pitches.length; i++) {
    const diff = pitches[i] - pitches[i - 1];
    if (diff > 0) {
      directionSymbols.push(`↑(+${diff})`);
    } else if (diff < 0) {
      directionSymbols.push(`↓(${diff})`);
    } else {
      directionSymbols.push('→(0)');
    }
  }
  steps.push(`方向变化: ${directionSymbols.join(' -> ')}`);

  const contour = encodeContour(pitches);
  steps.push(`最终编码: ${contour.rawSequence}`);

  return steps;
}

export function transposePitches(pitches: number[], semitones: number): number[] {
  return pitches.map((p) => p + semitones);
}

export function findBestTransposition(
  queryPitches: number[],
  targetPitches: number[]
): { transposition: number; score: number } {
  let bestTransposition = 0;
  let bestScore = -Infinity;

  for (let t = -12; t <= 12; t++) {
    const transposed = transposePitches(queryPitches, t);
    const score = calculatePitchMatchScore(transposed, targetPitches);
    if (score > bestScore) {
      bestScore = score;
      bestTransposition = t;
    }
  }

  return { transposition: bestTransposition, score: bestScore };
}

function calculatePitchMatchScore(a: number[], b: number[]): number {
  const minLen = Math.min(a.length, b.length);
  let matches = 0;

  for (let i = 0; i < minLen; i++) {
    if (a[i] === b[i]) matches++;
  }

  return matches / Math.max(a.length, b.length);
}
