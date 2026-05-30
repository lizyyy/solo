import type { GameSession, ErrorType, Move } from '@/types/music';
import type { GameContext } from '@/engine/gameEngine';
import { getChordAtMeasure } from '@/data/progressions';
import { getChordById } from '@/data/chords';
import { playMeasure } from './audio';
import { estimateTimingData } from '@/engine/rhythmEngine';

export interface PlaybackEvent {
  type: 'measure_start' | 'note' | 'error' | 'measure_end';
  measure: number;
  beat: number;
  timestamp: number;
  data?: any;
}

export interface PlaybackPosition {
  measure: number;
  beat: number;
  time: number;
}

export function generatePlaybackTimeline(
  session: GameSession,
  context: GameContext
): PlaybackEvent[] {
  const events: PlaybackEvent[] = [];
  const pattern = context.rhythm;
  const beatDuration = 60 / pattern.bpm;
  const beatsPerMeasure = pattern.timeSignature[0];
  const measureDuration = beatDuration * beatsPerMeasure;

  session.moves.forEach((move) => {
    const measureStartTime = (move.measureNumber - 1) * measureDuration;
    
    events.push({
      type: 'measure_start',
      measure: move.measureNumber,
      beat: 1,
      timestamp: measureStartTime,
      data: { move },
    });

    const timingData = estimateTimingData(move.phrase, pattern, 0, false);
    
    move.phrase.notes.forEach((note, index) => {
      const noteTime = measureStartTime + timingData[index];
      const beat = Math.floor((timingData[index] / (beatDuration * beatsPerMeasure)) * beatsPerMeasure) + 1;
      
      events.push({
        type: 'note',
        measure: move.measureNumber,
        beat,
        timestamp: noteTime,
        data: { note, index },
      });
    });

    move.errors.forEach((error) => {
      if (error.deduction > 0) {
        const errorTime = measureStartTime + (error.beat - 1) * beatDuration;
        events.push({
          type: 'error',
          measure: move.measureNumber,
          beat: error.beat,
          timestamp: errorTime,
          data: { error },
        });
      }
    });

    events.push({
      type: 'measure_end',
      measure: move.measureNumber,
      beat: beatsPerMeasure,
      timestamp: measureStartTime + measureDuration - 0.01,
      data: { move },
    });
  });

  return events.sort((a, b) => a.timestamp - b.timestamp);
}

export function getTotalDuration(session: GameSession, context: GameContext): number {
  const pattern = context.rhythm;
  const beatDuration = 60 / pattern.bpm;
  const beatsPerMeasure = pattern.timeSignature[0];
  const measureDuration = beatDuration * beatsPerMeasure;
  return context.progression.totalMeasures * measureDuration;
}

export function getPositionAtTime(
  time: number,
  session: GameSession,
  context: GameContext
): PlaybackPosition {
  const pattern = context.rhythm;
  const beatDuration = 60 / pattern.bpm;
  const beatsPerMeasure = pattern.timeSignature[0];
  const measureDuration = beatDuration * beatsPerMeasure;

  const measure = Math.floor(time / measureDuration) + 1;
  const measureTime = time % measureDuration;
  const beat = Math.floor(measureTime / beatDuration) + 1;

  return {
    measure: Math.min(measure, context.progression.totalMeasures),
    beat: Math.min(beat, beatsPerMeasure),
    time,
  };
}

export function getTimeAtPosition(
  measure: number,
  beat: number,
  context: GameContext
): number {
  const pattern = context.rhythm;
  const beatDuration = 60 / pattern.bpm;
  const beatsPerMeasure = pattern.timeSignature[0];
  const measureDuration = beatDuration * beatsPerMeasure;

  return (measure - 1) * measureDuration + (beat - 1) * beatDuration;
}

export function filterErrorsByType(
  session: GameSession,
  types: ErrorType[]
): GameSession {
  if (types.length === 0) return session;

  return {
    ...session,
    moves: session.moves.map((move) => ({
      ...move,
      errors: move.errors.filter((e) => types.includes(e.type)),
    })),
    score: session.score
      ? {
          ...session.score,
          errors: session.score.errors.filter((e) => types.includes(e.type)),
        }
      : undefined,
  };
}

export function getErrorsByMeasure(session: GameSession, measure: number) {
  const move = session.moves.find((m) => m.measureNumber === measure);
  return move?.errors.filter((e) => e.deduction > 0) || [];
}

export function getMoveAtMeasure(session: GameSession, measure: number): Move | undefined {
  return session.moves.find((m) => m.measureNumber === measure);
}

export async function playMeasureAt(
  session: GameSession,
  context: GameContext,
  measure: number
): Promise<void> {
  const move = getMoveAtMeasure(session, measure);
  if (!move) return;

  const chordId = getChordAtMeasure(context.progression, measure);
  const chord = chordId ? getChordById(chordId) : null;
  
  if (chord) {
    await playMeasure(move.phrase, chord.symbol, chord.allowedNotes, context.rhythm, measure);
  }
}

export function getErrorTypeLabel(type: ErrorType): string {
  const labels: Record<ErrorType, string> = {
    data: '数据问题',
    rule: '规则问题',
    material: '材料问题',
  };
  return labels[type];
}

export function getErrorTypeColor(type: ErrorType): string {
  const colors: Record<ErrorType, string> = {
    data: 'text-jazz-orange',
    rule: 'text-jazz-burgundy',
    material: 'text-jazz-purple',
  };
  return colors[type];
}

export function getErrorTypeBg(type: ErrorType): string {
  const colors: Record<ErrorType, string> = {
    data: 'bg-jazz-orange/20 border-jazz-orange',
    rule: 'bg-jazz-burgundy/20 border-jazz-burgundy',
    material: 'bg-jazz-purple/20 border-jazz-purple',
  };
  return colors[type];
}

export function getErrorTypeIcon(type: ErrorType): string {
  const icons: Record<ErrorType, string> = {
    data: '⚠️',
    rule: '🚫',
    material: '📦',
  };
  return icons[type];
}

export function getErrorTypeDescription(type: ErrorType): string {
  const descriptions: Record<ErrorType, string> = {
    data: '音高识别或和弦外音问题，可能存在识别偏差，建议结合听觉判断',
    rule: '违反节拍或时值规则，检查音符时值和小节容量',
    material: '乐句库材料不足或重复，建议扩充材料库或标注更准确的兼容和弦',
  };
  return descriptions[type];
}
