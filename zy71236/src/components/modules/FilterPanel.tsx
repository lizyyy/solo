import { useSynthStore } from '../../store/useSynthStore';
import { Knob } from '../ui/Knob';
import { Button } from '../ui/Button';
import { FilterResponse } from '../visualizers/FilterResponse';
import { FilterType } from '../../types/synth';
import { getParamRange } from '../../utils/validator';

const filterTypes: { value: FilterType; label: string; short: string }[] = [
  { value: 'lowpass', label: '低通', short: 'LP' },
  { value: 'highpass', label: '高通', short: 'HP' },
  { value: 'bandpass', label: '带通', short: 'BP' },
  { value: 'notch', label: '陷波', short: 'NT' },
];

export function FilterPanel() {
  const { params, setParam, warnings } = useSynthStore();

  const hasWarning = (param: string): boolean => {
    return warnings.some((w) => w.param === `filter.${param}`);
  };

  const cutoffRange = getParamRange('filter', 'cutoff')!;
  const resonanceRange = getParamRange('filter', 'resonance')!;
  const envAmountRange = getParamRange('filter', 'envelopeAmount')!;

  return (
    <div className="module-panel p-4 rounded-xl border border-pink-500/30 bg-gray-900/80 backdrop-blur-sm">
      <h3 className="text-pink-400 font-bold text-sm mb-4 tracking-widest uppercase flex items-center gap-2">
        <span className="w-2 h-2 bg-pink-400 rounded-full animate-pulse" />
        FILTER 滤波器
      </h3>

      <div className="flex flex-wrap gap-4 justify-center mb-4">
        <div className="flex gap-1 bg-gray-800/50 rounded-lg p-1 border border-gray-700">
          {filterTypes.map((f) => (
            <Button
              key={f.value}
              size="sm"
              variant={params.filter.type === f.value ? 'primary' : 'ghost'}
              active={params.filter.type === f.value}
              onClick={() => setParam('filter', 'type', f.value)}
              className="flex flex-col items-center gap-0.5 px-3 py-2 min-w-[50px]"
              style={params.filter.type === f.value ? { borderColor: '#FF00AA', color: '#FF00AA' } : {}}
            >
              <span className="text-sm font-bold">{f.short}</span>
              <span className="text-[10px]">{f.label}</span>
            </Button>
          ))}
        </div>
      </div>

      <div className="flex justify-center mb-4">
        <FilterResponse filter={params.filter} width={220} height={60} />
      </div>

      <div className="flex justify-center gap-4">
        <Knob
          label="截止频率"
          value={params.filter.cutoff}
          min={cutoffRange.min}
          max={cutoffRange.max}
          onChange={(v) => setParam('filter', 'cutoff', v)}
          unit="Hz"
          decimals={0}
          isLogScale
          warning={hasWarning('cutoff')}
        />

        <Knob
          label="谐振"
          value={params.filter.resonance}
          min={resonanceRange.min}
          max={resonanceRange.max}
          onChange={(v) => setParam('filter', 'resonance', v)}
          decimals={1}
          warning={hasWarning('resonance')}
        />

        <Knob
          label="包络量"
          value={params.filter.envelopeAmount}
          min={envAmountRange.min}
          max={envAmountRange.max}
          onChange={(v) => setParam('filter', 'envelopeAmount', v)}
          decimals={2}
          warning={hasWarning('envelopeAmount')}
        />
      </div>
    </div>
  );
}
