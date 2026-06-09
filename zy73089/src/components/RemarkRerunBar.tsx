import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Repeat, Download, Loader2, FileJson, FileSpreadsheet, Pencil } from 'lucide-react';
import { useChecklistStore } from '@/store/checklistStore';
import { exportBatch } from '@/utils/exporter';
import type { ExportFormat } from '@/shared/types';

export function RemarkRerunBar() {
  const navigate = useNavigate();
  const currentBatchId = useChecklistStore((s) => s.currentBatchId);
  const batches = useChecklistStore((s) => s.batches);
  const rerunBatch = useChecklistStore((s) => s.rerunBatch);
  const saveSnapshot = useChecklistStore((s) => s.saveSnapshot);

  const [remark, setRemark] = useState('');
  const [running, setRunning] = useState(false);

  const batch = currentBatchId ? batches[currentBatchId] : null;

  const handleRerun = () => {
    if (!batch || running) return;
    const text = remark.trim() || '（无追加备注）';
    setRunning(true);
    setTimeout(() => {
      const newId = rerunBatch(batch.batchId, text);
      setRemark('');
      setRunning(false);
      if (newId) {
        navigate(`/checklist/${newId}`);
      }
    }, 650);
  };

  const handleExport = (format: ExportFormat) => {
    if (!batch) return;
    const snap = exportBatch(batch, format);
    saveSnapshot(snap);
  };

  const disabled = !batch;

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm md:flex-row">
      <div className="flex-1">
        <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
          <Pencil className="h-3.5 w-3.5 text-blue-500" />
          补备注（重跑时自动追加到每条备注和批次总备注里）
        </div>
        <textarea
          className="h-14 w-full resize-none rounded-md border border-slate-200 bg-slate-50/50 p-2 text-xs text-slate-700 placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-200"
          placeholder="例：已与监理王工复核，C-Beam-012 实际按3层施工，后续补设计变更单…"
          value={remark}
          onChange={(e) => setRemark(e.target.value)}
          disabled={disabled}
        />
      </div>

      <div className="flex flex-col justify-between gap-2 md:items-end">
        <div className="flex gap-2">
          <button
            onClick={() => handleExport('json')}
            disabled={disabled}
            className="flex items-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 transition-all hover:border-slate-400 hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white"
          >
            <FileJson className="h-3.5 w-3.5 text-slate-500" /> 导出 JSON
          </button>
          <button
            onClick={() => handleExport('csv')}
            disabled={disabled}
            className="flex items-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 transition-all hover:border-slate-400 hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" /> 导出 CSV
          </button>
        </div>
        <button
          onClick={handleRerun}
          disabled={disabled || running}
          className="flex items-center justify-center gap-1.5 rounded-md border-2 border-blue-600 bg-gradient-to-b from-blue-500 to-blue-600 px-4 py-2 text-xs font-bold text-white shadow-md transition-all hover:from-blue-600 hover:to-blue-700 active:translate-y-px disabled:from-slate-300 disabled:to-slate-400 disabled:border-slate-400"
        >
          {running ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Repeat className="h-3.5 w-3.5" />
          )}
          补备注后重跑 · 生成新批次
        </button>
      </div>
    </div>
  );
}
