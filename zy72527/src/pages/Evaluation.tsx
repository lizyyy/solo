import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  BookOpen,
  MessageSquare,
  FileBarChart,
  Download,
  Clock,
} from 'lucide-react';
import { useManifestStore } from '../store/manifestStore';
import { StatusBadge } from '../components/StatusBadge';
import { cn } from '../lib/utils';

const steps = [
  {
    key: 1,
    label: '知识库引用链接导入',
    icon: BookOpen,
    color: 'indigo',
  },
  {
    key: 2,
    label: '补看线上反馈工单',
    icon: MessageSquare,
    color: 'pink',
  },
  {
    key: 3,
    label: '评测报告更新',
    icon: FileBarChart,
    color: 'emerald',
  },
];

export function Evaluation() {
  const navigate = useNavigate();
  const manifests = useManifestStore((s) => s.manifests);
  const exportData = useManifestStore((s) => s.exportData);

  const stats = {
    total: manifests.length,
    step0: manifests.filter((m) => m.stepProgress === 0).length,
    step1: manifests.filter((m) => m.stepProgress === 1).length,
    step2: manifests.filter((m) => m.stepProgress === 2).length,
    step3: manifests.filter((m) => m.stepProgress === 3).length,
    hasConflict: manifests.filter((m) => m.hasConflict).length,
    hasOverride: manifests.filter((m) => m.hasOverride).length,
  };

  const handleExportReport = () => {
    const data = exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `evaluation-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#1a1d23] text-white">
      <header className="border-b border-zinc-800 bg-[#1a1d23]/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-6 py-4">
          <button
            onClick={() => navigate('/')}
            className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold">评测报告中心</h1>
            <p className="mt-1 text-sm text-zinc-400">三步流程进度追踪与评测报告管理</p>
          </div>
          <button
            onClick={handleExportReport}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500"
          >
            <Download className="h-4 w-4" />
            导出评测数据
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-8 rounded-xl border border-zinc-800 bg-zinc-800/20 p-6">
          <h2 className="mb-6 text-base font-semibold text-white">三步流程总览</h2>
          <div className="relative flex items-center justify-between">
            <div className="absolute left-8 right-8 top-6 h-0.5 bg-zinc-700">
              <div
                className="h-full bg-emerald-500 transition-all"
                style={{
                  width: `${((stats.step3 + stats.step2 + stats.step1) / stats.total) * 100}%`,
                }}
              />
            </div>
            {steps.map((step, idx) => {
              const completedCount =
                idx === 0
                  ? stats.step1 + stats.step2 + stats.step3
                  : idx === 1
                  ? stats.step2 + stats.step3
                  : stats.step3;
              const Icon = step.icon;
              return (
                <div key={step.key} className="relative z-10 flex flex-col items-center">
                  <div
                    className={cn(
                      'flex h-12 w-12 items-center justify-center rounded-full border-4 border-[#1a1d23]',
                      completedCount > 0 ? 'bg-emerald-500 text-white' : 'bg-zinc-700 text-zinc-400'
                    )}
                  >
                    {completedCount > 0 ? (
                      <CheckCircle2 className="h-6 w-6" />
                    ) : (
                      <Icon className="h-5 w-5" />
                    )}
                  </div>
                  <p className="mt-3 text-sm font-medium text-white">{step.label}</p>
                  <p className="mt-1 text-xs text-zinc-400">
                    {completedCount} / {stats.total} 已完成
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mb-8 grid grid-cols-3 gap-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-800/20 p-5">
            <div className="flex items-center gap-2">
              <Circle className="h-4 w-4 text-zinc-500" />
              <span className="text-sm text-zinc-400">未开始</span>
            </div>
            <p className="mt-2 text-3xl font-bold text-white">{stats.step0}</p>
          </div>
          <div className="rounded-xl border border-amber-700/50 bg-amber-900/10 p-5">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-400" />
              <span className="text-sm text-amber-300">处理中</span>
            </div>
            <p className="mt-2 text-3xl font-bold text-white">{stats.step1 + stats.step2}</p>
          </div>
          <div className="rounded-xl border border-emerald-700/50 bg-emerald-900/10 p-5">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span className="text-sm text-emerald-300">已完成</span>
            </div>
            <p className="mt-2 text-3xl font-bold text-white">{stats.step3}</p>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-800/20">
          <div className="border-b border-zinc-800 px-6 py-4">
            <h2 className="text-base font-semibold text-white">舱单处理详情</h2>
          </div>
          <div className="divide-y divide-zinc-800">
            {manifests.map((m) => (
              <div key={m.id} className="flex items-center gap-4 px-6 py-4">
                <div className="w-32">
                  <p className="font-mono text-sm text-white">{m.manifestNo}</p>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    {steps.map((step, idx) => (
                      <div key={step.key} className="flex items-center">
                        <div
                          className={cn(
                            'flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium',
                            m.stepProgress > idx
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : m.stepProgress === idx
                              ? 'bg-amber-500/20 text-amber-400 ring-2 ring-amber-500/30'
                              : 'bg-zinc-700 text-zinc-500'
                          )}
                        >
                          {m.stepProgress > idx ? (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          ) : (
                            step.key
                          )}
                        </div>
                        {idx < steps.length - 1 && (
                          <div
                            className={cn(
                              'mx-1 h-0.5 w-8',
                              m.stepProgress > idx ? 'bg-emerald-500' : 'bg-zinc-700'
                            )}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                <StatusBadge status={m.status} size="sm" />
                <button
                  onClick={() => navigate(`/manifest/${m.id}`)}
                  className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-700"
                >
                  查看
                </button>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
