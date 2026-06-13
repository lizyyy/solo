import os

files = {}

files['/Users/lzy/pro/solo/workspaces/zy72510/src/pages/SupplementPage.tsx'] = '''import { useEffect, useState } from 'react';
import { api } from '@/api/client';
import type { BatchOverview, GrayBatch, Label } from '../../../shared/types';

function parseLines(text: string) {
  return text
    .split('\\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

export default function SupplementPage() {
  const [batchId, setBatchId] = useState('');
  const [batches, setBatches] = useState<GrayBatch[]>([]);
  const [linesText, setLinesText] = useState('');
  const [beforeOverview, setBeforeOverview] = useState<BatchOverview | null>(null);
  const [afterOverview, setAfterOverview] = useState<BatchOverview | null>(null);
  const [result, setResult] = useState<{ added: number; skipped: number } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.getBatches().then(setBatches);
  }, []);

  async function handleSubmit() {
    if (!batchId) return;
    const lines = parseLines(linesText);
    if (lines.length === 0) return;

    setLoading(true);
    try {
      let before: BatchOverview | null = null;
      try {
        const r = await api.getBatch(batchId);
        before = r.overview;
      } catch {}
      setBeforeOverview(before);

      const samples = lines.map((line, idx) => {
        const parts = line.split('|').map((p) => p.trim());
        const content = parts[0] || `补录样本${idx + 1}`;
        const confA = parseFloat(parts[1]) || 0.5;
        const confB = parseFloat(parts[2]) || 0.5;
        const labelA = (parts[3] as Label) || 'uncertain';
        const labelB = (parts[4] as Label) || 'uncertain';
        const grayLabel = (parts[5] as Label) || 'uncertain';
        const annotatorNote = parts[6];
        return {
          id: `supp-${Date.now()}-${idx}`,
          content,
          confidenceA: confA,
          confidenceB: confB,
          labelA,
          labelB,
          grayLabel,
          annotatorNote,
        };
      });

      const res = await api.supplementSamples({ batchId, samples });
      setResult({ added: res.added, skipped: res.skipped });

      const after = await api.recalcBatch(batchId);
      setAfterOverview(after);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h2 className="text-lg font-semibold text-white mb-6">补录与重算</h2>

      <div className="bg-slate-800/30 border border-white/10 rounded-sm p-6 mb-6">
        <div className="mb-4">
          <label className="block text-xs text-slate-400 mb-1.5">选择批次</label>
          <select
            value={batchId}
            onChange={(e) => {
              setBatchId(e.target.value);
              setBeforeOverview(null);
              setAfterOverview(null);
              setResult(null);
            }}
            className="w-full px-3 py-2 bg-slate-800 border border-white/10 rounded-sm text-sm text-white focus:outline-none focus:border-white/20"
          >
            <option value="">请选择...</option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>{b.name} ({b.id})</option>
            ))}
          </select>
        </div>

        <div className="mb-4">
          <label className="block text-xs text-slate-400 mb-1.5">
            补录样本（每行一条，格式：内容 | 置信度A | 置信度B | 标签A | 标签B | 灰度标签 | 留言（可选））
          </label>
          <textarea
            value={linesText}
            onChange={(e) => setLinesText(e.target.value)}
            rows={8}
            placeholder={`优质保湿面霜，适合干性肌肤|0.85|0.82|pass|pass|pass\\n低质量诱导点击链接|0.45|0.50|reject|reject|reject|应拒绝`}
            className="w-full px-3 py-2 bg-slate-800 border border-white/10 rounded-sm text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-white/20 font-mono"
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={!batchId || !linesText.trim() || loading}
          className="rounded-sm px-4 py-2 font-medium text-sm bg-blue-500 hover:bg-blue-400 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? '补录并重算中...' : '提交补录并触发重算'}
        </button>
      </div>

      {result && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-800/30 border border-white/10 rounded-sm p-5">
              <div className="text-xs text-slate-400 mb-1">补录成功</div>
              <div className="text-2xl font-semibold text-emerald-400">{result.added}</div>
            </div>
            <div className="bg-slate-800/30 border border-white/10 rounded-sm p-5">
              <div className="text-xs text-slate-400 mb-1">重复跳过</div>
              <div className="text-2xl font-semibold text-slate-400">{result.skipped}</div>
            </div>
          </div>

          {beforeOverview && afterOverview && (
            <div className="bg-slate-800/30 border border-white/10 rounded-sm p-5">
              <h4 className="text-sm font-medium text-white mb-4">重算前后对比</h4>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-xs text-slate-400 mb-1">总样本数</div>
                  <div className="text-white">
                    <span className="text-slate-500">{beforeOverview.totalSamples}</span>
                    <span className="mx-1.5 text-slate-600">→</span>
                    <span className="text-emerald-400 font-medium">{afterOverview.totalSamples}</span>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-400 mb-1">低置信度</div>
                  <div className="text-white">
                    <span className="text-slate-500">{beforeOverview.lowConfidenceCount}</span>
                    <span className="mx-1.5 text-slate-600">→</span>
                    <span className={`font-medium ${afterOverview.lowConfidenceCount > beforeOverview.lowConfidenceCount ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {afterOverview.lowConfidenceCount}
                    </span>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-400 mb-1">冲突数</div>
                  <div className="text-white">
                    <span className="text-slate-500">{beforeOverview.conflictCount}</span>
                    <span className="mx-1.5 text-slate-600">→</span>
                    <span className={`font-medium ${afterOverview.conflictCount > beforeOverview.conflictCount ? 'text-red-400' : 'text-emerald-400'}`}>
                      {afterOverview.conflictCount}
                    </span>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-400 mb-1">已审核</div>
                  <div className="text-white">
                    <span className="text-slate-500">{beforeOverview.reviewedCount}</span>
                    <span className="mx-1.5 text-slate-600">→</span>
                    <span className="font-medium">{afterOverview.reviewedCount}</span>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-400 mb-1">模型A均值</div>
                  <div className="text-white">
                    <span className="text-slate-500">{(beforeOverview.avgConfidenceA * 100).toFixed(1)}%</span>
                    <span className="mx-1.5 text-slate-600">→</span>
                    <span className="font-medium">{(afterOverview.avgConfidenceA * 100).toFixed(1)}%</span>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-400 mb-1">模型B均值</div>
                  <div className="text-white">
                    <span className="text-slate-500">{(beforeOverview.avgConfidenceB * 100).toFixed(1)}%</span>
                    <span className="mx-1.5 text-slate-600">→</span>
                    <span className="font-medium">{(afterOverview.avgConfidenceB * 100).toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
'''

