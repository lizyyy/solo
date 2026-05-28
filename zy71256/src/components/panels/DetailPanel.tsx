import { useMemo } from 'react';
import { X } from 'lucide-react';
import { useChipStore } from '@/store/chipStore';
import { useSelectionStore } from '@/store/selectionStore';

const SIGNAL_TYPE_LABELS: Record<string, string> = {
  power: '电源',
  ground: '地',
  signal: '信号',
  clock: '时钟',
  reset: '复位',
};

function formatFrequency(hz: number): string {
  if (hz >= 1e9) return `${(hz / 1e9).toFixed(2)} GHz`;
  if (hz >= 1e6) return `${(hz / 1e6).toFixed(2)} MHz`;
  if (hz >= 1e3) return `${(hz / 1e3).toFixed(2)} kHz`;
  return `${hz} Hz`;
}

export default function DetailPanel() {
  const selectedPinId = useSelectionStore((s) => s.selectedPinId);
  const selectPin = useSelectionStore((s) => s.selectPin);
  const pins = useChipStore((s) => s.pins);
  const voltageDomains = useChipStore((s) => s.voltageDomains);
  const conflicts = useChipStore((s) => s.conflicts);

  const pin = useMemo(
    () => pins.find((p) => p.id === selectedPinId) ?? null,
    [pins, selectedPinId]
  );

  const domain = useMemo(
    () =>
      pin
        ? voltageDomains.find((vd) => vd.id === pin.voltageDomainId) ?? null
        : null,
    [pin, voltageDomains]
  );

  const pinConflicts = useMemo(
    () =>
      pin
        ? conflicts.filter((c) => c.pinIds.includes(pin.id))
        : [],
    [pin, conflicts]
  );

  const isOpen = pin !== null;

  return (
    <div
      className={`fixed bottom-0 left-64 right-72 bg-black/70 backdrop-blur-md border-t border-white/5 z-30 transition-transform duration-300 ${
        isOpen ? 'translate-y-0' : 'translate-y-full'
      }`}
      style={{ maxHeight: '12rem', background: '#0a0e17b3' }}
    >
      {pin && (
        <div className="overflow-y-auto" style={{ maxHeight: '12rem' }}>
          <div className="flex items-center justify-between px-4 py-2 border-b border-white/5">
            <span className="text-xs text-white/50 tracking-wide">
              引脚详情
            </span>
            <button
              onClick={() => selectPin(null)}
              className="p-1 rounded hover:bg-white/10 text-white/50 hover:text-white transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-x-6 gap-y-2 px-4 py-3">
            <div>
              <div className="text-[10px] text-white/30 mb-0.5">引脚编号</div>
              <div className="text-sm font-mono text-white">
                {pin.name}
              </div>
            </div>

            <div>
              <div className="text-[10px] text-white/30 mb-0.5">信号类型</div>
              <div className="text-sm font-mono text-cyan-300">
                {SIGNAL_TYPE_LABELS[pin.signalType] ?? pin.signalType}
              </div>
            </div>

            <div>
              <div className="text-[10px] text-white/30 mb-0.5">电压域</div>
              {domain && (
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: domain.color }}
                  />
                  <span className="text-sm font-mono text-white">
                    {domain.name}
                  </span>
                  <span
                    className="text-xs font-mono"
                    style={{ color: domain.color }}
                  >
                    {domain.nominalVoltage}V
                  </span>
                </div>
              )}
            </div>

            <div>
              <div className="text-[10px] text-white/30 mb-0.5">信号频率</div>
              <div className="text-sm font-mono text-white">
                {formatFrequency(pin.signalFrequency)}
              </div>
            </div>

            <div className="col-span-2">
              <div className="text-[10px] text-white/30 mb-0.5">复用功能</div>
              <div className="flex flex-wrap gap-1.5">
                {pin.functions.map((fn) => (
                  <span
                    key={fn.id}
                    className={`text-xs font-mono px-1.5 py-0.5 rounded ${
                      fn.isDefault
                        ? 'bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-500/40'
                        : 'bg-white/5 text-white/60'
                    }`}
                  >
                    {fn.functionName}
                  </span>
                ))}
              </div>
            </div>

            {pinConflicts.length > 0 && (
              <div className="col-span-3">
                <div className="text-[10px] text-white/30 mb-0.5">冲突状态</div>
                <div className="flex flex-wrap gap-1.5">
                  {pinConflicts.map((c) => (
                    <span
                      key={c.id}
                      className={`text-xs font-mono px-1.5 py-0.5 rounded ${
                        c.severity === 'error'
                          ? 'bg-red-500/20 text-red-400'
                          : 'bg-amber-500/20 text-amber-400'
                      }`}
                    >
                      {c.type === 'voltage_mixed'
                        ? '电压混接'
                        : c.type === 'pin_mux'
                        ? '复用冲突'
                        : '标签遮挡'}
                      {' · '}
                      {c.severity === 'error' ? 'error' : 'warning'}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
