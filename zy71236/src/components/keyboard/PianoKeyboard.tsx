import { useState } from 'react';
import { useSynthStore } from '../../store/useSynthStore';

interface PianoKeyProps {
  note: string;
  frequency: number;
  isBlack?: boolean;
  isActive: boolean;
  onMouseDown: () => void;
  onMouseUp: () => void;
  onMouseLeave: () => void;
}

function PianoKey({
  note,
  isBlack = false,
  isActive,
  onMouseDown,
  onMouseUp,
  onMouseLeave,
}: PianoKeyProps) {
  const baseClasses = isBlack
    ? 'absolute z-10 -mr-[14px] w-7 h-24 rounded-b-md transition-all duration-75'
    : 'relative w-10 h-36 rounded-b-lg border border-gray-600 transition-all duration-75';

  const colorClasses = isBlack
    ? isActive
      ? 'bg-gray-500 shadow-inner'
      : 'bg-gradient-to-b from-gray-800 to-gray-900 hover:from-gray-700 hover:to-gray-800'
    : isActive
    ? 'bg-cyan-200 shadow-inner shadow-cyan-500/30'
    : 'bg-gradient-to-b from-gray-100 to-gray-200 hover:from-gray-200 hover:to-gray-300';

  return (
    <div
      className={`${baseClasses} ${colorClasses} cursor-pointer select-none`}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
      onTouchStart={(e) => {
        e.preventDefault();
        onMouseDown();
      }}
      onTouchEnd={(e) => {
        e.preventDefault();
        onMouseUp();
      }}
    >
      {!isBlack && (
        <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs text-gray-500 font-mono">
          {note}
        </span>
      )}
    </div>
  );
}

const notes = [
  { note: 'C4', freq: 261.63, isBlack: false },
  { note: 'C#4', freq: 277.18, isBlack: true },
  { note: 'D4', freq: 293.66, isBlack: false },
  { note: 'D#4', freq: 311.13, isBlack: true },
  { note: 'E4', freq: 329.63, isBlack: false },
  { note: 'F4', freq: 349.23, isBlack: false },
  { note: 'F#4', freq: 369.99, isBlack: true },
  { note: 'G4', freq: 392.0, isBlack: false },
  { note: 'G#4', freq: 415.3, isBlack: true },
  { note: 'A4', freq: 440.0, isBlack: false },
  { note: 'A#4', freq: 466.16, isBlack: true },
  { note: 'B4', freq: 493.88, isBlack: false },
  { note: 'C5', freq: 523.25, isBlack: false },
];

export function PianoKeyboard() {
  const { noteOn, noteOff, setParam } = useSynthStore();
  const [activeNote, setActiveNote] = useState<string | null>(null);
  const [isSustain, setIsSustain] = useState(false);

  const handleNoteOn = (note: string, freq: number) => {
    setActiveNote(note);
    setParam('oscillator', 'frequency', freq);
    noteOn(freq);
  };

  const handleNoteOff = () => {
    if (!isSustain) {
      setActiveNote(null);
      noteOff();
    }
  };

  const toggleSustain = () => {
    const newSustain = !isSustain;
    setIsSustain(newSustain);
    if (!newSustain && activeNote) {
      setActiveNote(null);
      noteOff();
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
          <input
            type="checkbox"
            checked={isSustain}
            onChange={toggleSustain}
            className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-cyan-500 focus:ring-cyan-500/50"
          />
          持续播放
        </label>
      </div>

      <div className="relative flex">
        {notes.map((n) => {
          if (n.isBlack) {
            return (
              <div key={n.note} className="relative">
                <div className="w-10" />
                <div className="absolute top-0 left-0 -translate-x-1/2">
                  <PianoKey
                    note={n.note}
                    frequency={n.freq}
                    isBlack
                    isActive={activeNote === n.note}
                    onMouseDown={() => handleNoteOn(n.note, n.freq)}
                    onMouseUp={handleNoteOff}
                    onMouseLeave={handleNoteOff}
                  />
                </div>
              </div>
            );
          }
          return (
            <PianoKey
              key={n.note}
              note={n.note}
              frequency={n.freq}
              isActive={activeNote === n.note}
              onMouseDown={() => handleNoteOn(n.note, n.freq)}
              onMouseUp={handleNoteOff}
              onMouseLeave={handleNoteOff}
            />
          );
        })}
      </div>
    </div>
  );
}
