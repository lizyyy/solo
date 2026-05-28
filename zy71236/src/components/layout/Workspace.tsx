import { OscillatorPanel } from '../modules/OscillatorPanel';
import { FilterPanel } from '../modules/FilterPanel';
import { EnvelopePanel } from '../modules/EnvelopePanel';
import { LFOPanel } from '../modules/LFOPanel';
import { PianoKeyboard } from '../keyboard/PianoKeyboard';
import { VUMeter } from '../visualizers/VUMeter';
import { Knob } from '../ui/Knob';
import { useSynthStore } from '../../store/useSynthStore';
import { getParamRange } from '../../utils/validator';

export function Workspace() {
  const { params, setParam, warnings } = useSynthStore();

  const hasWarning = (param: string): boolean => {
    return warnings.some((w) => w.param === `master.${param}`);
  };

  const volumeRange = getParamRange('master', 'volume')!;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <OscillatorPanel />
        <FilterPanel />
        <EnvelopePanel />
        <LFOPanel />
      </div>

      <div className="module-panel p-6 rounded-xl border border-gray-700 bg-gray-900/80 backdrop-blur-sm">
        <h3 className="text-gray-300 font-bold text-sm mb-6 tracking-widest uppercase flex items-center gap-2">
          <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" />
          试听控制
        </h3>

        <div className="flex flex-wrap items-center justify-center gap-8">
          <div className="flex flex-col items-center gap-3">
            <Knob
              label="主音量"
              value={params.master.volume}
              min={volumeRange.min}
              max={volumeRange.max}
              onChange={(v) => setParam('master', 'volume', v)}
              decimals={2}
              warning={hasWarning('volume')}
              size="lg"
            />
            <div className="w-32">
              <VUMeter width={128} height={20} />
            </div>
          </div>

          <div className="h-32 w-px bg-gray-700" />

          <PianoKeyboard />
        </div>
      </div>
    </div>
  );
}
