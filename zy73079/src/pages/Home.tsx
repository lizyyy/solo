import { useEffect } from 'react';
import {
  BarChart3,
  FileSearch,
  ClipboardList,
  Wrench,
  UploadCloud,
  BookOpen,
  HardHat,
  Bell,
  RotateCcw,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import AnomalyChart from '../components/AnomalyChart';
import AnomalyList from '../components/AnomalyList';
import InspectionDetail from '../components/InspectionDetail';
import ReplacementPanel from '../components/ReplacementPanel';
import ImportPanel from '../components/ImportPanel';
import ReportPanel from '../components/ReportPanel';
import RemarkForm from '../components/RemarkForm';
import CriterionDrawer from '../components/CriterionDrawer';
import Toast from '../components/Toast';
import { formatTime } from '../utils';

const TABS = [
  { key: 'detail' as const, label: '巡检表详情', icon: ClipboardList },
  { key: 'remark' as const, label: '异常归因', icon: FileSearch },
  { key: 'replace' as const, label: '备件替换', icon: Wrench, badge: true },
  { key: 'import' as const, label: '数据导入', icon: UploadCloud },
  { key: 'report' as const, label: '报告结论', icon: BookOpen },
];

export default function Home() {
  const {
    initIfNeeded,
    activeTab,
    setActiveTab,
    inspections,
    remarks,
    replacements,
    importLogs,
    criterion,
    resetAll,
  } = useAppStore();

  useEffect(() => {
    initIfNeeded();
  }, [initIfNeeded]);

  const alarmCount = inspections.filter((i) => i.isAlarm).length;
  const pendingAnomaly = useAppStore.getState().attributions.filter(
    (a) => a.status === 'pending'
  ).length;

  return (
    <div className="h-full w-full flex flex-col bg-slate-950 text-slate-100">
      <header className="flex items-center justify-between px-5 py-2.5 border-b border-slate-800 bg-slate-900/95 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shadow-lg shadow-orange-500/20">
            <HardHat size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-wide" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
              盾构刀盘异常归因
            </h1>
            <div className="text-[10px] text-slate-500 leading-none mt-0.5">
              TBM Cutterhead Anomaly Attribution · 口径 {criterion.version}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="hidden md:flex items-center gap-3 text-[11px] text-slate-400 pr-3 border-r border-slate-700">
            <span className="inline-flex items-center gap-1">
              <BarChart3 size={11} className="text-blue-400" />
              巡检 {inspections.length}
            </span>
            <span className="inline-flex items-center gap-1">
              <Bell size={11} className={alarmCount > 0 ? 'text-red-400 animate-pulse' : 'text-slate-500'} />
              报警 {alarmCount}
            </span>
            <span className="inline-flex items-center gap-1">
              <ClipboardList size={11} className="text-emerald-400" />
              备注 {remarks.length}
            </span>
            <span className="inline-flex items-center gap-1">
              <Wrench size={11} className="text-orange-400" />
              替换 {replacements.length}
            </span>
            <span className="inline-flex items-center gap-1">
              <FileSearch size={11} className={pendingAnomaly > 0 ? 'text-amber-400' : 'text-slate-500'} />
              待确认 {pendingAnomaly}
            </span>
          </div>
          <button
            onClick={resetAll}
            title="重置所有数据（服务重启测试）"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded text-[11px] border border-slate-700 bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition"
          >
            <RotateCcw size={11} /> 重置数据
          </button>
          <div className="text-[10px] text-slate-500 pl-2 border-l border-slate-800">
            {formatTime(Date.now())}
          </div>
        </div>
      </header>

      <div className="flex-1 flex min-h-0 overflow-hidden">
        <aside className="w-[62px] border-r border-slate-800 bg-slate-900/60 flex flex-col items-center py-3 gap-1.5 hidden md:flex">
          {TABS.map((t) => {
            const Icon = t.icon;
            const isActive = activeTab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                title={t.label}
                className={`relative w-11 h-11 rounded-lg flex items-center justify-center transition ${
                  isActive
                    ? 'bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/40'
                    : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'
                }`}
              >
                <Icon size={19} />
                {t.badge && replacements.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-orange-500 text-white text-[9px] font-semibold flex items-center justify-center border border-slate-900">
                    {replacements.length}
                  </span>
                )}
              </button>
            );
          })}
        </aside>

        <main className="flex-1 flex flex-col min-w-0">
          <div className="md:hidden flex items-center gap-1 p-2 border-b border-slate-800 overflow-x-auto">
            {TABS.map((t) => {
              const Icon = t.icon;
              const isActive = activeTab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  className={`whitespace-nowrap inline-flex items-center gap-1 px-3 py-1.5 rounded text-xs transition ${
                    isActive
                      ? 'bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/40'
                      : 'text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  <Icon size={13} /> {t.label}
                </button>
              );
            })}
          </div>

          <div className="flex-1 grid grid-cols-1 xl:grid-cols-12 gap-0 min-h-0">
            <section className="xl:col-span-6 flex flex-col min-h-0 border-r border-slate-800">
              <div className="h-[320px] min-h-[280px] border-b border-slate-800">
                <AnomalyChart />
              </div>
              <div className="flex-1 min-h-0">
                <AnomalyList />
              </div>
            </section>

            <section className="xl:col-span-6 flex flex-col min-h-0">
              {activeTab === 'detail' && (
                <div className="h-full min-h-0 flex flex-col">
                  <div className="px-4 py-2 border-b border-slate-800 flex items-center justify-between">
                    <div className="text-xs text-slate-400 flex items-center gap-1.5">
                      <ClipboardList size={13} className="text-blue-400" />
                      巡检表详情 · 含备注影响标记
                    </div>
                    {importLogs.length > 0 && (
                      <span className="text-[10px] text-slate-500">
                        最近导入：{importLogs[0]?.fileName.slice(0, 20)}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-h-0">
                    <InspectionDetail />
                  </div>
                </div>
              )}

              {activeTab === 'remark' && (
                <div className="h-full min-h-0 flex flex-col">
                  <div className="px-4 py-2 border-b border-slate-800 text-xs text-slate-400 flex items-center gap-1.5">
                    <FileSearch size={13} className="text-amber-400" />
                    异常归因列表（与左下同源，可在此查看全部）
                  </div>
                  <div className="flex-1 min-h-0">
                    <AnomalyList />
                  </div>
                </div>
              )}

              {activeTab === 'replace' && (
                <div className="h-full min-h-0">
                  <ReplacementPanel />
                </div>
              )}

              {activeTab === 'import' && (
                <div className="h-full min-h-0">
                  <ImportPanel />
                </div>
              )}

              {activeTab === 'report' && (
                <div className="h-full min-h-0">
                  <ReportPanel />
                </div>
              )}
            </section>
          </div>
        </main>
      </div>

      <RemarkForm />
      <CriterionDrawer />
      <Toast />
    </div>
  );
}
