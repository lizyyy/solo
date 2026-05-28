import { useState } from 'react';
import { Cpu, Download } from 'lucide-react';
import { useChipStore } from '@/store/chipStore';
import { exportReviewReport } from '@/utils/reportExporter';

export default function ExportToolbar() {
  const chip = useChipStore((s) => s.chip);
  const pins = useChipStore((s) => s.pins);
  const voltageDomains = useChipStore((s) => s.voltageDomains);
  const conflicts = useChipStore((s) => s.conflicts);
  const [batchId, setBatchId] = useState('');
  const [touched, setTouched] = useState(false);

  const handleExport = () => {
    if (!batchId.trim()) {
      setTouched(true);
      return;
    }
    exportReviewReport(chip, pins, voltageDomains, conflicts, batchId.trim());
  };

  const showWarning = touched && !batchId.trim();

  return (
    <div
      className="fixed top-0 left-64 right-72 h-14 bg-black/60 backdrop-blur-md border-b border-white/5 z-30 flex items-center px-4 gap-4"
      style={{ background: '#0a0e17cc' }}
    >
      <div className="flex items-center gap-2 shrink-0">
        <Cpu className="w-4 h-4 text-cyan-400" />
        <span className="text-sm font-mono text-white tracking-wide">
          {chip.name}
        </span>
        <span className="text-xs text-white/30 font-mono">
          {chip.type} · {chip.pinCount}P
        </span>
      </div>

      <div className="flex-1 flex justify-center">
        <input
          type="text"
          value={batchId}
          onChange={(e) => {
            setBatchId(e.target.value);
            if (e.target.value.trim()) setTouched(false);
          }}
          onBlur={() => setTouched(true)}
          placeholder="输入批次号"
          className={`w-56 h-8 px-3 rounded-md bg-white/5 border text-sm font-mono text-white placeholder:text-white/20 outline-none transition-colors ${
            showWarning
              ? 'border-amber-500/60 focus:border-amber-400'
              : 'border-white/10 focus:border-cyan-500/50'
          }`}
        />
      </div>

      <button
        onClick={handleExport}
        className="flex items-center gap-1.5 h-8 px-4 rounded-md bg-cyan-500/15 text-cyan-400 text-sm hover:bg-cyan-500/25 transition-colors border border-cyan-500/30"
      >
        <Download className="w-3.5 h-3.5" />
        导出报告
      </button>
    </div>
  );
}
