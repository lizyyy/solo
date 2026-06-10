import { useState } from 'react';
import {
  History,
  PlayCircle,
  X,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  ArrowLeftRight,
  Plus,
  Trash2,
  Edit3,
  Clock,
  User,
  FileText,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Info,
} from 'lucide-react';
import { useAppStore } from '@/store';
import { MOCK_BATCH_DIFF } from '@/data/mockData';
import type { DiffField, RunHistoryItem, RecordDiff } from '@/types';
import { cn } from '@/lib/utils';

const RUN_DOT_COLORS: Record<number, string> = {
  0: 'bg-emerald-500',
  1: 'bg-amber-500',
  2: 'bg-blue-500',
  3: 'bg-purple-500',
  4: 'bg-rose-500',
};

function getRunDotColor(runIndex: number): string {
  return RUN_DOT_COLORS[(runIndex - 1) % 5] ?? 'bg-slate-500';
}

function DiffFieldRow({ field }: { field: DiffField }) {
  const changeStyle = {
    add: {
      wrapper: 'bg-emerald-50 border-emerald-200',
      arrow: 'text-emerald-600',
      newVal: 'text-emerald-700 font-semibold',
    },
    modify: {
      wrapper: 'bg-amber-50 border-amber-200',
      arrow: 'text-amber-600',
      newVal: 'text-amber-700 font-semibold',
    },
    remove: {
      wrapper: 'bg-red-50 border-red-200',
      arrow: 'text-red-600',
      newVal: 'text-red-700 line-through',
    },
  }[field.changeType];

  return (
    <div className={cn('grid grid-cols-12 gap-3 items-center rounded-lg border px-4 py-3', changeStyle.wrapper)}>
      <div className="col-span-3 text-sm font-semibold text-slate-700">{field.fieldLabel}</div>
      <div className="col-span-3 text-sm text-slate-600 font-mono truncate">{field.oldValue}</div>
      <div className="col-span-1 flex justify-center">
        {field.changeType === 'add' ? (
          <ArrowRight className={cn('w-4 h-4', changeStyle.arrow)} />
        ) : field.changeType === 'modify' ? (
          <ArrowLeftRight className={cn('w-4 h-4', changeStyle.arrow)} />
        ) : (
          <Trash2 className={cn('w-4 h-4', changeStyle.arrow)} />
        )}
      </div>
      <div className={cn('col-span-5 text-sm font-mono truncate', changeStyle.newVal)}>
        {field.newValue}
      </div>
    </div>
  );
}

