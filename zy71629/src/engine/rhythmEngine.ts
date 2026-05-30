import type { Phrase, RhythmPattern, ErrorDetail } from '@/types/music';

export interface RhythmScoreResult {
  score: number;
  errors: ErrorDetail[];
  avgDeviation: number;
  durationAccuracy: number;
  beatConsistency: number;
}

export function calculateRhythmScore(
  phrase: Phrase,
  pattern: RhythmPattern,
  measureNumber: number,
  timingData?: number[]
): RhythmScoreResult {
  const errors: ErrorDetail[] = [];
  const beatDuration = 60 / pattern.bpm;
  const beatsPerMeasure = pattern.timeSignature[0];

  const expectedTotalDuration = phrase.totalDuration * beatDuration * beatsPerMeasure;
  
  let durationAccuracy = 100;
  if (timingData && timingData.length >= 2) {
    const actualDuration = timingData[timingData.length - 1] - timingData[0];
    const durationDiff = Math.abs(expectedTotalDuration - actualDuration);
    durationAccuracy = Math.max(0, 100 - (durationDiff / beatDuration) * 25);

    if (durationDiff > beatDuration * 0.5) {
      const diffSeconds = durationDiff.toFixed(2);
      errors.push({
        id: `error-rhythm-duration-${Date.now()}`,
        type: 'rule',
        measure: measureNumber,
        beat: 1,
        description: `小节超拍：乐句实际时长 ${diffSeconds} 秒，与预期 ${expectedTotalDuration.toFixed(2)} 秒偏差过大`,
        deduction: 10,
        suggestion: '注意控制每个音符的时值，确保总时长与小节匹配。可以使用节拍器跟随练习。',
      });
    }

    if (actualDuration > expectedTotalDuration * 1.2) {
      errors.push({
        id: `error-rule-overflow-${Date.now()}`,
        type: 'rule',
        measure: measureNumber,
        beat: 1,
        description: `小节时长超出限制：乐句总时长超过小节容量的20%`,
        deduction: 15,
        suggestion: '选择总时长更短的乐句，或调整音符的时值。当前乐句总时长为 ' + phrase.totalDuration + ' 拍。',
      });
    }
  }

  let avgDeviation = 0;
  let beatConsistency = 100;
  
  if (timingData && timingData.length >= 2) {
    let totalDeviation = 0;
    let validIntervals = 0;

    for (let i = 1; i < timingData.length; i++) {
      const noteIndex = i - 1;
      if (noteIndex >= phrase.notes.length) break;

      const expectedInterval = phrase.notes[noteIndex].duration * beatDuration * beatsPerMeasure;
      const actualInterval = timingData[i] - timingData[i - 1];
      const deviation = Math.abs(expectedInterval - actualInterval);
      totalDeviation += deviation;
      validIntervals++;

      if (deviation > beatDuration * 0.3) {
        errors.push({
          id: `error-rhythm-beat-${Date.now()}-${i}`,
          type: 'rule',
          measure: measureNumber,
          beat: i,
          description: `节拍错位：第 ${i} 个音符的间隔偏差 ${deviation.toFixed(2)} 秒`,
          deduction: 3,
          suggestion: '跟随节拍器的律动，保持每个音符之间的间隔稳定。注意摇摆（Swing）节奏的感觉。',
        });
      }
    }

    if (validIntervals > 0) {
      avgDeviation = totalDeviation / validIntervals;
      beatConsistency = Math.max(0, 100 - (avgDeviation / beatDuration) * 50);
    }
  }

  if (phrase.totalDuration > 1) {
    errors.push({
      id: `error-rule-length-${Date.now()}`,
      type: 'rule',
      measure: measureNumber,
      beat: 1,
      description: `乐句时长规则：当前乐句总时长为 ${phrase.totalDuration} 拍，超过小节容量（1拍）`,
      deduction: 8,
      suggestion: '选择总时长不超过1拍的乐句，或使用多个短句组合。',
    });
    beatConsistency = Math.max(0, beatConsistency - 15);
    durationAccuracy = Math.max(0, durationAccuracy - 15);
  }

  const baseScore = (durationAccuracy * 0.4 + beatConsistency * 0.6);
  const totalDeductions = errors.reduce((sum, e) => sum + e.deduction, 0);
  const finalScore = Math.max(0, Math.min(100, baseScore - totalDeductions * 0.3));

  if (pattern.swingFactor && pattern.swingFactor > 0.2) {
    errors.push({
      id: `info-swing-${Date.now()}`,
      type: 'data',
      measure: measureNumber,
      beat: 1,
      description: `摇摆节奏提示：当前节奏摇摆系数为 ${pattern.swingFactor}，注意八分音符的摇摆感觉`,
      deduction: 0,
      suggestion: '在摇摆节奏中，八分音符的第一个音稍长，第二个音稍短，营造摇摆感。',
    });
  }

  return {
    score: Math.round(finalScore),
    errors,
    avgDeviation,
    durationAccuracy: Math.round(durationAccuracy),
    beatConsistency: Math.round(beatConsistency),
  };
}

