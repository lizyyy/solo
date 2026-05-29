import React, { useEffect, useRef, useCallback } from 'react';
import { Note } from '@/types';

interface PianoRollProps {
  notes: Note[];
  width?: number;
  height?: number;
  minPitch?: number;
  maxPitch?: number;
  highlightIndices?: number[];
  highlightColor?: string;
  editable?: boolean;
  onNotesChange?: (notes: Note[]) => void;
  showLabels?: boolean;
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const BLACK_KEYS = [1, 3, 6, 8, 10];

const PianoRoll: React.FC<PianoRollProps> = ({
  notes,
  width = 600,
  height = 300,
  minPitch = 48,
  maxPitch = 84,
  highlightIndices = [],
  highlightColor = '#F59E0B',
  editable = false,
  onNotesChange,
  showLabels = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const keyWidth = 40;
  const noteHeight = Math.floor((height - 30) / (maxPitch - minPitch));
  const beatWidth = Math.floor((width - keyWidth) / 16);

  const getNoteName = (pitch: number) => {
    const octave = Math.floor(pitch / 12) - 1;
    const note = pitch % 12;
    return `${NOTE_NAMES[note]}${octave}`;
  };

  const isBlackKey = (pitch: number) => BLACK_KEYS.includes(pitch % 12);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = '#1E293B';
    ctx.fillRect(0, 0, width, height);

    const timeAxisHeight = 24;

    for (let i = 0; i <= 16; i++) {
      const x = keyWidth + i * beatWidth;
      ctx.strokeStyle = i % 4 === 0 ? '#334155' : '#1E293B';
      ctx.lineWidth = i % 4 === 0 ? 1 : 0.5;
      ctx.beginPath();
      ctx.moveTo(x, timeAxisHeight);
      ctx.lineTo(x, height);
      ctx.stroke();

      if (i < 16) {
        ctx.fillStyle = '#64748B';
        ctx.font = '10px JetBrains Mono';
        ctx.textAlign = 'center';
        ctx.fillText(`${i + 1}`, x + beatWidth / 2, 16);
      }
    }

    for (let pitch = maxPitch - 1; pitch >= minPitch; pitch--) {
      const y = timeAxisHeight + (maxPitch - 1 - pitch) * noteHeight;
      const isBlack = isBlackKey(pitch);

      ctx.fillStyle = isBlack ? '#0F172A' : '#1E293B';
      ctx.fillRect(0, y, keyWidth, noteHeight);

      if (showLabels) {
        ctx.fillStyle = isBlack ? '#F59E0B' : '#94A3B8';
        ctx.font = '9px JetBrains Mono';
        ctx.textAlign = 'right';
        ctx.fillText(getNoteName(pitch), keyWidth - 6, y + noteHeight / 2 + 3);
      }

      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(keyWidth, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    notes.forEach((note, index) => {
      const noteY = timeAxisHeight + (maxPitch - 1 - note.pitch) * noteHeight;
      const noteX = keyWidth + note.startTime * beatWidth;
      const noteW = Math.max(note.duration * beatWidth - 1, 4);
      const noteH = noteHeight - 1;

      const isHighlighted = highlightIndices.includes(index);
      const isBlack = isBlackKey(note.pitch);

      const gradient = ctx.createLinearGradient(noteX, noteY, noteX, noteY + noteH);
      if (isHighlighted) {
        gradient.addColorStop(0, highlightColor);
        gradient.addColorStop(1, '#D97706');
      } else if (isBlack) {
        gradient.addColorStop(0, '#3D6CB3');
        gradient.addColorStop(1, '#254B8A');
      } else {
        gradient.addColorStop(0, '#5A83BE');
        gradient.addColorStop(1, '#3D6CB3');
      }

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.roundRect(noteX + 1, noteY + 1, noteW, noteH, 2);
      ctx.fill();

      if (isHighlighted) {
        ctx.strokeStyle = '#FCD34D';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(noteX, noteY, noteW + 2, noteH + 1, 2);
        ctx.stroke();
      }
    });
  }, [notes, width, height, minPitch, maxPitch, keyWidth, beatWidth, noteHeight, highlightIndices, highlightColor, showLabels]);

  useEffect(() => {
    draw();
  }, [draw]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!editable || !onNotesChange) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (x < keyWidth) return;

    const timeAxisHeight = 24;
    const beat = Math.floor((x - keyWidth) / beatWidth);
    const pitch = maxPitch - 1 - Math.floor((y - timeAxisHeight) / noteHeight);

    if (pitch < minPitch || pitch >= maxPitch) return;

    const existingNoteIndex = notes.findIndex(
      (n) => n.pitch === pitch && n.startTime === beat
    );

    if (existingNoteIndex >= 0) {
      const newNotes = [...notes];
      newNotes.splice(existingNoteIndex, 1);
      onNotesChange(newNotes);
    } else {
      const newNote: Note = {
        pitch,
        duration: 1,
        startTime: beat,
        velocity: 80,
      };
      onNotesChange([...notes, newNote].sort((a, b) => a.startTime - b.startTime));
    }
  };

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        onClick={handleCanvasClick}
        className="rounded-lg border border-slate-700 cursor-crosshair"
        style={{ imageRendering: 'crisp-edges' }}
      />
      {editable && (
        <div className="absolute bottom-2 right-2 text-xs text-slate-500">
          点击添加/删除音符
        </div>
      )}
    </div>
  );
};

export default PianoRoll;
