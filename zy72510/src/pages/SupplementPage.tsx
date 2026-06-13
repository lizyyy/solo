import { useEffect, useState } from 'react';
import { api } from '@/api/client';
import type { BatchOverview, GrayBatch, Label } from '../../shared/types';

const PRESET = [
  { id: 'SUP001', content: '新人专享9.9元包邮，限量1000份，手慢无', confidenceA: 0.62, confidenceB: 0.58, labelA: 'pass' as Label, labelB: 'uncertain' as Label, grayLabel: 'uncertain' as Label },
  { id: 'SUP002', content: '绝对全网最低价，差价双倍返还，假一赔十', confidenceA: 0.33, confidenceB: 0.28, labelA: 'reject' as Label, labelB: 'reject' as Label, grayLabel: 'reject' as Label, annotatorNote: '含绝对化用语' },
  { id: 'SUP003', content: '专柜正品，支持验货，七天无理由退换货', confidenceA: 0.89, confidenceB: 0.91, labelA: 'pass' as Label, labelB: 'pass' as Label, grayLabel: 'pass' as Label },
];

export default function SupplementPage() {
  const [batches, setBatches] = useState<GrayBatch[]>([]);
  const [batchId, setBatchId] = useState('');
  const [ov, setOv] = useState<BatchOverview | null>(null);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.getBatches().then(setBatches);
  }, []);

  useEffect(() => {
    if (batchId) {
      api.getBatch(batchId).then((res) => setOv(res.overview));
    }
  }, [batchId]);

  async function handleSupp() {
    if (!batchId) {
      setMsg("请先选择批次");
      return;
    }
    setLoading(true);
    setMsg("");
    try {
      const res = await api.supplementSamples({
        batchId,
        samples: PRESET.map((s) => ({
          id: s.id,
          content: s.content,
          confidenceA: s.confidenceA,
          confidenceB: s.confidenceB,
          labelA: s.labelA,
          labelB: s.labelB,
          grayLabel: s.grayLabel,
          annotatorNote: s.annotatorNote,
        })),
      });
      setMsg("补录完成：新增" + res.added + "条，跳过" + res.skipped + "条");
      const up = await api.getBatch(batchId);
      setOv(up.overview);
    } catch (e) {
      setMsg("补录失败：" + (e instanceof Error ? e.message : "未知错误"));
    } finally {
      setLoading(false);
    }
  }

  async function handleRecalc() {
    if (!batchId) {
      setMsg("请先选择批次");
      return;
    }
    setLoading(true);
    setMsg("");
    try {
      const res = await api.recalcBatch(batchId);
      setOv(res);
      setMsg("重算完成");
    } catch (e) {
      setMsg("重算失败：" + (e instanceof Error ? e.message : "未知错误"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-white">样本补录与重算</h2>
        <select
          value={batchId}
          onChange={(e) => setBatchId(e.target.value)}
          className="px-3 py-1.5 bg-slate-800 border border-white/10 rounded-sm text-sm text-white focus:outline-none focus:border-white/20"
        >
          <option value="">选择批次</option>
          {batches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </div>

      {ov && (
        <div className="bg-slate-900/60 border border-white/10 rounded-md p-5 mb-6">
          <div className="text-sm text-slate-400 mb-4">批次概览</div>
          <div className="grid grid-cols-4 gap-4">
            <div>
              <div className="text-xs text-slate-500 mb-1">总样本</div>
              <div className="text-xl font-medium text-white">{ov.totalSamples}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">低置信</div>
              <div className="text-xl font-medium text-amber-400">{ov.lowConfidenceCount}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">冲突</div>
              <div className="text-xl font-medium text-rose-400">{ov.conflictCount}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">已审核</div>
              <div className="text-xl font-medium text-emerald-400">{ov.reviewedCount}</div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-slate-900/60 border border-white/10 rounded-md p-5">
        <div className="text-sm text-slate-400 mb-4">操作</div>
        <div className="flex gap-3 mb-4">
          <button
            onClick={handleSupp}
            disabled={loading}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-500/50 text-slate-900 font-medium text-sm rounded-sm transition-colors"
          >
            {loading ? "处理中..." : "补录样本"}
          </button>
          <button
            onClick={handleRecalc}
            disabled={loading}
            className="px-4 py-2 bg-purple-500 hover:bg-purple-600 disabled:bg-purple-500/50 text-white font-medium text-sm rounded-sm transition-colors"
          >
            {loading ? "处理中..." : "重算置信度"}
          </button>
        </div>
        {msg && (
          <div className="text-sm text-slate-300 bg-slate-800/60 border border-white/10 rounded-sm px-3 py-2">
            {msg}
          </div>
        )}
      </div>
    </div>
  );
}
