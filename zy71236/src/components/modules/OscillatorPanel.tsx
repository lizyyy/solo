import { useSynthStore } from '../../store/useSynthStore';
import { Knob } from '../ui/Knob';
import { Button } from '../ui/Button';
import { WaveformType } from '../../types/synth';
import { getParamRange } from '../../utils/validator';

const waveforms: { value: WaveformType; label: string; icon: string }[] = [
  { value: 'sine', label: '正弦', icon: '∿' },
  { value: 'square', label: '方波', icon: '⊓' },
  { value: 'sawtooth', label: '锯齿', icon: '⋀' },
  { value: 'triangle', label: '三角', icon: '△' },
];

export function OscillatorPanel() {
  const { params, setParam, warnings } = useSynthStore();

  const hasWarning = (param: string): boolean => {
    return warnings.some((w) => w.param === `oscillator.${param}`);
  };

  const freqRange = getParamRange('oscillator', 'frequency')!;
  const detuneRange = getParamRange('oscillator', 'detune')!;

  return (
    <div className="module-panel p-4 rounded-xl border border-cyan-500/30 bg-gray-900/80 backdrop-blur-sm">
      <h3 className="text-cyan-400 font-bold text-sm mb-4 tracking-widest uppercase flex items-center gap-2">
        <span className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
        OSCILLATOR 振荡器
      </h3>

      <div className="flex flex-wrap gap-4 justify-center mb-4">
        <div className="flex gap-1 bg-gray-800/50 rounded-lg p-1 border border-gray-700">
          {waveforms.map((w) => (
            <Button
              key={w.value}
              size="sm"
              variant={params.oscillator.waveform === w.value ? 'primary' : 'ghost'}
              active={params.oscillator.waveform === w.value}
              onClick={() => setParam('oscillator', 'waveform', w.value)}
              className="flex flex-col items-center gap-0.5 px-3 py-2 min-w-[50px]"
            >
              <span className="text-lg">{w.icon}</span>
              <span className="text-[10px]">{w.label}</span>
            </Button>
          ))}
        </div>
      </div>

      <div className="flex justify-center gap-6">
        <Knob
          label="频率"
          value={params.oscillator.frequency}
          min={freqRange.min}
          max={freqRange.max}
          onChange={(v) => setParam('oscillator', 'frequency', v)}
          unit="Hz"
          decimals={0}
          isLogScale
          warning={hasWarning('frequency')}
          size="lg"
        />

        <Knob
          label="失谐"
          value={params.oscillator.detune}
          min={detuneRange.min}
          max={detuneRange.max}
          onChange={(v) => setParam('oscillator', 'detune', v)}
          unit="¢"
          decimals={0}
          warning={hasWarning('detune')}
          size="lg"
        />
      </div>
    </div>
  );
}
