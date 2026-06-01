import { ChevronLeft, ChevronRight } from 'lucide-react';

interface TimelineProps {
  currentRound: number;
  totalRounds: number;
  onRoundChange: (round: number) => void;
  disabled?: boolean;
}

export function Timeline({ currentRound, totalRounds, onRoundChange, disabled = false }: TimelineProps) {
  const rounds = Array.from({ length: totalRounds }, (_, i) => i + 1);

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-serif text-lg font-semibold">对局回放</h3>
        <span className="text-sm text-neutral-500">
          第 {currentRound} / {totalRounds} 回合
        </span>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={() => onRoundChange(currentRound - 1)}
          disabled={disabled || currentRound <= 1}
          className="p-2 rounded hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft size={20} />
        </button>

        <div className="flex-1 relative">
          <div className="absolute top-1/2 left-0 right-0 h-1 bg-neutral-200 -translate-y-1/2 rounded" />
          <div
            className="absolute top-1/2 left-0 h-1 bg-primary-500 -translate-y-1/2 rounded transition-all"
            style={{ width: `${((currentRound - 1) / (totalRounds - 1 || 1)) * 100}%` }}
          />

          <div className="relative flex justify-between">
            {rounds.map((round) => (
              <button
                key={round}
                onClick={() => !disabled && onRoundChange(round)}
                disabled={disabled}
                className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all ${
                  round === currentRound
                    ? 'bg-primary-500 text-white scale-125 shadow-lg'
                    : round < currentRound
                    ? 'bg-primary-300 text-white'
                    : 'bg-neutral-200 text-neutral-500 hover:bg-neutral-300'
                } ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
              >
                {round}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => onRoundChange(currentRound + 1)}
          disabled={disabled || currentRound >= totalRounds}
          className="p-2 rounded hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight size={20} />
        </button>
      </div>
    </div>
  );
}
