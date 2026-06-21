import { useAppStore } from '../store/useStore';
import TopBar from '../components/layout/TopBar';
import StatusBar from '../components/layout/StatusBar';
import Scene3D from '../components/scene3d/Scene3D';
import SchemeSummary from '../components/panels/SchemeSummary';
import SideNotes from '../components/panels/SideNotes';
import AnomalyList from '../components/panels/AnomalyList';
import Timeline from '../components/panels/Timeline';
import HudCard from '../components/common/HudCard';
import { Info, MousePointer2, RotateCcw, Grid3x3, AlertOctagon } from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import { useEffect } from 'react';

export default function Home() {
  const activeTab = useAppStore((s) => s.activePanelTab);
  const setTab = useAppStore.getState().setActivePanelTab;
  const selectedScheme = useAppStore((s) => s.selectedSchemeId);
  const selectAnomaly = useAppStore.getState().selectAnomaly;
  const anomalies = useAppStore((s) => s.anomalies);
  const notesImported = useAppStore((s) => s.notesImported);

  const activeAnomalies = anomalies.filter(
    (a) => a.status !== 'resolved' && a.schemeId === selectedScheme,
  );

  useEffect(() => {
    useAppStore.getState().importSampleNotes();
  }, []);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#070b16] text-slate-100">
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 12% 18%, rgba(59,130,246,0.18), transparent 55%), radial-gradient(circle at 85% 80%, rgba(245,158,11,0.12), transparent 50%), radial-gradient(circle at 50% 50%, rgba(15,23,42,0.6), transparent 80%)',
        }}
      />
      <TopBar />
      <div className="relative z-10 grid flex-1 min-h-0 gap-3 p-3 overflow-hidden" style={{ gridTemplateColumns: 'minmax(0, 1.45fr) minmax(420px, 1fr)' }}>
        <div className="flex min-h-0 flex-col gap-3">
          <HudCard
            title={`屋面 3D 场景 · 方案 ${selectedScheme}`}
            accent="none"
            icon={<Grid3x3 size={12} className="text-slate-400" />}
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            <div className="relative flex-1 min-h-[360px]">
              <Scene3D />
              <div className="pointer-events-none absolute left-3 top-3 z-10 space-y-1">
                <div className="pointer-events-auto flex items-center gap-1.5 rounded border border-blue-500/40 bg-slate-950/70 backdrop-blur px-2 py-1 text-[10.5px] text-blue-200">
                  <MousePointer2 size={11} />
                  鼠标左键：旋转 · 右键：平移 · 滚轮：缩放
                </div>
                <div className="pointer-events-auto flex items-center gap-1.5 rounded border border-red-500/40 bg-slate-950/70 backdrop-blur px-2 py-1 text-[10.5px] text-red-200">
                  <AlertOctagon size={11} />
                  红色闪烁区域 = 图层/附件异常，点击可跳转详情
                </div>
              </div>
              <div className="absolute right-3 top-3 z-10 flex flex-col gap-1.5">
                <button
                  onClick={() => selectAnomaly(undefined)}
                  className="pointer-events-auto flex items-center gap-1 rounded border border-slate-600/60 bg-slate-900/70 backdrop-blur px-2 py-1 text-[10.5px] text-slate-300 hover:bg-slate-800/80 transition-colors"
                >
                  <RotateCcw size={11} />
                  视角复位
                </button>
                {activeAnomalies.length > 0 && (
                  <button
                    onClick={() => {
                      setTab('anomaly');
                      selectAnomaly(activeAnomalies[0].id);
                    }}
                    className="pointer-events-auto flex items-center gap-1 rounded border border-red-500/60 bg-red-500/15 backdrop-blur px-2 py-1 text-[10.5px] text-red-200 hover:bg-red-500/25 transition-colors"
                  >
                    <AlertOctagon size={11} />
                    跳首个活跃异常
                  </button>
                )}
              </div>
              {!notesImported && (
                <div className="absolute inset-x-8 bottom-6 z-10 mx-auto max-w-lg">
                  <div className="flex items-start gap-2 rounded-lg border border-blue-500/50 bg-slate-950/85 backdrop-blur px-3 py-2.5 shadow-[0_0_30px_-6px_rgba(59,130,246,0.6)]">
                    <Info size={14} className="mt-0.5 shrink-0 text-blue-400" />
                    <div className="text-[11.5px] leading-relaxed text-slate-200">
                      正在加载 BIM 备注样例（8 条）… 其中包含
                      <span className="text-red-300 mx-1">图层命名混乱</span>、
                      <span className="text-orange-300 mx-1">晚到附件</span>、
                      <span className="text-blue-300 mx-1">正常备注</span>。
                      自动校验后会把异常从正常结果中单独拎出，不卡比选流程。
                    </div>
                  </div>
                </div>
              )}
            </div>
          </HudCard>

          <div className="h-[32%] min-h-[220px]">
            <Timeline />
          </div>
        </div>

        <div className="flex min-h-0 flex-col gap-3 overflow-hidden">
          <SchemeSummary />

          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
            <div className="flex shrink-0 items-center gap-1 rounded-md border border-slate-700/60 bg-slate-900/50 p-1 self-start">
              <button
                onClick={() => setTab('side')}
                className={twMerge(
                  'flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[11.5px] transition-all',
                  activeTab === 'side'
                    ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/40'
                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200 border border-transparent',
                )}
              >
                📘 侧边说明 + 场景标注
              </button>
              <button
                onClick={() => setTab('anomaly')}
                className={twMerge(
                  'relative flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[11.5px] transition-all',
                  activeTab === 'anomaly'
                    ? 'bg-red-500/20 text-red-200 border border-red-500/50'
                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200 border border-transparent',
                )}
              >
                🚨 异常记录
                {activeAnomalies.length > 0 && (
                  <span className="ml-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 font-mono text-[9.5px] font-bold text-white"
                        style={{ fontFamily: '"JetBrains Mono", monospace' }}>
                    {activeAnomalies.length}
                  </span>
                )}
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden">
              {activeTab === 'side' ? <SideNotes /> : <AnomalyList />}
            </div>
          </div>
        </div>
      </div>
      <StatusBar />
    </div>
  );
}
