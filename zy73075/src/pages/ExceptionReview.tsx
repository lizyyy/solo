import { useMemo, useState } from 'react';
import { ShieldCheck, AlertCircle, Users, Clock, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { useWorkorderStore } from '@/store/workorderStore';
import { cn } from '@/lib/utils';
import { CATEGORY_EMOJI } from '@/constants/enums';
import ExceptionCard from '@/components/exception/ExceptionCard';

type TabKey = '全部' | '公式问题' | '单位问题' | '阈值问题';
type StatusTabKey = '全部状态' | '待处理' | '处理中' | '已修正' | '需人工确认' | '已确认';

const TABS: readonly TabKey[] = ['全部', '公式问题', '单位问题', '阈值问题'] as const;
const STATUS_TABS: readonly StatusTabKey[] = [
  '全部状态',
  '待处理',
  '处理中',
  '已修正',
  '需人工确认',
  '已确认',
] as const;

const TAB_BORDER: Record<'公式问题' | '单位问题' | '阈值问题', string> = {
  公式问题: 'border-rose-500',
  单位问题: 'border-orange-500',
  阈值问题: 'border-violet-500',
};

const STATUS_STAT: Record<Exclude<StatusTabKey, '全部状态' | '已确认'>, {
  label: string;
  icon: typeof Clock;
  className: string;
}> = {
  待处理: { label: '待处理', icon: XCircle, className: 'text-slate-300 bg-slate-500/20 border-slate-500/40' },
  处理中: { label: '处理中', icon: Clock, className: 'text-blue-300 bg-blue-500/20 border-blue-500/40' },
  已修正: { label: '已修正待确认', icon: CheckCircle2, className: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30' },
  需人工确认: { label: '需项目经理介入', icon: AlertTriangle, className: 'text-amber-300 bg-amber-500/20 border-amber-500/40' },
};

export default function ExceptionReview() {
  const [activeTab, setActiveTab] = useState<TabKey>('全部');
  const [statusTab, setStatusTab] = useState<StatusTabKey>('全部状态');
  const recallRecords = useWorkorderStore(s => s.recall_records);

  const filtered = useMemo(() => {
    let list = recallRecords;
    if (activeTab !== '全部') {
      list = list.filter(r => r.category === activeTab);
    }
    if (statusTab === '已确认') {
      list = list.filter(r => r.safety_confirmed);
    } else if (statusTab !== '全部状态') {
      list = list.filter(r => r.process_status === statusTab);
    }
    return list;
  }, [recallRecords, activeTab, statusTab]);

  const confirmedCount = useMemo(
    () => recallRecords.filter(r => r.safety_confirmed).length,
    [recallRecords],
  );

  const statusStats = useMemo(() => {
    return {
      待处理: recallRecords.filter(r => r.process_status === '待处理').length,
      处理中: recallRecords.filter(r => r.process_status === '处理中').length,
      已修正: recallRecords.filter(r => r.process_status === '已修正' && !r.safety_confirmed).length,
      需人工确认: recallRecords.filter(r => r.process_status === '需人工确认').length,
    };
  }, [recallRecords]);

  return (
    <div className="min-h-screen p-6 space-y-6 max-w-[1700px] mx-auto">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">异常复核工作台</h1>
          <p className="text-sm text-slate-400 mt-1">
            公式 / 单位 / 阈值异常 → 标记处理 → 安全员确认 → 联动交接放行
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span className="text-slate-400">安全员确认进度：</span>
          <span className="font-semibold text-white tabular-nums">
            {confirmedCount}
            <span className="text-slate-500 font-normal"> / {recallRecords.length}</span>
          </span>
          {recallRecords.length > 0 && (
            <div className="w-24 h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all"
                style={{ width: `${(confirmedCount / recallRecords.length) * 100}%` }}
              />
            </div>
          )}
        </div>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(Object.keys(STATUS_STAT) as Array<keyof typeof STATUS_STAT>).map(key => {
          const stat = STATUS_STAT[key];
          const Icon = stat.icon;
          const count = statusStats[key];
          return (
            <div
              key={key}
              className={cn(
                'card p-4 flex items-start gap-3 border',
                stat.className,
              )}
            >
              <div className={cn('shrink-0 w-10 h-10 rounded-sm flex items-center justify-center border', stat.className)}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs uppercase tracking-wider opacity-70">{stat.label}</div>
                <div className="text-2xl font-mono font-bold mt-0.5 tabular-nums">{count}</div>
              </div>
            </div>
          );
        })}
      </section>

      <section className="card p-1 inline-flex flex-wrap items-center gap-1">
        {TABS.map(tab => {
          const isActive = activeTab === tab;
          const activeCategory = tab !== '全部' ? TAB_BORDER[tab] : 'border-shield-400';
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'relative px-4 py-2 text-sm font-medium transition-colors rounded-sm',
                isActive ? 'text-white' : 'text-slate-400 hover:text-slate-200',
              )}
            >
              <span className="relative z-10">
                {tab !== '全部' && CATEGORY_EMOJI[tab as '公式问题' | '单位问题' | '阈值问题']} {tab}
              </span>
              {isActive && (
                <span
                  className={cn(
                    'absolute left-2 right-2 -bottom-[1px] h-0.5 rounded-full',
                    activeCategory,
                  )}
                  style={{
                    backgroundColor:
                      tab === '公式问题'
                        ? '#f43f5e'
                        : tab === '单位问题'
                          ? '#f97316'
                          : tab === '阈值问题'
                            ? '#8b5cf6'
                            : '#3E838C',
                  }}
                />
              )}
            </button>
          );
        })}
      </section>

      <section className="card p-1 inline-flex flex-wrap items-center gap-1">
        <Users className="w-4 h-4 text-slate-500 ml-2 mr-1" />
        {STATUS_TABS.map(tab => {
          const isActive = statusTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setStatusTab(tab)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium transition-colors rounded-sm',
                isActive
                  ? 'bg-shield-500/20 text-shield-200 border border-shield-500/40'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent',
              )}
            >
              {tab}
            </button>
          );
        })}
      </section>

      {filtered.length > 0 ? (
        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(recall => (
            <ExceptionCard key={recall.id} recall={recall} />
          ))}
        </section>
      ) : (
        <div className="card p-16 flex flex-col items-center justify-center text-center gap-3">
          <AlertCircle className="w-10 h-10 text-slate-600" />
          <p className="text-slate-400">当前筛选下暂无异常记录</p>
          <p className="text-xs text-slate-600">
            {recallRecords.length === 0
              ? '请先导入或加载工单数据，系统将自动检测异常'
              : '切换分类或状态标签查看其他异常'}
          </p>
        </div>
      )}
    </div>
  );
}
