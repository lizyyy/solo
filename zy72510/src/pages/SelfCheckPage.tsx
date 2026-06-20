import { useEffect, useState } from 'react';
import { Download, Play } from 'lucide-react';
import { api } from '@/api/client';
import { useAppStore } from '@/store/app';
import SelfCheckCard from '@/components/SelfCheckCard';
import type { GrayBatch } from '../../shared/types';

export default function SelfCheckPage() {
  const { currentBatchId, setCurrentBatchId, selfCheckReport, setSelfCheckReport } = useAppStore();
  const [batches, setBatches] = useState<GrayBatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);

  useEffect(() => {
    api.getBatches().then(setBatches);
  }, []);

  async function handleSelfCheck() {
    if (!currentBatchId) return;
    setLoading(true);
    try {
      const report = await api.runSelfCheck(currentBatchId);
      setSelfCheckReport(report);
    } finally {
      setLoading(false);
    }
  }

  async function handleExport(format: 'json' | 'csv') {
    if (!currentBatchId) return;
    setExporting(format);
    try {
      const blob = await api.exportBatch(currentBatchId, format);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${currentBatchId}-export.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-white">导出与自检</h2>
        <div className="flex items-center gap-3">
          <select
            value={currentBatchId ?? ''}
            onChange={(e) => {
              setCurrentBatchId(e.target.value || null);
              setSelfCheckReport(null);
            }}
            className="px-3 py-1.5 bg-slate-800 border border-white/10 rounded-sm text-sm text-white focus:outline-none focus:border-white/20"
          >
            <option value="">选择批次...</option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>{b.name} ({b.id})</option>
            ))}
          </select>
        </div>
      </div>

      {!currentBatchId ? (
        <div className="flex items-center justify-center h-64 text-slate-500 text-sm">
          请先选择一个批次
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleSelfCheck}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-sm px-4 py-2 font-medium text-sm bg-purple-500 hover:bg-purple-400 text-white disabled:opacity-50 transition-colors"
            >
              <Play size={14} />
              {loading ? '自检中...' : '执行自检'}
            </button>
            <button
              onClick={() => handleExport('json')}
              disabled={!!exporting}
              className="inline-flex items-center gap-2 rounded-sm px-4 py-2 font-medium text-sm bg-slate-700 hover:bg-slate-600 text-white disabled:opacity-50 transition-colors"
            >
              <Download size={14} />
              {exporting === 'json' ? '导出中...' : '导出 JSON'}
            </button>
            <button
              onClick={() => handleExport('csv')}
              disabled={!!exporting}
              className="inline-flex items-center gap-2 rounded-sm px-4 py-2 font-medium text-sm bg-slate-700 hover:bg-slate-600 text-white disabled:opacity-50 transition-colors"
            >
              <Download size={14} />
              {exporting === 'csv' ? '导出中...' : '导出 CSV'}
            </button>
          </div>

          {selfCheckReport ? (
            <div className="space-y-4">
              <div className={`rounded-sm p-4 border ${selfCheckReport.overallPass ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-white">自检结果</div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      生成时间：{new Date(selfCheckReport.generatedAt).toLocaleString('zh-CN')}
                    </div>
                  </div>
                  <span
                    className={`text-xs px-2.5 py-1 rounded-sm font-medium ${
                      selfCheckReport.overallPass
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : 'bg-red-500/15 text-red-400 border border-red-500/30'
                    }`}
                  >
                    {selfCheckReport.overallPass ? '全部通过' : '存在问题'}
                  </span>
                </div>
              </div>
              <div className="grid gap-3">
                {selfCheckReport.items.map((item) => (
                  <SelfCheckCard key={item.key} item={item} />
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 text-slate-500 text-sm">
              点击「执行自检」开始检查
            </div>
          )}
        </div>
      )}
    </div>
  );
}
