import { useMemo, useState } from 'react';
import { ShieldCheck, Clock, AlertCircle } from 'lucide-react';
import type { RecallRecord, ExceptionCategory } from '@/types';
import { useWorkorderStore } from '@/store/workorderStore';
import { cn } from '@/lib/utils';
import { CATEGORY_EMOJI, CATEGORY_COLOR } from '@/constants/enums';

type TabKey = '全部' | '公式问题' | '单位问题' | '阈值问题';

const TABS: readonly TabKey[] = ['全部', '公式问题', '单位问题', '阈值问题'] as const;

const TAB_BORDER: Record<'公式问题' | '单位问题' | '阈值问题', string> = {
  公式问题: 'border-rose-500',
  单位问题: 'border-orange-500',
  阈值问题: 'border-violet-500',
};

interface ExceptionCardProps {
  recall: RecallRecord;
  onToggleConfirm: (id: string, confirmed: boolean) => void;
}

function ExceptionCard({ recall, onToggleConfirm }: ExceptionCardProps) {
  const workorder = useWorkorderStore(s =>
    s.workorders.find(w => w.id === recall.workorder_id),
  );

  return (
    <div
      className={cn(
        'card p-4 flex flex-col gap-3 relative overflow-hidden',
        CATEGORY_COLOR[recall.category],
      )}
    >
      <div
        className={cn(
          'absolute top-0 left-0 w-1 h-full',
          recall.category === '公式问题'
            ? 'bg-rose-500'
            : recall.category === '单位问题'
              ? 'bg-orange-500'
              : recall.category === '阈值问题'
                ? 'bg-violet-500'
                : 'bg-yellow-500',
        )}
      />
      <div className="pl-2 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-lg">{CATEGORY_EMOJI[recall.category]}</span>
            <span className={cn('badge border-none bg-transparent p-0 text-sm font-medium')}>
              {recall.category}
            </span>
          </div>
          <button
            onClick={() => onToggleConfirm(recall.id, !recall.safety_confirmed)}
            className={cn(
              'shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-xs font-medium border transition-all',
              recall.safety_confirmed
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30'
                : 'bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700',
            )}
          >
            {recall.safety_confirmed ? (
              <>
                <ShieldCheck className="w-3.5 h-3.5" />
                已确认
              </>
            ) : (
              <>
                <Clock className="w-3.5 h-3.5" />
                待确认
              </>
            )}
          </button>
        </div>

        <p className="text-sm text-slate-200 leading-relaxed">{recall.detail}</p>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <p className="text-slate-500 mb-0.5">原始值</p>
            <p className="text-slate-300 font-mono bg-slate-800/80 rounded px-2 py-1 truncate">
              {recall.original_value}
            </p>
          </div>
          <div>
            <p className="text-slate-500 mb-0.5">正确示例</p>
            <p className="text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded px-2 py-1">
              {recall.correct_example}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 pt-1 border-t border-slate-700/50">
          {workorder && (
            <span className="font-mono text-shield-300">{workorder.id}</span>
          )}
          <span>{recall.fields_involved}</span>
          <span className="text-slate-600">{recall.recall_time}</span>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span
            className={cn(
              'badge',
              recall.process_status === '已修正'
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                : recall.process_status === '处理中'
                  ? 'border-shield-500/40 bg-shield-500/10 text-shield-300'
                  : recall.process_status === '需人工确认'
                    ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                    : 'border-slate-600 bg-slate-800 text-slate-300',
            )}
          >
            {recall.process_status}
          </span>
          {recall.process_remark && (
            <span className="text-slate-400 truncate">{recall.process_remark}</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ExceptionReview() {
  const [activeTab, setActiveTab] = useState<TabKey>('全部');
  const recallRecords = useWorkorderStore(s => s.recall_records);
  const updateRecall = useWorkorderStore(s => s.updateRecall);

  const filtered = useMemo(() => {
    if (activeTab === '全部') return recallRecords;
    return recallRecords.filter(r => r.category === activeTab);
  }, [recallRecords, activeTab]);

  const confirmedCount = useMemo(
    () => recallRecords.filter(r => r.safety_confirmed).length,
    [recallRecords],
  );

  const handleToggleConfirm = (id: string, confirmed: boolean) => {
    updateRecall(id, { safety_confirmed: confirmed });
  };

  return (
    <div className="min-h-screen p-6 space-y-6 max-w-[1600px] mx-auto">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">异常复核</h1>
          <p className="text-sm text-slate-400 mt-1">
            公式 / 单位 / 阈值异常，安全员确认
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

      <section className="card p-1 inline-flex items-center gap-1">
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
              <span className="relative z-10">{tab}</span>
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

      {filtered.length > 0 ? (
        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(recall => (
            <ExceptionCard
              key={recall.id}
              recall={recall}
              onToggleConfirm={handleToggleConfirm}
            />
          ))}
        </section>
      ) : (
        <div className="card p-16 flex flex-col items-center justify-center text-center gap-3">
          <AlertCircle className="w-10 h-10 text-slate-600" />
          <p className="text-slate-400">当前分类下暂无异常记录</p>
          <p className="text-xs text-slate-600">
            {recallRecords.length === 0
              ? '请先导入或加载工单数据，系统将自动检测异常'
              : '切换其他标签查看其他类别异常'}
          </p>
        </div>
      )}
    </div>
  );
}