files['/Users/lzy/pro/solo/workspaces/zy72510/src/pages/SelfCheckPage.tsx'] = '''import { useEffect, useState } from 'react';
import { Download, Play } from 'lucide-react';
import { api } from '@/api/client';
import { useAppStore } from '@/store/app';
import SelfCheckCard from '@/components/SelfCheckCard';
import type { GrayBatch } from '../../../shared/types';

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
'''

files['/Users/lzy/pro/solo/workspaces/zy72510/src/App.tsx'] = '''import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from '@/components/Sidebar';
import ImportPage from '@/pages/ImportPage';
import ReviewPage from '@/pages/ReviewPage';
import ConflictPage from '@/pages/ConflictPage';
import SupplementPage from '@/pages/SupplementPage';
import SelfCheckPage from '@/pages/SelfCheckPage';

export default function App() {
  return (
    <Router>
      <div className="flex min-h-screen bg-slate-900 text-slate-100">
        <Sidebar />
        <main className="flex-1 min-w-0 overflow-hidden">
          <Routes>
            <Route path="/" element={<Navigate to="/import" replace />} />
            <Route path="/import" element={<ImportPage />} />
            <Route path="/review" element={<ReviewPage />} />
            <Route path="/conflicts" element={<ConflictPage />} />
            <Route path="/supplement" element={<SupplementPage />} />
            <Route path="/selfcheck" element={<SelfCheckPage />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}
'''

for path, content in files.items():
    with open(path, 'w') as f:
        f.write(content)
    print(f'Written: {path} ({len(content)} chars)')
