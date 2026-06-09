import { useMemo, useState } from 'react';
import {
  ListTodo,
  CheckCircle2,
  Clock,
  FileX2,
  RefreshCw,
  Search,
  AlertTriangle,
  History,
} from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import { useScheduleStore } from '@/store/useScheduleStore';
import { countByStatus } from '@/utils/dedup';
import type { ScheduleAggregate } from '@/types/schedule';
import { cn } from '@/lib/utils';
import SubmitSimulator from '@/components/trial/SubmitSimulator';
import WithdrawnEmbedDemo from '@/components/trial/WithdrawnEmbedDemo';

function StatusBadge({ status }: { status: ScheduleAggregate['latest']['status'] }) {
  const config = {
    confirmed: { label: '已确认', cls: 'bg-green-100 text-green-700 border-green-200' },
    pending: { label: '待补证据', cls: 'bg-orange-100 text-orange-700 border-orange-200' },
    withdrawn: { label: '已撤回', cls: 'bg-gray-200 text-gray-600 border-gray-300' },
    draft: { label: '草稿', cls: 'bg-gray-100 text-gray-600 border-gray-200' },
  };
  const { label, cls } = config[status];
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-md border', cls)}>
      {label}
    </span>
  );
}

function StatCard({
  title,
  count,
  icon: Icon,
  bgCls,
  iconCls,
  textCls,
}: {
  title: string;
  count: number;
  icon: React.ElementType;
  bgCls: string;
  iconCls: string;
  textCls: string;
}) {
  return (
    <div className={cn('rounded-xl p-5 border', bgCls)}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 mb-1">{title}</p>
          <p className={cn('text-3xl font-bold', textCls)}>{count}</p>
        </div>
        <div className={cn('w-12 h-12 rounded-lg flex items-center justify-center', iconCls)}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}

function DedupList({ aggregates }: { aggregates: ScheduleAggregate[] }) {
  const [searchKw, setSearchKw] = useState('');

  const filtered = useMemo(() => {
    const kw = searchKw.trim().toLowerCase();
    if (!kw) return aggregates;
    return aggregates.filter((a) =>
      a.latest.pipelineNo.toLowerCase().includes(kw) ||
      a.latest.partName.toLowerCase().includes(kw) ||
      a.latest.partModel.toLowerCase().includes(kw)
    );
  }, [aggregates, searchKw]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-4 border-b border-gray-100 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <ListTodo className="w-5 h-5 text-gray-500" />
          <h3 className="font-semibold text-gray-800">去重聚合列表</h3>
          <span className="text-xs text-gray-400">共 {filtered.length} 条</span>
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchKw}
            onChange={(e) => setSearchKw(e.target.value)}
            placeholder="搜索管线/备件..."
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
          />
        </div>
      </div>

      <div className="divide-y divide-gray-50 max-h-[520px] overflow-y-auto">
        {filtered.length === 0 && (
          <div className="p-12 text-center text-gray-400">
            <FileX2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">暂无匹配记录</p>
          </div>
        )}
        {filtered.map((agg) => {
          const isWithdrawn = agg.latest.status === 'withdrawn';
          return (
            <div
              key={agg.bizKey}
              className={cn(
                'p-4 hover:bg-gray-50 transition-colors',
                isWithdrawn && 'bg-gray-50/60'
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <StatusBadge status={agg.latest.status} />
                    <span className={cn('text-sm font-semibold', isWithdrawn ? 'text-gray-500 italic line-through' : 'text-gray-800')}>
                      {agg.latest.pipelineNo}
                    </span>
                    <span className={cn('text-sm', isWithdrawn ? 'text-gray-400 italic line-through' : 'text-gray-600')}>
                      {agg.latest.partName} · {agg.latest.partModel}
                    </span>
                    {agg.withdrawnCount > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                        <AlertTriangle className="w-3 h-3" />
                        含 {agg.withdrawnCount} 次撤回
                      </span>
                    )}
                  </div>
                  <p className={cn('text-xs mb-2 line-clamp-2', isWithdrawn ? 'text-gray-400 italic line-through' : 'text-gray-500')}>
                    {agg.latest.manualRemark || agg.latest.alarmContent}
                  </p>
                  <div className="flex items-center gap-4 text-xs text-gray-400 flex-wrap">
                    <span>计划日期：{agg.latest.planDate}</span>
                    <span>提交人：{agg.latest.submitter}</span>
                    <span>提交时间：{agg.latest.submittedAt}</span>
                  </div>
                </div>
                <div className="flex-shrink-0 text-right">
                  <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                    <History className="w-3.5 h-3.5" />
                    历史版本
                  </div>
                  <p className="text-lg font-bold text-blue-600">
                    v{agg.latest.version}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{agg.versions.length} 条记录</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function TrialRun() {
  const trialMode = useScheduleStore((s) => s.trialMode);
  const toggleTrialMode = useScheduleStore((s) => s.toggleTrialMode);
  const resetTrialData = useScheduleStore((s) => s.resetTrialData);
  const trialAggregates = useScheduleStore((s) => s.trialAggregates());
  const cleanTrialAggregates = useScheduleStore((s) => s.cleanTrialAggregates());

  const currentAggregates = trialMode ? trialAggregates : cleanTrialAggregates;
  const counts = useMemo(() => countByStatus(currentAggregates), [currentAggregates]);

  return (
    <AppLayout>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">巡检试跑</h1>
            <p className="text-gray-500 mt-1 text-sm">
              模拟重复提交、撤回记录等真实场景，验证去重聚合逻辑
            </p>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-3 bg-white px-4 py-2.5 rounded-lg border border-gray-200 shadow-sm">
              <span className={cn('text-sm font-medium transition-colors', !trialMode ? 'text-gray-500' : 'text-gray-800')}>
                含撤回真实场景
              </span>
              <button
                onClick={toggleTrialMode}
                className={cn(
                  'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
                  trialMode ? 'bg-blue-600' : 'bg-gray-300'
                )}
                role="switch"
                aria-checked={trialMode}
              >
                <span
                  className={cn(
                    'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                    trialMode ? 'translate-x-5' : 'translate-x-0'
                  )}
                />
              </button>
              <span className={cn('text-sm font-medium transition-colors', trialMode ? 'text-gray-500' : 'text-gray-800')}>
                纯净场景对比
              </span>
            </div>
            <button
              onClick={resetTrialData}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
            >
              <RefreshCw className="w-4 h-4" />
              重置数据
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="全部记录"
            count={currentAggregates.length}
            icon={ListTodo}
            bgCls="bg-white border-gray-200"
            iconCls="bg-blue-50 text-blue-600"
            textCls="text-blue-600"
          />
          <StatCard
            title="已确认"
            count={counts.confirmed}
            icon={CheckCircle2}
            bgCls="bg-white border-gray-200"
            iconCls="bg-green-50 text-green-600"
            textCls="text-green-600"
          />
          <StatCard
            title="待补证据"
            count={counts.pending + counts.draft}
            icon={Clock}
            bgCls="bg-white border-gray-200"
            iconCls="bg-orange-50 text-orange-600"
            textCls="text-orange-600"
          />
          <StatCard
            title="已撤回"
            count={counts.withdrawn}
            icon={FileX2}
            bgCls="bg-white border-gray-200"
            iconCls="bg-gray-100 text-gray-500"
            textCls="text-gray-500"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SubmitSimulator />
          <WithdrawnEmbedDemo />
        </div>

        <DedupList aggregates={currentAggregates} />
      </div>
    </AppLayout>
  );
}
