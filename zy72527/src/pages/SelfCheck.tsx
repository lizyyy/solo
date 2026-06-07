import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  PlayCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useManifestStore } from '../store/manifestStore';
import type { SelfCheckType } from '../types';
import { cn } from '../lib/utils';

const checkTypeLabels: Record<SelfCheckType, { label: string; desc: string }> = {
  duplicate_import: {
    label: '重复导入检测',
    desc: '检查同一知识库链接是否被多次导入同一舱单',
  },
  override_detection: {
    label: '改判覆盖检测',
    desc: '检查是否存在人工改判被批跑覆盖的记录',
  },
  recalculation: {
    label: '补录重算校验',
    desc: '验证补录后字段值与计算逻辑一致性',
  },
  export_consistency: {
    label: '导出一致性校验',
    desc: '对比页面展示数据与导出数据结构是否一致',
  },
};

export function SelfCheck() {
  const navigate = useNavigate();
  const runSelfCheck = useManifestStore((s) => s.runSelfCheck);
  const runSingleSelfCheck = useManifestStore((s) => s.runSingleSelfCheck);
  const selfCheckResults = useManifestStore((s) => s.selfCheckResults);
  const [expandedType, setExpandedType] = useState<SelfCheckType | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    if (selfCheckResults.length === 0) {
      handleRunAll();
    }
  }, []);

  const handleRunAll = async () => {
    setIsRunning(true);
    await new Promise((r) => setTimeout(r, 500));
    runSelfCheck();
    setIsRunning(false);
  };

  const handleRunSingle = async (type: SelfCheckType) => {
    setIsRunning(true);
    await new Promise((r) => setTimeout(r, 300));
    runSingleSelfCheck(type);
    setIsRunning(false);
  };

  const allPassed = selfCheckResults.length > 0 && selfCheckResults.every((r) => r.passed);
  const totalFailed = selfCheckResults.reduce((acc, r) => acc + r.failedCount, 0);

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
            <h1 className="text-lg font-semibold">自检面板</h1>
            <p className="mt-1 text-sm text-zinc-400">四项核心检测，覆盖最容易出错的场景</p>
          </div>
          <button
            onClick={handleRunAll}
            disabled={isRunning}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <PlayCircle className={cn('h-4 w-4', isRunning && 'animate-spin')} />
            全部重检
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-8 grid grid-cols-3 gap-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-800/20 p-5">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'flex h-12 w-12 items-center justify-center rounded-xl',
                  allPassed ? 'bg-emerald-500/20' : 'bg-amber-500/20'
                )}
              >
                {allPassed ? (
                  <CheckCircle2 className="h-6 w-6 text-emerald-400" />
                ) : (
                  <AlertTriangle className="h-6 w-6 text-amber-400" />
                )}
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{allPassed ? '全部通过' : '存在问题'}</p>
                <p className="text-sm text-zinc-400">总体检测结果</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-800/20 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/20">
                <CheckCircle2 className="h-6 w-6 text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">
                  {selfCheckResults.filter((r) => r.passed).length}
                </p>
                <p className="text-sm text-zinc-400">通过项数</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-800/20 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-500/20">
                <XCircle className="h-6 w-6 text-rose-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{totalFailed}</p>
                <p className="text-sm text-zinc-400">异常记录数</p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {selfCheckResults.map((result) => (
            <div
              key={result.type}
              className={cn(
                'rounded-xl border transition-all',
                result.passed
                  ? 'border-zinc-800 bg-zinc-800/20'
                  : 'border-amber-700/50 bg-amber-900/10'
              )}
            >
              <div
                className="flex cursor-pointer items-center gap-4 p-5"
                onClick={() => setExpandedType(expandedType === result.type ? null : result.type)}
              >
                <div
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-lg',
                    result.passed ? 'bg-emerald-500/20' : 'bg-amber-500/20'
                  )}
                >
                  {result.passed ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-amber-400" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-base font-medium text-white">
                      {checkTypeLabels[result.type].label}
                    </h3>
                    <span
                      className={cn(
                        'rounded px-2 py-0.5 text-xs font-medium',
                        result.passed
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-amber-500/20 text-amber-400'
                      )}
                    >
                      {result.passed ? '通过' : `${result.failedCount} 条异常`}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-zinc-400">
                    {checkTypeLabels[result.type].desc}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right text-xs text-zinc-500">
                    <p>检测时间</p>
                    <p className="font-mono">{new Date(result.checkedAt).toLocaleString('zh-CN')}</p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRunSingle(result.type);
                    }}
                    className="rounded-lg border border-zinc-700 bg-zinc-800 p-2 text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-white"
                  >
                    <PlayCircle className="h-4 w-4" />
                  </button>
                  {expandedType === result.type ? (
                    <ChevronUp className="h-5 w-5 text-zinc-400" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-zinc-400" />
                  )}
                </div>
              </div>

              {expandedType === result.type && !result.passed && (
                <div className="border-t border-zinc-800 px-5 py-4">
                  <p className="mb-3 text-sm font-medium text-zinc-300">异常明细：</p>
                  <div className="space-y-2">
                    {result.failedItems.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between rounded-lg border border-zinc-700/50 bg-zinc-900/40 px-4 py-3"
                      >
                        <div className="flex items-center gap-3">
                          <AlertTriangle className="h-4 w-4 text-amber-400" />
                          <div>
                            <p className="font-mono text-sm text-white">{item.manifestNo}</p>
                            <p className="text-xs text-zinc-400">{item.reason}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => navigate(`/manifest/${item.manifestId}`)}
                          className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-700"
                        >
                          查看详情
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
