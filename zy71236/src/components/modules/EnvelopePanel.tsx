import { useSynthStore } from '../../store/useSynthStore';
import { Slider } from '../ui/Slider';
import { EnvelopeGraph } from '../visualizers/EnvelopeGraph';
import { getParamRange } from '../../utils/validator';

export function EnvelopePanel() {
  const { params, setParam, warnings } = useSynthStore();

  const hasWarning = (param: string): boolean => {
    return warnings.some((w) => w.param === `envelope.${param}`);
  };

  const attackRange = getParamRange('envelope', 'attack')!;
  const decayRange = getParamRange('envelope', 'decay')!;
  const sustainRange = getParamRange('envelope', 'sustain')!;
  const releaseRange = getParamRange('envelope', 'release')!;

  return (
    <div className="module-panel p-4 rounded-xl border border-green-500/30 bg-gray-900/80 backdrop-blur-sm">
      <h3 className="text-green-400 font-bold text-sm mb-4 tracking-widest uppercase flex items-center gap-2">
        <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
        ENVELOPE 包络
      </h3>

      <div className="flex justify-center mb-4">
        <EnvelopeGraph envelope={params.envelope} width={240} height={70} />
      </div>

      <div className="flex justify-center gap-6">
        <Slider
          label="ATTACK"
          value={params.envelope.attack}
          min={attackRange.min}
          max={attackRange.max}
          onChange={(v) => setParam('envelope', 'attack', v)}
          unit="s"
          decimals={3}
          warning={hasWarning('attack')}
        />

        <Slider
          label="DECAY"
          value={params.envelope.decay}
          min={decayRange.min}
          max={decayRange.max}
          onChange={(v) => setParam('envelope', 'decay', v)}
          unit="s"
          decimals={3}
          warning={hasWarning('decay')}
        />

        <Slider
          label="SUSTAIN"
          value={params.envelope.sustain}
          min={sustainRange.min}
          max={sustainRange.max}
          onChange={(v) => setParam('envelope', 'sustain', v)}
          decimals={2}
          warning={hasWarning('sustain')}
        />

        <Slider
          label="RELEASE"
          value={params.envelope.release}
          min={releaseRange.min}
          max={releaseRange.max}
          onChange={(v) => setParam('envelope', 'release', v)}
          unit="s"
          decimals={3}
          warning={hasWarning('release')}
        />
      </div>
    </div>
  );
}
