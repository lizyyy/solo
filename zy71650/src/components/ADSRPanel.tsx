import { useState, useCallback } from 'react';
import { Save, Play, ChevronDown } from 'lucide-react';
import { useAppStore } from '@/store';
import type { FittingRecord, ADSRParams } from '@/types';

const INSTRUMENT_LABELS = [
  'Bass', 'Lead', 'Pad', 'Strings', 'Brass', 'Keys', 'FX', 'Percussion', 'Other',
];

type ADSRKey = keyof ADSRParams;

const PARAM_CONFIG: { key: ADSRKey; label: string; unit: string; max: number }[] = [
  { key: 'attack', label: 'Attack', unit: 'ms', max: 5000 },
  { key: 'decay', label: 'Decay', unit: 'ms', max: 5000 },
  { key: 'sustain', label: 'Sustain', unit: '%', max: 100 },
  { key: 'release', label: 'Release', unit: 'ms', max: 10000 },
];

function diffColor(raw: number, corrected: number): string {
  if (raw === 0 && corrected === 0) return 'text-synth-accent';
  const pct = Math.abs(corrected - raw) / (raw || 1);
  if (pct <= 0.1) return 'text-synth-accent';
  if (pct <= 0.3) return 'text-synth-amber';
  return 'text-red-400';
}

interface JudgmentDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (judgment: string) => void;
}

function JudgmentDialog({ open, onClose, onConfirm }: JudgmentDialogProps) {
  const [text, setText] = useState('');

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-synth-card border border-synth-border rounded-xl p-6 w-96 space-y-4">
        <h3 className="text-white font-mono text-sm">修正判定说明</h3>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="输入修正理由..."
          className="w-full h-24 bg-synth-bg border border-synth-border rounded-lg p-3 text-sm text-white resize-none focus:outline-none focus:border-synth-accent"
        />
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-synth-muted hover:text-white transition-colors"
          >
            取消
          </button>
          <button
            onClick={() => { onConfirm(text); setText(''); onClose(); }}
            className="px-4 py-2 rounded-lg text-sm bg-synth-accent text-black font-mono hover:shadow-glow-green transition-shadow"
          >
            确认
          </button>
        </div>
      </div>
    </div>
  );
}

interface ADSRPanelProps {
  record: FittingRecord | null;
}

export default function ADSRPanel({ record }: ADSRPanelProps) {
  const [instrumentLabel, setInstrumentLabel] = useState('Other');
  const [notes, setNotes] = useState('');
  const [corrected, setCorrected] = useState<ADSRParams | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const fitADSR = useAppStore((s) => s.fitADSR);
  const updateCorrected = useAppStore((s) => s.updateCorrected);
  const isFitting = useAppStore((s) => s.isFitting);
  const audioFile = useAppStore((s) => s.audioFile);

  const handleCorrectedChange = useCallback((key: ADSRKey, value: number) => {
    setCorrected((prev) => {
      const base = prev ?? record?.raw ?? { attack: 0, decay: 0, sustain: 0, release: 0 };
      return { ...base, [key]: value };
    });
  }, [record]);

  const handleSaveCorrected = useCallback(
    (judgment: string) => {
      if (!record || !corrected) return;
      updateCorrected(record.id, corrected, judgment);
    },
    [record, corrected, updateCorrected],
  );

  const handleFit = useCallback(() => {
    fitADSR(instrumentLabel, notes);
  }, [fitADSR, instrumentLabel, notes]);

  const versionCount = record?.notes?.length ?? 0;

  return (
    <div className="h-full overflow-y-auto space-y-4 p-1">
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="text-xs text-synth-muted font-mono pb-1">原始值</div>
        <div className="text-xs text-synth-amber font-mono pb-1">修正值</div>
        <div className="text-xs text-synth-accent font-mono pb-1">结论值</div>
      </div>

      {PARAM_CONFIG.map(({ key, label, unit, max }) => (
        <div key={key} className="space-y-1">
          <div className="text-xs text-synth-muted font-mono">{label} ({unit})</div>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-synth-bg border border-synth-border rounded-lg px-3 py-2 text-sm text-synth-muted font-mono text-right">
              {record ? record.raw[key] : '—'}
            </div>
            <div className="bg-synth-bg border border-synth-border rounded-lg px-2 py-1">
              <input
                type="number"
                min={0}
                max={max}
                value={corrected?.[key] ?? ''}
                onChange={(e) => handleCorrectedChange(key, Number(e.target.value))}
                placeholder="未修正"
                className="w-full bg-transparent text-sm font-mono text-synth-amber text-right focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <input
                type="range"
                min={0}
                max={max}
                value={corrected?.[key] ?? record?.raw[key] ?? 0}
                onChange={(e) => handleCorrectedChange(key, Number(e.target.value))}
                className="w-full h-1 accent-synth-amber mt-1"
              />
            </div>
            <div
              className={`bg-synth-bg border border-synth-border rounded-lg px-3 py-2 text-sm font-mono text-right ${
                record
                  ? corrected && diffColor(record.raw[key], corrected[key])
                  : 'text-synth-muted'
              }`}
            >
              {record ? record.conclusion[key] : '—'}
            </div>
          </div>
        </div>
      ))}

      <div className="pt-2">
        <label className="text-xs text-synth-muted font-mono block mb-1">乐器标签</label>
        <div className="relative">
          <select
            value={instrumentLabel}
            onChange={(e) => setInstrumentLabel(e.target.value)}
            className="w-full bg-synth-bg border border-synth-border rounded-lg px-3 py-2 text-sm font-mono text-white appearance-none focus:outline-none focus:border-synth-accent"
          >
            {INSTRUMENT_LABELS.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-synth-muted pointer-events-none" />
        </div>
      </div>

      <div className="pt-1">
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs text-synth-muted font-mono">备注</label>
          <span className="text-xs text-synth-muted font-mono">v{versionCount}</span>
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="添加备注..."
          className="w-full h-20 bg-synth-bg border border-synth-border rounded-lg p-3 text-sm text-white resize-none focus:outline-none focus:border-synth-accent"
        />
      </div>

      <div className="flex gap-2 pt-2">
        <button
          onClick={() => setDialogOpen(true)}
          disabled={!record || !corrected}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-mono bg-synth-card border border-synth-border text-synth-amber hover:border-synth-amber hover:shadow-glow-amber transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Save className="w-4 h-4" />
          保存修正
        </button>
        <button
          onClick={handleFit}
          disabled={!audioFile || isFitting}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-mono bg-synth-accent text-black hover:shadow-glow-green transition-shadow disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Play className="w-4 h-4" />
          {isFitting ? '拟合中...' : '拟合'}
        </button>
      </div>

      <JudgmentDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onConfirm={handleSaveCorrected}
      />
    </div>
  );
}
