import React from 'react';
import type { Phrase, ChordProgression, Note } from '@/types/music';
import { getChordById } from '@/data/chords';
import { getChordAtMeasure } from '@/data/progressions';
import { cn } from '@/lib/utils';

interface StaffDisplayProps {
  progression: ChordProgression;
  completedMoves: { measureNumber: number; phrase: Phrase; isCorrect: boolean }[];
  currentMeasure: number;
  onMeasureClick?: (measure: number) => void;
  highlightErrors?: boolean;
}

const NOTE_POSITIONS: Record<string, number> = {
  C: 0,
  D: 1,
  E: 2,
  F: 3,
  G: 4,
  A: 5,
  B: 6,
};

function getNoteYPosition(note: Note): number {
  const basePosition = NOTE_POSITIONS[note.pitch] || 0;
  const octaveOffset = (note.octave - 4) * 7;
  return (basePosition + octaveOffset) * 5;
}

function getNoteHead(note: Note): string {
  if (note.duration >= 1) return 'M2,0 L2,2 L0,2 L0,0 Z';
  if (note.duration >= 0.5) return 'M2,1 A1,1 0 1,1 2,2 A1,1 0 1,1 2,1';
  return 'M2,1 A1,1 0 1,1 2,2 A1,1 0 1,1 2,1 Z';
}

export const StaffDisplay: React.FC<StaffDisplayProps> = ({
  progression,
  completedMoves,
  currentMeasure,
  onMeasureClick,
  highlightErrors = true,
}) => {
  const measures = Array.from({ length: progression.totalMeasures }, (_, i) => i + 1);

  return (
    <div className="w-full overflow-x-auto">
      <div className="min-w-[800px] p-4">
        <div className="flex gap-1 mb-2">
          {measures.map((measure) => {
            const chordId = getChordAtMeasure(progression, measure);
            const chord = chordId ? getChordById(chordId) : null;
            const move = completedMoves.find((m) => m.measureNumber === measure);
            const isActive = measure === currentMeasure;
            const isCompleted = !!move;

            return (
              <div
                key={measure}
                onClick={() => onMeasureClick?.(measure)}
                className={cn(
                  'flex-1 text-center py-2 px-1 rounded-t-lg transition-all cursor-pointer',
                  isActive
                    ? 'bg-jazz-gold/20 border-2 border-jazz-gold border-b-0'
                    : isCompleted
                    ? move?.isCorrect
                      ? 'bg-jazz-green/10 border-2 border-jazz-green/50 border-b-0'
                      : 'bg-jazz-burgundy/10 border-2 border-jazz-burgundy/50 border-b-0'
                    : 'bg-jazz-bgLight border-2 border-jazz-border/50 border-b-0 hover:border-jazz-gold/30'
                )}
              >
                <div className="text-xs text-jazz-textMuted mb-1">第 {measure} 小节</div>
                <div
                  className={cn(
                    'font-display font-bold',
                    isActive ? 'text-jazz-gold' : 'text-jazz-text'
                  )}
                >
                  {chord?.symbol || '?'}
                </div>
              </div>
            );
          })}
        </div>

        <div className="relative staff-pattern border-2 border-jazz-border rounded-b-xl rounded-tr-none bg-jazz-bgDark/50 p-4">
          <svg
            viewBox="0 0 800 120"
            className="w-full h-32"
            preserveAspectRatio="none"
          >
            {[0, 20, 40, 60, 80].map((y) => (
              <line
                key={y}
                x1="0"
                y1={y + 20}
                x2="800"
                y2={y + 20}
                stroke="rgba(212, 175, 55, 0.3)"
                strokeWidth="1"
              />
            ))}

            {measures.map((measure, idx) => {
              const x = (idx / measures.length) * 800;
              return (
                <line
                  key={idx}
                  x1={x}
                  y1="20"
                  x2={x}
                  y2="100"
                  stroke="rgba(212, 175, 55, 0.2)"
                  strokeWidth="1"
                />
              );
            })}

            {completedMoves.map((move) => {
              const measureIndex = move.measureNumber - 1;
              const measureWidth = 800 / measures.length;
              const startX = measureIndex * measureWidth + 20;
              const noteWidth = (measureWidth - 40) / move.phrase.notes.length;

              return move.phrase.notes.map((note, noteIdx) => {
                const x = startX + noteIdx * noteWidth + noteWidth / 2;
                const y = 60 - getNoteYPosition(note);
                const hasError = highlightErrors && !move.isCorrect;

                return (
                  <g key={`${move.measureNumber}-${noteIdx}`}>
                    {y < 20 && (
                      <line
                        x1={x - 8}
                        y1="20"
                        x2={x + 8}
                        y2="20"
                        stroke={hasError ? '#722F37' : 'rgba(212, 175, 55, 0.5)'}
                        strokeWidth="1"
                      />
                    )}
                    {y > 100 && (
                      <line
                        x1={x - 8}
                        y1="100"
                        x2={x + 8}
                        y2="100"
                        stroke={hasError ? '#722F37' : 'rgba(212, 175, 55, 0.5)'}
                        strokeWidth="1"
                      />
                    )}
                    <path
                      d={getNoteHead(note)}
                      transform={`translate(${x - 2}, ${y - 2})`}
                      fill={hasError ? '#722F37' : '#D4AF37'}
                      className="transition-all duration-300"
                    />
                    {note.accidental !== 'natural' && (
                      <text
                        x={x - 12}
                        y={y + 3}
                        fill={hasError ? '#722F37' : '#D4AF37'}
                        fontSize="12"
                        fontFamily="monospace"
                      >
                        {note.accidental}
                      </text>
                    )}
                  </g>
                );
              });
            })}
          </svg>

          {measures.map((measure) => {
            const move = completedMoves.find((m) => m.measureNumber === measure);
            if (!move) return null;

            return (
              <div
                key={measure}
                className="absolute bottom-2 text-center"
                style={{
                  left: `${((measure - 0.5) / measures.length) * 100}%`,
                  transform: 'translateX(-50%)',
                }}
              >
                <span
                  className={cn(
                    'text-xs px-2 py-0.5 rounded-full',
                    move.isCorrect
                      ? 'bg-jazz-green/20 text-jazz-greenLight'
                      : 'bg-jazz-burgundy/20 text-jazz-burgundyLight'
                  )}
                >
                  {move.isCorrect ? '✓' : '✗'} {move.phrase.name}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
