import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  Syringe,
  Gauge,
  FileText,
  Clock,
  LayoutGrid,
  AlertCircle,
  ChevronRight,
  BookOpen,
  ArrowRight,
  MessageCircle,
} from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import QueueCard from '@/components/QueueCard';
import { useAppStore } from '@/store/useAppStore';
import type { ExceptionType } from '@shared/types';
import { cn } from '@/lib/utils';

type TabKey = 'all' | ExceptionType;

const TAB_LIST: { key: TabKey; label: string; icon: typeof AlertTriangle }[] = [
  { key: 'all', label: '全部', icon: LayoutGrid },
  { key: 'vaccine_missing', label: '疫苗缺失', icon: Syringe },
  { key: 'boundary_sample', label: '边界样本', icon: Gauge },
  { key: 'legacy_curve', label: '旧版曲线', icon: FileText },
  { key: 'pending_reason', label: '待确认', icon: Clock },
];

const STAT_CONFIG: Record<
  Exclude<TabKey, 'all'>,
  {
    label: string;
    icon: typeof Syringe;
    bg: string;
    iconBg: string;
    textColor: string;
    countBg: string;
    border: string;
    desc: string;
  }
> = {
  vaccine_missing: {
    label: '疫苗缺失',
    icon: Syringe,
    bg: 'from-cinnabar-50 to-white',
    iconBg: 'bg-cinnabar-600 text-white',
    textColor: 'text-cinnabar-700',
    countBg: 'text-cinnabar-700',
    border: 'border-cinnabar-200',
    desc: '紧急处理 · 直接影响结论可信度',
  },
  boundary_sample: {
    label: '边界样本',
    icon: Gauge,
    bg: 'from-amber-50 to-white',
    iconBg: 'bg-amber-500 text-white',
    textColor: 'text-amber-700',
    countBg: 'text-amber-700',
    border: 'border-amber-200',
    desc: '需二次确认 · 阈值±0.1℃ 范围内',
  },
  legacy_curve: {
    label: '旧版曲线',
    icon: FileText,
    bg: 'from-mist-50 to-white',
    iconBg: 'bg-mist-600 text-white',
    textColor: 'text-mist-700',
    countBg: 'text-mist-700',
    border: 'border-mist-300',
    desc: '灰色虚线数据 · 降低可信度',
  },
  pending_reason: {
    label: '待确认',
    icon: Clock,
    bg: 'from-forest-50 to-white',
    iconBg: 'bg-forest-600 text-white',
    textColor: 'text-forest-700',
    countBg: 'text-forest-700',
    border: 'border-forest-200',
    desc: '口头备注或待确认理由未填写',
  },
};

