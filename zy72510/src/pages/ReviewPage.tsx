import { useEffect, useState } from 'react';
import { X, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { api } from '@/api/client';
import { useAppStore } from '@/store/app';
import SampleCard from '@/components/SampleCard';
import ModelCompare from '@/components/ModelCompare';
import HistoryTimeline from '@/components/HistoryTimeline';
import type { GrayBatch, Sample } from '../../shared/types';

export default function ReviewPage() {
  const { currentBatchId, currentSampleId, drawerOpen, setCurrentBatchId, setCurrentSampleId, setDrawerOpen } = useAppStore();
  const [batches, setBatches] = useState<GrayBatch[]>([]);
  const [lowConfidenceSamples, setLowConfidenceSamples] = useState<Sample[]>([]);
  const [normalSamples, setNormalSamples] = useState<Sample[]>([]);
  const [activeSample, setActiveSample] = useState<Sample | null>(null);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.getBatches().then(setBatches);
  }, []);

  useEffect(() => {
    if (currentBatchId) {
      loadBatch(currentBatchId);
    }
  }, [currentBatchId]);

  useEffect(() => {
    if (drawerOpen && currentSampleId) {
      api.getSample(currentSampleId).then(setActiveSample);
    } else {
      setActiveSample(null);
    }
  }, [drawerOpen, currentSampleId]);

  async function loadBatch(id: string) {
    try {
      const res = await api.getBatch(id);
      setLowConfidenceSamples(res.samples.lowConfidence);
      setNormalSamples(res.samples.normal);
    } catch (e) {
      console.error(e);
    }
  }

  function handleSelect(sampleId: string) {
    setCurrentSampleId(sampleId);
    setDrawerOpen(true);
    setNote('');
  }

  async function handleReview(finalLabel: 'pass' | 'reject') {
    if (!activeSample) return;
    setLoading(true);
    try {
      await api.reviewSample(activeSample.id, {
        finalLabel,
        operator: '审核员',
        note: note.trim() || undefined,
      });
      if (currentBatchId) await loadBatch(currentBatchId);
      if (activeSample.id) {
        const updated = await api.getSample(activeSample.id);
        setActiveSample(updated);
      }
      setNote('');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-screen">
      <div className="flex-1 flex flex-col min-w-0">
        <div className="border-b border-white/10 px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">审核工作区</h2>
            <select
              value={currentBatchId ?? ''}
              onChange={(e) => setCurrentBatchId(e.target.value || null)}
              className="px-3 py-1.5 bg-slate-800 border border-white/10 rounded-sm text-sm text-white focus:outline-none focus:border-white/20"
            >
              <option value="">选择批次...</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>{b.name} ({b.id})</option>
              ))}
            </select>
          </div>
          {lowConfidenceSamples.length > 0 && (
            <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/30 rounded-sm">
              <AlertTriangle size={14} className="text-amber-400 flex-shrink-0" />
              <span className="text-xs text-amber-300">
                当前批次有 {lowConfidenceSamples.length} 条低置信度样本，请重点审核（任一模型置信度 {"<"} 60%）
              </span>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {!currentBatchId ? (
            <div className="flex items-center justify-center h-full text-slate-500 text-sm">
              请先选择一个批次
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {lowConfidenceSamples.length > 0 && (
                <div className="bg-amber-500/5">
                  <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur px-4 py-2 border-b border-white/5">
                    <span className="text-xs font-medium text-amber-400">低置信度样本（{lowConfidenceSamples.length}）</span>
                  </div>
                  {lowConfidenceSamples.map((s, i) => (
                    <div key={s.id} className={i % 2 === 1 ? 'bg-white/[0.02]' : ''}>
                      <SampleCard sample={s} onSelect={handleSelect} selected={currentSampleId === s.id} />
                    </div>
                  ))}
                </div>
              )}
              <div>
                <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur px-4 py-2 border-b border-white/5">
                  <span className="text-xs font-medium text-slate-400">正常样本（{normalSamples.length}）</span>
                </div>
                {normalSamples.map((s, i) => (
                  <div key={s.id} className={i % 2 === 1 ? 'bg-white/[0.02]' : ''}>
                    <SampleCard sample={s} onSelect={handleSelect} selected={currentSampleId === s.id} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {drawerOpen && (
        <div className="w-[520px] border-l border-white/10 bg-slate-900 flex flex-col">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <h3 className="text-sm font-medium text-white">样本详情</h3>
            <button
              onClick={() => {
                setDrawerOpen(false);
                setCurrentSampleId(null);
              }}
              className="p-1 rounded-sm text-slate-400 hover:bg-white/5 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
          </div>
          {activeSample ? (
            <div className="flex-1 overflow-y-auto">
              <div className="p-5 space-y-5">
                <div>
                  <div className="text-xs text-slate-400 mb-2">样本内容</div>
                  <p className="text-sm text-white leading-relaxed bg-slate-800/30 border border-white/5 rounded-sm p-3">
                    {activeSample.content}
                  </p>
                </div>
                <div>
                  <div className="text-xs text-slate-400 mb-2">模型对比</div>
                  <ModelCompare sample={activeSample} />
                </div>
                <div>
                  <div className="text-xs text-slate-400 mb-2">灰度判定</div>
                  <div className={`text-sm px-3 py-2 rounded-sm border inline-block font-medium ${
                    activeSample.grayLabel === 'pass' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' :
                    activeSample.grayLabel === 'reject' ? 'bg-red-500/15 text-red-400 border-red-500/30' :
                    'bg-slate-500/15 text-slate-400 border-slate-500/30'
                  }`}>
                    {activeSample.grayLabel === 'pass' ? '通过' : activeSample.grayLabel === 'reject' ? '拒绝' : '待定'}
                  </div>
                </div>
                {activeSample.annotatorNote && (
                  <div>
                    <div className="text-xs text-slate-400 mb-2">标注员留言</div>
                    <p className="text-sm text-slate-300 bg-slate-800/30 border border-white/5 rounded-sm p-3">
                      {activeSample.annotatorNote}
                    </p>
                  </div>
                )}
                {activeSample.finalLabel && (
                  <div className="p-3 bg-slate-800/50 rounded-sm border border-white/10">
                    <div className="flex items-center gap-2 mb-1">
                      {activeSample.finalLabel === 'pass' ? (
                        <CheckCircle size={14} className="text-emerald-400" />
                      ) : (
                        <XCircle size={14} className="text-red-400" />
                      )}
                      <span className="text-sm font-medium text-white">
                        已{activeSample.finalLabel === 'pass' ? '通过' : '拒绝'}
                      </span>
                    </div>
                    {activeSample.reviewedBy && (
                      <p className="text-xs text-slate-500">
                        {activeSample.reviewedBy} · {activeSample.reviewedAt ? new Date(activeSample.reviewedAt).toLocaleString('zh-CN') : ''}
                      </p>
                    )}
                  </div>
                )}
                <div>
                  <div className="text-xs text-slate-400 mb-3">操作历史</div>
                  <HistoryTimeline history={activeSample.history} />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">加载中...</div>
          )}
          {activeSample && (
            <div className="border-t border-white/10 p-5 space-y-3 bg-slate-800/30">
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">审核留言（可选）</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  placeholder="补充说明..."
                  className="w-full px-3 py-2 bg-slate-800 border border-white/10 rounded-sm text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-white/20"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => handleReview('pass')}
                  disabled={loading}
                  className="flex-1 rounded-sm px-3 py-2 font-medium text-sm bg-emerald-500 hover:bg-emerald-400 text-white disabled:opacity-50 transition-colors"
                >
                  通过
                </button>
                <button
                  onClick={() => handleReview('reject')}
                  disabled={loading}
                  className="flex-1 rounded-sm px-3 py-2 font-medium text-sm bg-red-500 hover:bg-red-400 text-white disabled:opacity-50 transition-colors"
                >
                  拒绝
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
