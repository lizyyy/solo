import { Music, Guitar, Drum } from 'lucide-react';
import { instrumentList } from '@/data/instruments';
import type { InstrumentName } from '@/types';

interface InstrumentSelectorProps {
  current: InstrumentName;
  onChange: (name: InstrumentName) => void;
}

const instrumentIcons: Record<InstrumentName, typeof Music> = {
  '古琴': Music,
  '琵琶': Guitar,
  '提琴': Drum,
};

export function InstrumentSelector({ current, onChange }: InstrumentSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      {instrumentList.map((name) => {
        const Icon = instrumentIcons[name];
        const isActive = current === name;

        return (
          <button
            key={name}
            onClick={() => onChange(name)}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg
              transition-all duration-300 font-mono text-sm
              ${isActive
                ? 'bg-walnut-800 text-bronze-400 shadow-bronze-glow'
                : 'bg-charcoal-800 text-gray-400 hover:bg-charcoal-700 hover:text-gray-200'
              }
            `}
          >
            <Icon size={16} className={isActive ? 'text-bronze-400' : 'text-gray-500'} />
            <span>{name}</span>
          </button>
        );
      })}
    </div>
  );
}