export default function ExceptionQueuePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { queue, queueLoading, fetchQueue, ackException } = useAppStore();

  const initialTab = (searchParams.get('type') as TabKey) || 'all';
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  useEffect(() => {
    const t = searchParams.get('type') as TabKey | null;
    if (t && TAB_LIST.some((x) => x.key === t)) {
      setActiveTab(t);
    }
  }, [searchParams]);

  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab);
    if (tab === 'all') {
      setSearchParams({});
    } else {
      setSearchParams({ type: tab });
    }
  };

  const openCounts = useMemo(() => {
    const result: Record<ExceptionType, number> = {
      vaccine_missing: 0,
      boundary_sample: 0,
      legacy_curve: 0,
      pending_reason: 0,
    };
    queue
      .filter((q) => q.status === 'open')
      .forEach((q) => {
        result[q.type] = (result[q.type] || 0) + 1;
      });
    return result;
  }, [queue]);

  const totalOpen = Object.values(openCounts).reduce((s, n) => s + n, 0);

  const filteredQueue = useMemo(() => {
    let items = queue;
    if (activeTab !== 'all') {
      items = items.filter((q) => q.type === activeTab);
    }
    return items.sort(
      (a, b) =>
        (a.status === 'open' ? 0 : 1) - (b.status === 'open' ? 0 : 1) ||
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [queue, activeTab]);

  const handleAck = async (itemId: string) => {
    const note = window.prompt('请输入处理备注说明（必填）：');
    if (!note || !note.trim()) {
      window.alert('处理备注不能为空');
      return;
    }
    try {
      await ackException(itemId, note.trim(), '阿宁');
    } catch (err) {
      window.alert(err instanceof Error ? err.message : '处理失败');
    }
  };

  const scrollToGuide = () => {
    const el = document.getElementById('bad-material-guide');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="flex min-h-screen bg-mist-50">
      <Sidebar />

      <main className="flex-1 min-w-0 overflow-x-hidden">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="mb-6 flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-6 h-6 text-amber-500" />
                <h1 className="font-serif text-2xl font-bold text-mist-900">
                  异常队列
                </h1>
                <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-2.5 rounded-full text-sm font-bold bg-cinnabar-600 text-white">
                  {totalOpen}
                </span>
              </div>
              <p className="text-mist-500 text-sm">
                系统自动识别的异常记录，请逐一排查处理。处理后将记录在历史时间线中。
              </p>
            </div>
            <button
              onClick={scrollToGuide}
              className="self-start inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm font-semibold hover:bg-amber-100 transition-colors"
            >
              <BookOpen className="w-4 h-4" />
              坏材料排查指南
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div
            id="bad-material-guide"
            className="mb-6 rounded-xl border-2 border-amber-300 bg-gradient-to-r from-amber-50 via-amber-50/70 to-white p-5 shadow-sm"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500 flex items-center justify-center shrink-0 shadow-md">
                <AlertCircle className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-serif text-lg font-bold text-amber-900 mb-2 flex items-center gap-2">
                  ⚠️ 坏材料排查指南
                  <span className="text-xs font-sans font-normal text-amber-700 bg-amber-200/60 px-2 py-0.5 rounded">
                    快速入门
                  </span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  <GuideItem
                    color="red"
                    icon={Syringe}
                    title="疫苗缺失"
                    desc="直接看「疫苗缺失」Tab，红色卡片最紧急"
                    tab="vaccine_missing"
                    onSelect={handleTabChange}
                  />
                  <GuideItem
                    color="gray"
                    icon={FileText}
                    title="旧版曲线"
                    desc="「旧版曲线」Tab，详情页可见灰色虚线"
                    tab="legacy_curve"
                    onSelect={handleTabChange}
                  />
                  <GuideItem
                    color="amber"
                    icon={Gauge}
                    title="边界样本"
                    desc="「边界样本」Tab，详情页影响因子标注"
                    tab="boundary_sample"
                    onSelect={handleTabChange}
                  />
                  <GuideItem
                    color="green"
                    icon={MessageCircle}
                    title="口头备注"
                    desc="「待确认」Tab + 详情页备注列表 source=verbal"
                    tab="pending_reason"
                    onSelect={handleTabChange}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {(Object.keys(STAT_CONFIG) as ExceptionType[]).map((type) => {
              const cfg = STAT_CONFIG[type];
              const Icon = cfg.icon;
              const count = openCounts[type];
              return (
                <button
                  key={type}
                  onClick={() => handleTabChange(type)}
                  className={cn(
                    'text-left rounded-xl border p-4 bg-gradient-to-br transition-all hover:shadow-md hover:-translate-y-0.5',
                    cfg.bg,
                    cfg.border,
                    activeTab === type && 'ring-2 ring-offset-2 ring-offset-mist-50',
                    activeTab === type && type === 'vaccine_missing' && 'ring-cinnabar-400',
                    activeTab === type && type === 'boundary_sample' && 'ring-amber-400',
                    activeTab === type && type === 'legacy_curve' && 'ring-mist-400',
                    activeTab === type && type === 'pending_reason' && 'ring-forest-400',
                  )}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div
                      className={cn(
                        'w-9 h-9 rounded-lg flex items-center justify-center',
                        cfg.iconBg,
                      )}
                    >
                      <Icon className="w-4.5 h-4.5" />
                    </div>
                    <span
                      className={cn(
                        'font-serif text-3xl font-bold',
                        cfg.countBg,
                      )}
                    >
                      {count}
                    </span>
                  </div>
                  <p className={cn('text-sm font-bold mb-0.5', cfg.textColor)}>
                    {cfg.label}
                  </p>
                  <p className="text-xs text-mist-500 leading-snug">{cfg.desc}</p>
                </button>
              );
            })}
          </div>

          <div className="card mb-6 !p-1.5 inline-flex flex-wrap gap-1.5 bg-mist-100/70 border-mist-200">
            {TAB_LIST.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.key;
              const count =
                tab.key === 'all'
                  ? totalOpen
                  : openCounts[tab.key as ExceptionType];
              return (
                <button
                  key={tab.key}
                  onClick={() => handleTabChange(tab.key)}
                  className={cn(
                    'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                    active
                      ? 'bg-white text-mist-900 shadow-sm ring-1 ring-mist-200'
                      : 'text-mist-600 hover:text-mist-800 hover:bg-white/50',
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                  <span
                    className={cn(
                      'inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 rounded-full text-[11px] font-bold',
                      active
                        ? 'bg-forest-700 text-white'
                        : 'bg-mist-200 text-mist-700',
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {queueLoading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="card animate-pulse">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-10 h-10 bg-mist-200 rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-mist-200 rounded w-1/3" />
                      <div className="h-3 bg-mist-100 rounded w-1/4" />
                    </div>
                  </div>
                  <div className="h-5 bg-mist-200 rounded w-2/3 mb-2" />
                  <div className="h-4 bg-mist-100 rounded w-full mb-1" />
                  <div className="h-4 bg-mist-100 rounded w-5/6 mb-3" />
                  <div className="h-12 bg-mist-100 rounded-lg" />
                </div>
              ))}
            </div>
          ) : filteredQueue.length === 0 ? (
            <div className="card text-center py-16">
              <AlertTriangle className="w-14 h-14 text-mist-200 mx-auto mb-4" />
              <p className="font-serif text-xl text-mist-700 mb-2">
                当前分类无异常记录
              </p>
              <p className="text-sm text-mist-400">
                {activeTab === 'all' ? '🎉 全部异常已处理完成' : '试试切换其他分类查看'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredQueue.map((item) => (
                <QueueCard key={item.id} item={item} onAck={handleAck} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function GuideItem({
  color,
  icon: Icon,
  title,
  desc,
  tab,
  onSelect,
}: {
  color: 'red' | 'gray' | 'amber' | 'green';
  icon: typeof Syringe;
  title: string;
  desc: string;
  tab: TabKey;
  onSelect: (t: TabKey) => void;
}) {
  const colorMap = {
    red: 'border-cinnabar-200 bg-white/80 hover:bg-cinnabar-50 text-cinnabar-700 border-l-4 border-l-cinnabar-500',
    gray: 'border-mist-300 bg-white/80 hover:bg-mist-50 text-mist-700 border-l-4 border-l-mist-500',
    amber: 'border-amber-200 bg-white/80 hover:bg-amber-50 text-amber-800 border-l-4 border-l-amber-500',
    green: 'border-forest-200 bg-white/80 hover:bg-forest-50 text-forest-700 border-l-4 border-l-forest-500',
  };
  return (
    <button
      onClick={() => onSelect(tab)}
      className={cn(
        'flex items-start gap-2 p-3 rounded-lg border text-left transition-all group',
        colorMap[color],
      )}
    >
      <Icon className="w-4 h-4 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold mb-0.5 flex items-center gap-1">
          {title}
          <ArrowRight className="w-3 h-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
        </p>
        <p className="text-xs text-mist-500 leading-snug">{desc}</p>
      </div>
    </button>
  );
}


