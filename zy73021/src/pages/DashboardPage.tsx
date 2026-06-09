import { useEffect, useMemo } from 'react';
import { useAppStore, filterAlerts } from '@/store/appStore';
import Header from '@/components/Header';
import FilterPanel from '@/components/FilterPanel';
import AlertCard from '@/components/AlertCard';
import DetailSidebar from '@/components/DetailSidebar';
import { Search } from 'lucide-react';

export default function DashboardPage() {
  const alerts = useAppStore((s) => s.alerts);
  const filter = useAppStore((s) => s.filter);
  const selectedId = useAppStore((s) => s.selectedAlertId);
  const selectAlert = useAppStore((s) => s.selectAlert);
  const syncFilterToUrl = useAppStore((s) => s.syncFilterToUrl);
  const loadFilterFromUrl = useAppStore((s) => s.loadFilterFromUrl);

  // 初始化：先 URL 再 localStorage
  useEffect(() => {
    loadFilterFromUrl();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 筛选变更后同步到 URL + localStorage
  useEffect(() => {
    syncFilterToUrl();
  }, [filter, syncFilterToUrl]);

  const filtered = useMemo(() => filterAlerts(alerts, filter), [alerts, filter]);
  const selected = alerts.find((a) => a.id === selectedId) ?? null;

  // 未读数量
  const unreadCount = alerts.filter((a) => !a.isRead).length;
  const severeCount = alerts.filter((a) => a.severity === 'severe').length;

  return (
    <div className="min-h-screen bg-bg bg-grid">
      <Header total={alerts.length} filtered={filtered.length} />

      <main className="max-w-[1600px] mx-auto px-6 py-6">
        {/* 顶部小卡片：关键指标 */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <MetricCard
            label="待处理提醒"
            value={alerts.filter((a) => a.currentStatus === 'pending').length}
            accent="slate"
          />
          <MetricCard
            label="处理中（重度）"
            value={severeCount}
            accent="rose"
            pulse={severeCount > 0}
          />
          <MetricCard
            label="未读标记"
            value={unreadCount}
            accent="amber"
          />
          <MetricCard
            label="本月已完成"
            value={alerts.filter((a) => a.currentStatus === 'resolved' && a.alertDate.startsWith('2026-06')).length}
            accent="emerald"
          />
        </div>

        <div className="flex gap-6 items-start">
          <FilterPanel />

          {/* 列表区 */}
          <section className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="font-serif text-xl font-semibold text-slate-800">
                  异常提醒列表
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {filtered.length > 0
                    ? `显示 ${filtered.length} / ${alerts.length} 条 · 点击卡片查看详情，筛选条件刷新不丢失`
                    : `无匹配结果（总共 ${alerts.length} 条）`}
                </p>
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="card p-16 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                  <Search size={24} />
                </div>
                <h3 className="font-serif text-lg font-semibold text-slate-700 mb-1">没有匹配的异常提醒</h3>
                <p className="text-sm text-slate-500">请调整左侧筛选条件，或点击「重置」恢复默认。</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 max-h-[calc(100vh-280px)] overflow-y-auto pr-1 content-start">
                {filtered.map((a) => (
                  <AlertCard key={a.id} alert={a} selected={selectedId === a.id} />
                ))}
              </div>
            )}
          </section>

          {/* 详情侧栏 */}
          {selected ? (
            <DetailSidebar alert={selected} onClose={() => selectAlert(null)} />
          ) : (
            <div className="w-[520px] shrink-0 h-[calc(100vh-280px)] card p-12 flex flex-col items-center justify-center text-center border-2 border-dashed border-slate-200 bg-white/60">
              <div className="w-20 h-20 rounded-2xl bg-brand-50 flex items-center justify-center text-brand-400 mb-4 shadow-inner">
                <Search size={32} />
              </div>
              <h3 className="font-serif text-xl font-semibold text-slate-700 mb-2">请选择一条异常提醒</h3>
              <p className="text-sm text-slate-500 max-w-xs">
                从左侧列表点击卡片查看详情，可追加备注、上传疫苗照（分批）、修改用药、重跑判断或导出 CSV。
              </p>
              <div className="mt-6 grid grid-cols-2 gap-3 text-xs w-full max-w-sm">
                <Tip color="teal">✅ 刷新页面筛选条件不丢失</Tip>
                <Tip color="amber">✅ 疫苗照分批上传不覆盖</Tip>
                <Tip color="rose">✅ 历史判断快照可追溯</Tip>
                <Tip color="brand">✅ CSV与页面完全同源</Tip>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function MetricCard({
  label,
  value,
  accent,
  pulse,
}: {
  label: string;
  value: number;
  accent: 'slate' | 'rose' | 'amber' | 'emerald';
  pulse?: boolean;
}) {
  const map = {
    slate: { chip: 'bg-slate-100 text-slate-700', bar: 'from-slate-400 to-slate-500', num: 'text-slate-800' },
    rose: { chip: 'bg-rose-50 text-rose-700', bar: 'from-rose-400 to-danger', num: 'text-rose-700' },
    amber: { chip: 'bg-amber-50 text-amber-700', bar: 'from-amber-400 to-warn', num: 'text-amber-700' },
    emerald: { chip: 'bg-emerald-50 text-emerald-700', bar: 'from-emerald-400 to-health', num: 'text-emerald-700' },
  }[accent];
  return (
    <div className="card p-4 relative overflow-hidden group hover:shadow-panel transition">
      <div className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${map.bar}`} />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-slate-500 mb-1">{label}</p>
          <p className={`font-serif text-3xl font-bold ${map.num} ${pulse ? 'animate-pulse-soft' : ''}`}>
            {value}
          </p>
        </div>
        <span className={`chip ${map.chip}`}>当前</span>
      </div>
    </div>
  );
}

function Tip({ children, color }: { children: React.ReactNode; color: string }) {
  const map: Record<string, string> = {
    teal: 'bg-teal-50 text-teal-700 border-teal-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    rose: 'bg-rose-50 text-rose-700 border-rose-100',
    brand: 'bg-brand-50 text-brand-700 border-brand-100',
  };
  return (
    <div className={`px-3 py-2 rounded-lg border text-left ${map[color]}`}>
      {children}
    </div>
  );
}