export function generateMetronomeClicks(
  pattern: RhythmPattern,
  measures: number,
  startMeasure: number = 1
): { time: number; beat: number; measure: number; isAccent: boolean }[] {
  const clicks: { time: number; beat: number; measure: number; isAccent: boolean }[] = [];
  const beatDuration = 60 / pattern.bpm;
  const beatsPerMeasure = pattern.timeSignature[0];

  for (let measure = 0; measure < measures; measure++) {
    for (let beat = 0; beat < beatsPerMeasure; beat++) {
      const time = (measure * beatsPerMeasure + beat) * beatDuration;
      clicks.push({
        time,
        beat: beat + 1,
        measure: measure + startMeasure,
        isAccent: beat === 0,
      });
    }
  }

  return clicks;
}

export function getSwingTiming(
  baseTime: number,
  beatDuration: number,
  swingFactor: number
): number {
  const swingOffset = beatDuration * 0.1667 * swingFactor;
  return baseTime + swingOffset;
}

export function estimateTimingData(
  phrase: Phrase,
  pattern: RhythmPattern,
  startTime: number = 0,
  humanize: boolean = true
): number[] {
  const timing: number[] = [startTime];
  const beatDuration = 60 / pattern.bpm;
  const beatsPerMeasure = pattern.timeSignature[0];
  const swingFactor = pattern.swingFactor || 0;

  let currentTime = startTime;

  phrase.notes.forEach((note, index) => {
    let noteDuration = note.duration * beatDuration * beatsPerMeasure;
    
    if (humanize) {
      const jitter = (Math.random() - 0.5) * beatDuration * 0.05;
      noteDuration += jitter;
    }

    if (index % 2 === 1 && swingFactor > 0) {
      noteDuration = getSwingTiming(noteDuration, beatDuration, swingFactor);
    }

    currentTime += noteDuration;
    timing.push(currentTime);
  });

  return timing;
}

export function getRhythmPatternDescription(pattern: RhythmPattern): string {
  const [beats, noteValue] = pattern.timeSignature;
  const swingDesc = pattern.swingFactor && pattern.swingFactor > 0 
    ? `，摇摆感 ${Math.round(pattern.swingFactor * 100)}%` 
    : '';
  
  return `${beats}/${noteValue}拍，速度 ${pattern.bpm} BPM${swingDesc}`;
}

export function checkPhraseRhythmCompatibility(
  phrase: Phrase,
  pattern: RhythmPattern
): { compatible: boolean; issues: string[] } {
  const issues: string[] = [];
  const beatsPerMeasure = pattern.timeSignature[0];
  
  if (phrase.totalDuration > beatsPerMeasure / 4) {
    issues.push(`乐句时长（${phrase.totalDuration}拍）超过小节容量（${beatsPerMeasure / 4}拍）`);
  }

  const hasOddDurations = phrase.notes.some(
    (note) => note.duration < 0.0625 || note.duration > 1
  );
  if (hasOddDurations) {
    issues.push('乐句中包含不常见的音符时值');
  }

  return {
    compatible: issues.length === 0,
    issues,
  };
}