function RecordDiffCard({ recordDiff, defaultOpen }: { recordDiff: RecordDiff; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen ?? false);

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-slate-50 transition-colors text-left"
      >
        {open ? (
          <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-brand-blue bg-brand-blue/10 px-2 py-0.5 rounded">
              {recordDiff.recordCode}
            </span>
            <span className="text-sm font-semibold text-slate-800 truncate">{recordDiff.recordTitle}</span>
          </div>
        </div>
        <span className="text-xs text-slate-500 flex-shrink-0">
          {recordDiff.fields.length} 处变更
        </span>
      </button>
      {open && (
        <div className="border-t border-slate-100 px-5 py-4 space-y-2 bg-slate-50/50">
          {recordDiff.fields.map((f, i) => (
            <DiffFieldRow key={`${f.fieldName}-${i}`} field={f} />
          ))}
        </div>
      )}
    </div>
  );
}

function RunCard({
  run,
  isLast,
  onToggleSelect,
}: {
  run: RunHistoryItem;
  isLast: boolean;
  onToggleSelect: () => void;
}) {
  const dotColor = getRunDotColor(run.runIndex);
  const selectedCount = 2;

  return (
    <div className="relative flex gap-4">
      <div className="flex flex-col items-center flex-shrink-0 pt-1">
        <div className={cn('w-4 h-4 rounded-full border-2 border-white shadow-md ring-2', dotColor, run.isSelected ? 'ring-brand-blue/40' : 'ring-transparent')} />
        {!isLast && (
          <div className="w-0.5 flex-1 bg-slate-200 mt-1" style={{ minHeight: '180px' }} />
        )}
      </div>

      <div className="flex-1 pb-6">
        <div className={cn(
          'rounded-xl border bg-white overflow-hidden transition-all',
          run.isSelected ? 'border-brand-blue shadow-md ring-2 ring-brand-blue/10' : 'border-slate-200 shadow-sm'
        )}>
          <div className="px-5 py-4 border-b border-slate-100">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className={cn('text-lg font-bold', run.isSelected ? 'text-brand-blue' : 'text-slate-900')}>
                    Run #{run.runIndex}
                  </h3>
                  <span className="text-xs text-slate-500 font-mono">
                    <Clock className="w-3 h-3 inline mr-1 -mt-0.5" />
                    {run.runAt}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs text-slate-600 flex-wrap">
                  <span className="inline-flex items-center gap-1">
                    <User className="w-3 h-3 text-slate-400" />
                    <span className="font-medium">{run.runBy}</span>
                  </span>
                  <span className="text-slate-300">·</span>
                  <span className="inline-flex items-center gap-1">
                    <Edit3 className="w-3 h-3 text-slate-400" />
                    {run.triggerReason}
                  </span>
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer flex-shrink-0 select-none">
                {run.isSelected ? (
                  <CheckSquare className="w-5 h-5 text-brand-blue" onClick={onToggleSelect} />
                ) : (
                  <Square className="w-5 h-5 text-slate-300 hover:text-slate-500" onClick={onToggleSelect} />
                )}
                <span className="text-xs font-medium text-slate-600">选中对比</span>
              </label>
            </div>

            <div className="mt-4 grid grid-cols-4 gap-2">
              <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
                <p className="text-[10px] text-slate-500 mb-0.5">记录数</p>
                <p className="text-sm font-bold font-mono text-slate-800">{run.recordCount}</p>
              </div>
              <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2">
                <p className="text-[10px] text-red-600 mb-0.5">异常数</p>
                <p className="text-sm font-bold font-mono text-red-700">{run.anomalyCount}</p>
              </div>
              <div className="rounded-lg bg-amber-50 border border-amber-100 px-3 py-2">
                <p className="text-[10px] text-amber-700 mb-0.5">待补</p>
                <p className="text-sm font-bold font-mono text-amber-800">{run.pendingCount}</p>
              </div>
              <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2">
                <p className="text-[10px] text-emerald-700 mb-0.5">已确认</p>
                <p className="text-sm font-bold font-mono text-emerald-800">{run.confirmedCount}</p>
              </div>
            </div>
          </div>

          {(run.remarkBefore || run.remarkAfter) && (
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
              <div className="rounded-lg bg-white border border-slate-200 p-3 space-y-2">
                <div className="flex items-start gap-2 text-xs">
                  <span className="text-slate-400 font-semibold flex-shrink-0 mt-0.5 w-16">备注前：</span>
                  <span className="text-slate-600 leading-relaxed">{run.remarkBefore ?? '（无）'}</span>
                </div>
                <div className="flex items-start gap-2 text-xs">
                  <span className="text-slate-400 font-semibold flex-shrink-0 mt-0.5 w-16">
                    <ArrowRight className="w-3 h-3 inline mr-1 -mt-0.5 text-slate-400" />
                    备注后：
                  </span>
                  <span className="text-slate-800 font-medium leading-relaxed">{run.remarkAfter ?? '（无）'}</span>
                </div>
              </div>
            </div>
          )}

          <div className="px-5 py-3 flex items-start gap-2 text-xs bg-white">
            <Info className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
            <p className="text-slate-600 leading-relaxed">{run.summary}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function NewRunModal({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string, before: string, after: string) => void;
}) {
  const [reason, setReason] = useState('');
  const [before, setBefore] = useState('');
  const [after, setAfter] = useState('');

  if (!open) return null;

  const handleConfirm = () => {
    if (!reason.trim()) return;
    onConfirm(reason, before, after);
    setReason('');
    setBefore('');
    setAfter('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-brand-blue/10 flex items-center justify-center">
              <PlayCircle className="w-5 h-5 text-brand-blue" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">触发新重跑</h3>
              <p className="text-xs text-slate-500">补完备注后重跑，保留完整历史记录</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-700 mb-1.5 block">
              重跑原因 <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder="如：补完RZ-005/009备注后重跑，核对阳台封闭计算规则"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 resize-none"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700 mb-1.5 block">备注前（重跑前状态概述）</label>
            <textarea
              value={before}
              onChange={(e) => setBefore(e.target.value)}
              rows={2}
              placeholder="如：RZ-005阳台未区分开敞/封闭，RZ-009插值法无签字"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 resize-none"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700 mb-1.5 block">备注后（本次补完内容）</label>
            <textarea
              value={after}
              onChange={(e) => setAfter(e.target.value)}
              rows={2}
              placeholder="如：RZ-005确认按封闭阳台计算（见设计院确认单），RZ-009算法组已签字"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 resize-none"
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-50 border-t border-slate-100">
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            disabled={!reason.trim()}
            className={cn(
              'inline-flex items-center justify-center gap-1.5 rounded-lg px-5 py-2 text-sm font-semibold text-white transition-all',
              reason.trim()
                ? 'bg-brand-blue hover:bg-brand-blue/90 active:bg-brand-blue/80'
                : 'bg-slate-300 cursor-not-allowed'
            )}
          >
            <PlayCircle className="w-4 h-4" />
            确认重跑
          </button>
        </div>
      </div>
    </div>
  );
}

export default function RunHistory() {
  const { runHistory, addNewRun, toggleRunSelection } = useAppStore();
  const [modalOpen, setModalOpen] = useState(false);

  const sortedRuns = [...runHistory].sort((a, b) => b.runIndex - a.runIndex);
  const selectedRuns = runHistory.filter((r) => r.isSelected);
  const hasTwoSelected = selectedRuns.length === 2;

  const handleAddRun = (reason: string, before: string, after: string) => {
    addNewRun(reason, before, after);
    setModalOpen(false);
  };

  return (
    <div className="doc-container space-y-5">
      <div className="doc-card p-6 border-l-4 border-l-amber-500 bg-gradient-to-r from-amber-50/80 to-white">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-6 h-6 text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-amber-900 leading-relaxed">
              重跑保留历史，每版记录独立，补完备注前后均有完整记录，确保旧记录和新导出都说得通
            </p>
            <p className="text-xs text-amber-700 mt-1.5 leading-relaxed">
              每一次重跑都会生成独立的 Run 快照，备注变更、记录增减、状态流转都可追溯。选中 2 个 Run 可查看字段级差异对比。
            </p>
          </div>
        </div>
      </div>

      <div className="doc-card p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-brand-blue/10 flex items-center justify-center">
              <History className="w-5 h-5 text-brand-blue" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">重跑历史与版本对比</h1>
              <p className="text-sm text-slate-500 mt-0.5">
                查看交底清单的历史重跑记录，选中 2 个进行逐字段差异对比
                {selectedRuns.length > 0 && (
                  <span className="ml-2 text-brand-blue font-semibold">
                    （已选 {selectedRuns.length}/2）
                  </span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white bg-brand-blue hover:bg-brand-blue/90 active:bg-brand-blue/80 transition-all shadow-sm shadow-brand-blue/20"
          >
            <Plus className="w-4 h-4" />
            触发新重跑
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <div className="lg:col-span-2 doc-card p-5 max-h-[75vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-4 sticky top-0 bg-white z-10 pb-3 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-500" />
              运行时间线
            </h2>
            <span className="text-xs text-slate-500">{sortedRuns.length} 次运行</span>
          </div>
          <div className="space-y-1 mt-3">
            {sortedRuns.map((run, idx) => (
              <RunCard
                key={run.id}
                run={run}
                isLast={idx === sortedRuns.length - 1}
                onToggleSelect={() => toggleRunSelection(run.id)}
              />
            ))}
            {sortedRuns.length === 0 && (
              <div className="py-16 text-center">
                <History className="w-12 h-12 mx-auto mb-3 opacity-30 text-slate-400" />
                <p className="text-sm text-slate-500">暂无重跑记录，点击"触发新重跑"开始</p>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-3 doc-card p-5 max-h-[75vh] overflow-y-auto">
          {hasTwoSelected ? (
            <div className="space-y-5">
              <div className="flex items-center justify-center gap-3 py-2">
                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-100 border border-orange-200">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                  <span className="text-sm font-bold text-orange-800">
                    Run #{selectedRuns[1]?.runIndex ?? 'A'} · {selectedRuns[1]?.runAt.split(' ')[0] ?? ''}
                  </span>
                </span>
                <ArrowLeftRight className="w-5 h-5 text-slate-400" />
                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-100 border border-blue-200">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  <span className="text-sm font-bold text-blue-800">
                    Run #{selectedRuns[0]?.runIndex ?? 'B'} · {selectedRuns[0]?.runAt.split(' ')[0] ?? ''}
                  </span>
                </span>
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-slate-500" />
                  全局字段差异
                  <span className="text-xs font-normal text-slate-500">（{MOCK_BATCH_DIFF.fields.length} 项）</span>
                </h3>
                <div className="space-y-2">
                  {MOCK_BATCH_DIFF.fields.slice(0, 5).map((f, i) => (
                    <DiffFieldRow key={`global-${i}`} field={f} />
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-slate-500" />
                  分记录差异
                  <span className="text-xs font-normal text-slate-500">（{MOCK_BATCH_DIFF.recordDiffs.length} 条记录变更）</span>
                </h3>
                <div className="space-y-3">
                  {MOCK_BATCH_DIFF.recordDiffs.map((rd, i) => (
                    <RecordDiffCard key={rd.recordCode} recordDiff={rd} defaultOpen={i === 0} />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full min-h-[500px] flex items-center justify-center">
              <div className="text-center">
                <div className="w-20 h-20 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto mb-4">
                  <ArrowLeftRight className="w-10 h-10 text-slate-300" />
                </div>
                <h3 className="text-base font-semibold text-slate-700 mb-1.5">选择 2 个 Run 开始对比</h3>
                <p className="text-sm text-slate-500 leading-relaxed max-w-sm mx-auto">
                  在左侧时间线勾选"选中对比"复选框，选择 2 个运行版本后，此处将展示全局字段差异与逐条记录差异对比
                </p>
                <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-100 text-xs text-slate-500">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  当前已选 {selectedRuns.length} / 2
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <NewRunModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onConfirm={handleAddRun}
      />
    </div>
  );
}
