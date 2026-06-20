import { useEffect } from 'react';
import { useAppStore } from '@/store/appStore';
import { CHANGE_REASON_LABELS } from '@/engine/comparator';
import { ANOMALY_TYPE_LABELS } from '@/types';
import type { ChangeReason, ChangedRecord } from '@/types';
import { GitCompareArrows, ArrowRight, ArrowLeft, Plus, Minus, RefreshCw, GitBranch, Ruler, FileWarning, Calculator } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

const REASON_ICONS: Record<ChangeReason, any> = {
  formula: Calculator,
  parameter: RefreshCw,
  unit: Ruler,
  boundary: GitBranch,
  data_quality: FileWarning,
};

const REASON_COLORS: Record<ChangeReason, string> = {
  formula: 'bg-amber-50 text-amber-700 border-amber-200',
  parameter: 'bg-blue-50 text-blue-700 border-blue-200',
  unit: 'bg-red-50 text-anomaly-unit border-red-200',
  boundary: 'bg-purple-50 text-anomaly-boundary border-purple-200',
  data_quality: 'bg-gray-100 text-anomaly-bad border-gray-200',
};

export default function ComparePage() {
  const comparison = useAppStore(s => s.comparison);
  const currentRun = useAppStore(s => s.currentRun);
  const previousRun = useAppStore(s => s.previousRun);
  const initDefault = useAppStore(s => s.initDefault);
  const navigate = useNavigate();

  useEffect(() => {
    if (!currentRun) {
      initDefault();
    }
  }, [currentRun, initDefault]);

  if (!comparison || !currentRun || !previousRun) {
    return (
      <div className="min-h-screen">
        <header className="bg-white border-b border-ink-200 px-8 py-5">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-md bg-ink-100 flex items-center justify-center">
              <GitCompareArrows className="w-4 h-4 text-ink-600" />
            </div>
            <h1 className="font-serif text-xl font-bold text-ink-900">对比报告</h1>
          </div>
          <p className="text-sm text-ink-400">调一档参数复算后，查看公式、单位、边界样本如何影响结果</p>
        </header>
        <div className="p-8 max-w-[1200px]">
          <div className="card p-12 text-center">
            <GitCompareArrows className="w-12 h-12 mx-auto mb-3 text-ink-200" />
            <p className="text-sm text-ink-500 mb-1">暂无对比数据</p>
            <p className="text-xs text-ink-400 mb-4">前往验算配置调整参数并重新运行，即可生成对比</p>
            <button onClick={() => navigate('/config')} className="btn-primary">
              去调参复算
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { summary, changedRecords, runA, runB } = comparison;

  const changeTypeCounts = {
    added: changedRecords.filter(c => c.changeType === 'added').length,
    removed: changedRecords.filter(c => c.changeType === 'removed').length,
    type_changed: changedRecords.filter(c => c.changeType === 'type_changed').length,
    status_changed: changedRecords.filter(c => c.changeType === 'status_changed').length,
    value_changed: changedRecords.filter(c => c.changeType === 'value_changed').length,
  };

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-ink-200 px-8 py-5">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-md bg-ink-100 flex items-center justify-center">
            <GitCompareArrows className="w-4 h-4 text-ink-600" />
          </div>
          <h1 className="font-serif text-xl font-bold text-ink-900">对比报告</h1>
        </div>
        <p className="text-sm text-ink-400">
          调一档参数复算后，查看公式、单位、边界样本如何影响结果
        </p>
      </header>

      <div className="p-8 max-w-[1200px] space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <RunCard run={runA} label="调整前" />
          <RunCard run={runB} label="调整后" highlight />
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-ink-800">变化原因汇总</h2>
            <span className="text-xs text-ink-400">
              共 <span className="font-semibold text-ink-700">{summary.totalChanged}</span> 条发生变化
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
            {(Object.keys(REASON_COLORS) as ChangeReason[]).map(reason => (
              <div key={reason} className={cn('rounded-md p-3 border', REASON_COLORS[reason])}>
                <div className="flex items-center gap-1.5 mb-1">
                  {(() => {
                    const Icon = REASON_ICONS[reason];
                    return <Icon className="w-3.5 h-3.5" />;
                  })()}
                  <span className="text-[11px] font-medium">{CHANGE_REASON_LABELS[reason]}</span>
                </div>
                <div className="text-xl font-serif font-bold">{summary.byReason[reason]}</div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 pt-3 border-t border-ink-100">
            <ChangeTypeBadge icon={Plus} label="新增异常" count={changeTypeCounts.added} color="text-anomaly-unit bg-red-50" />
            <ChangeTypeBadge icon={Minus} label="异常消除" count={changeTypeCounts.removed} color="text-anomaly-normal bg-emerald-50" />
            <ChangeTypeBadge icon={RefreshCw} label="类型变化" count={changeTypeCounts.type_changed} color="text-anomaly-boundary bg-purple-50" />
            <ChangeTypeBadge icon={ArrowRight} label="数值变化" count={changeTypeCounts.value_changed} color="text-amber-700 bg-amber-50" />
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="px-4 py-3 bg-ink-50 border-b border-ink-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink-700">变化明细</h2>
            <span className="text-xs text-ink-400">{changedRecords.length} 条</span>
          </div>

          {changedRecords.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-sm text-ink-500">两次验算结果完全一致，无变化记录</p>
            </div>
          ) : (
            <div className="divide-y divide-ink-100">
              {changedRecords.map(record => (
                <ChangeRecordRow key={record.answerId} record={record} />
              ))}
            </div>
          )}
        </div>

        <div className="card p-4 bg-amber-50/50 border-amber-200">
          <div className="flex items-start gap-2.5">
            <GitBranch className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-ink-600 leading-relaxed">
              <span className="font-medium text-ink-800">解读提示：</span>
              变化原因标签解释了为何结果发生变化。「公式变化」表示验算公式调整导致结果不同；
              「参数变化」表示阈值或容差调整；「单位口径变化」表示单位要求改变导致异常判定不同；
              「边界样本影响」表示样本处于分布两端需谨慎；「数据质量」表示坏数据处理方式变化。
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RunCard({ run, label, highlight }: { run: any; label: string; highlight?: boolean }) {
  return (
    <div className={cn('card p-4', highlight && 'border-amber-300 bg-amber-50/30')}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full',
            highlight ? 'bg-amber-500 text-ink-900' : 'bg-ink-100 text-ink-600'
          )}>
            {label}
          </span>
          <span className="text-sm font-semibold text-ink-800">{run.name}</span>
        </div>
        <span className="text-[11px] text-ink-400">
          {new Date(run.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-3">
        <div>
          <div className="text-[11px] text-ink-400">总记录</div>
          <div className="text-lg font-serif font-bold text-ink-800">{run.totalCount}</div>
        </div>
        <div>
          <div className="text-[11px] text-ink-400">异常数</div>
          <div className={cn('text-lg font-serif font-bold', run.anomalyCount > 0 ? 'text-anomaly-unit' : 'text-anomaly-normal')}>
            {run.anomalyCount}
          </div>
        </div>
        <div>
          <div className="text-[11px] text-ink-400">正常通过</div>
          <div className="text-lg font-serif font-bold text-anomaly-normal">{run.totalCount - run.anomalyCount}</div>
        </div>
      </div>

      <div className="text-[11px] text-ink-400 font-mono bg-ink-50 rounded px-2 py-1.5 break-all">
        {run.params.formula}
      </div>
    </div>
  );
}

function ChangeTypeBadge({ icon: Icon, label, count, color }: { icon: any; label: string; count: number; color: string }) {
  return (
    <div className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium', color)}>
      <Icon className="w-3.5 h-3.5" />
      {label}
      <span className="font-semibold">{count}</span>
    </div>
  );
}

function ChangeRecordRow({ record }: { record: ChangedRecord }) {
  const a = record.anomalyA;
  const b = record.anomalyB;

  const titleA = a ? getRecordTitle(a.rawSnapshot) : '—';
  const titleB = b ? getRecordTitle(b.rawSnapshot) : titleA;

  const changeTypeConfig = {
    added: { label: '新增异常', cls: 'bg-red-50 text-anomaly-unit', icon: Plus },
    removed: { label: '异常消除', cls: 'bg-emerald-50 text-anomaly-normal', icon: Minus },
    type_changed: { label: '类型变化', cls: 'bg-purple-50 text-anomaly-boundary', icon: RefreshCw },
    status_changed: { label: '状态变化', cls: 'bg-blue-50 text-blue-700', icon: RefreshCw },
    value_changed: { label: '数值变化', cls: 'bg-amber-50 text-amber-700', icon: ArrowRight },
  };
  const cfg = changeTypeConfig[record.changeType];
  const Icon = cfg.icon;

  return (
    <div className="px-4 py-3 hover:bg-ink-50/50 transition-colors">
      <div className="flex items-center gap-3">
        <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium flex-shrink-0', cfg.cls)}>
          <Icon className="w-3 h-3" />
          {cfg.label}
        </span>

        <div className="flex-1 min-w-0 flex items-center gap-3">
          <div className="min-w-0">
            <div className="text-sm font-medium text-ink-800 truncate">{titleB}</div>
            <div className="flex items-center gap-2 mt-0.5">
              {a && <span className="text-[11px] text-ink-400">{ANOMALY_TYPE_LABELS[a.type]}</span>}
              {(a || b) && (a?.type !== b?.type) && (
                <>
                  <ArrowRight className="w-3 h-3 text-ink-300" />
                  <span className="text-[11px] text-ink-500">{b ? ANOMALY_TYPE_LABELS[b.type] : '已消除'}</span>
                </>
              )}
            </div>
          </div>

          {record.valueChange && (
            <div className="flex items-center gap-2 text-xs font-mono flex-shrink-0">
              <span className="text-ink-400">
                {record.valueChange.oldValue?.toFixed(4) ?? '—'}
              </span>
              <ArrowRight className="w-3 h-3 text-ink-300" />
              <span className="text-amber-600 font-semibold">
                {record.valueChange.newValue?.toFixed(4) ?? '—'}
              </span>
              {record.valueChange.delta !== null && (
                <span className={cn(
                  'px-1.5 py-0.5 rounded text-[10px]',
                  record.valueChange.delta > 0 ? 'bg-red-50 text-anomaly-unit' : 'bg-emerald-50 text-anomaly-normal'
                )}>
                  {record.valueChange.delta > 0 ? '+' : ''}{record.valueChange.delta.toFixed(4)}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-1 flex-shrink-0">
          {record.reasons.map(reason => {
            const RIcon = REASON_ICONS[reason as ChangeReason];
            return (
              <span
                key={reason}
                className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border', REASON_COLORS[reason as ChangeReason])}
                title={CHANGE_REASON_LABELS[reason as ChangeReason]}
              >
                <RIcon className="w-2.5 h-2.5" />
                {CHANGE_REASON_LABELS[reason as ChangeReason]}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function getRecordTitle(rawSnapshot: Record<string, any>): string {
  const keys = Object.keys(rawSnapshot);
  return rawSnapshot[keys[1]]?.toString() || rawSnapshot[keys[0]]?.toString() || '未命名';
}
