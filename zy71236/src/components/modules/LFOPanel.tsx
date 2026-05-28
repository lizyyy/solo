import { useSynthStore } from '../../store/useSynthStore';
import { Knob } from '../ui/Knob';
import { Button } from '../ui/Button';
import { WaveformType, LFOTargetType } from '../../types/synth';
import { getParamRange } from '../../utils/validator';

const waveforms: { value: WaveformType; label: string; icon: string }[] = [
  { value: 'sine', label: '正弦', icon: '∿' },
  { value: 'square', label: '方波', icon: '⊓' },
  { value: 'sawtooth', label: '锯齿', icon: '⋀' },
  { value: 'triangle', label: '三角', icon: '△' },
];

const targets: { value: LFOTargetType; label: string; icon: string }[] = [
  { value: 'volume', label: '音量', icon: '🔊' },
  { value: 'pitch', label: '音高', icon: '🎵' },
  { value: 'filter', label: '滤波', icon: '📊' },
];

export function LFOPanel() {
  const { params, setParam, warnings } = useSynthStore();

  const hasWarning = (param: string): boolean => {
    return warnings.some((w) => w.param === `lfo.${param}`);
  };

  const rateRange = getParamRange('lfo', 'rate')!;
  const depthRange = getParamRange('lfo', 'depth')!;

  return (
    <div className="module-panel p-4 rounded-xl border border-yellow-500/30 bg-gray-900/80 backdrop-blur-sm">
      <h3 className="text-yellow-400 font-bold text-sm mb-4 tracking-widest uppercase flex items-center gap-2">
        <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
        LFO 低频振荡器
      </h3>

      <div className="flex flex-wrap gap-3 justify-center mb-4">
        <div className="flex gap-1 bg-gray-800/50 rounded-lg p-1 border border-gray-700">
          {waveforms.map((w) => (
            <Button
              key={w.value}
              size="sm"
              variant={params.lfo.waveform === w.value ? 'primary' : 'ghost'}
              active={params.lfo.waveform === w.value}
              onClick={() => setParam('lfo', 'waveform', w.value)}
              className="flex flex-col items-center gap-0.5 px-2 py-1.5 min-w-[40px]"
              style={params.lfo.waveform === w.value ? { borderColor: '#eab308', color: '#eab308' } : {}}
            >
              <span className="text-base">{w.icon}</span>
            </Button>
          ))}
        </div>

        <div className="flex gap-1 bg-gray-800/50 rounded-lg p-1 border border-gray-700">
          {targets.map((t) => (
            <Button
              key={t.value}
              size="sm"
              variant={params.lfo.target === t.value ? 'primary' : 'ghost'}
              active={params.lfo.target === t.value}
              onClick={() => setParam('lfo', 'target', t.value)}
              className="flex flex-col items-center gap-0.5 px-2 py-1.5 min-w-[40px]"
              style={params.lfo.target === t.value ? { borderColor: '#eab308', color: '#eab308' } : {}}
            >
              <span className="text-base">{t.icon}</span>
              <span className="text-[9px]">{t.label}</span>
            </Button>
          ))}
        </div>
      </div>

      <div className="flex justify-center gap-6">
        <Knob
          label="速率"
          value={params.lfo.rate}
          min={rateRange.min}
          max={rateRange.max}
          onChange={(v) => setParam('lfo', 'rate', v)}
          unit="Hz"
          decimals={1}
          warning={hasWarning('rate')}
          size="lg"
        />

        <Knob
          label="深度"
          value={params.lfo.depth}
          min={depthRange.min}
          max={depthRange.max}
          onChange={(v) => setParam('lfo', 'depth', v)}
          decimals={2}
          warning={hasWarning('depth')}
          size="lg"
        />
      </div>
    </div>
  );
}
