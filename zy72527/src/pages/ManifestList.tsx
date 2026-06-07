import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Filter,
  Download,
  ShieldCheck,
  AlertTriangle,
  Eye,
  PlayCircle,
} from 'lucide-react';
import { useManifestStore } from '../store/manifestStore';
import { StatusBadge } from '../components/StatusBadge';
import type { ManifestStatus } from '../types';
import { cn } from '../lib/utils';

const statusFilters: { value: ManifestStatus | 'all'; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'pending', label: '待处理' },
  { value: 'processing', label: '处理中' },
  { value: 'conflict', label: '存在冲突' },
  { value: 'overridden', label: '改判被覆盖' },
  { value: 'verified', label: '已复核' },
  { value: 'completed', label: '已完成' },
];

export function ManifestList() {
  const navigate = useNavigate();
  const manifests = useManifestStore((s) => s.manifests);
  const simulateBatchRun = useManifestStore((s) => s.simulateBatchRun);
  const exportData = useManifestStore((s) => s.exportData);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ManifestStatus | 'all'>('all');

  const filteredManifests = manifests.filter((m) => {
    const matchSearch = m.manifestNo.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || m.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const handleExport = () => {
    const data = exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `manifest-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#1a1d23] text-white">
      <header className="border-b border-zinc-800 bg-[#1a1d23]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              舱单 OCR 字段补录
            </h1>
            <p className="mt-1 text-sm text-zinc-400">AI 产品经理阿宁的工作台</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={simulateBatchRun}
              className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700"
            >
              <PlayCircle className="h-4 w-4" />
              模拟批跑
            </button>
            <button
              onClick={() => navigate('/self-check')}
              className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700"
            >
              <ShieldCheck className="h-4 w-4" />
              自检面板
            </button>
            <button
              onClick={() => navigate('/evaluation')}
              className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700"
            >
              评测报告
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500"
            >
              <Download className="h-4 w-4" />
              导出明细
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-6">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                placeholder="搜索舱单编号..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-72 rounded-lg border border-zinc-700 bg-zinc-800/50 py-2 pl-10 pr-4 text-sm text-white placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-800/50 p-1">
              {statusFilters.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setStatusFilter(f.value)}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                    statusFilter === f.value
                      ? 'bg-zinc-700 text-white'
                      : 'text-zinc-400 hover:text-white'
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <Filter className="h-4 w-4" />
            共 {filteredManifests.length} 条记录
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-zinc-800">
          <table className="w-full">
            <thead className="bg-zinc-800/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400">舱单编号</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400">状态</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400">标记</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400">处理进度</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400">更新时间</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-zinc-400">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {filteredManifests.map((m) => (
                <tr
                  key={m.id}
                  className={cn(
                    'transition-colors hover:bg-zinc-800/30',
                    m.hasConflict && 'bg-amber-900/10',
                    m.hasOverride && 'bg-rose-900/10'
                  )}
                >
                  <td className="px-4 py-4">
                    <span className="font-mono text-sm text-white">{m.manifestNo}</span>
                  </td>
                  <td className="px-4 py-4">
                    <StatusBadge status={m.status} size="sm" />
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      {m.hasConflict && (
                        <span
                          className="inline-flex items-center gap-1 rounded bg-amber-500/20 px-1.5 py-0.5 text-xs text-amber-400"
                          title="存在知识库与工单冲突"
                        >
                          <AlertTriangle className="h-3 w-3" />
                          冲突
                        </span>
                      )}
                      {m.hasOverride && (
                        <span
                          className="inline-flex items-center gap-1 rounded bg-rose-500/20 px-1.5 py-0.5 text-xs text-rose-400"
                          title="人工改判被批跑覆盖"
                        >
                          <AlertTriangle className="h-3 w-3" />
                          覆盖
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-zinc-700">
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-all"
                          style={{ width: `${(m.stepProgress / 3) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-zinc-400">
                        {['未开始', '第一步', '第二步', '已完成'][m.stepProgress]}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-sm text-zinc-400">
                    {new Date(m.updatedAt).toLocaleString('zh-CN')}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <button
                      onClick={() => navigate(`/manifest/${m.id}`)}
                      className="inline-flex items-center gap-1 rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-700"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      查看详情
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
