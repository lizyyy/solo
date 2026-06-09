import Scene3D from '@/components/Scene3D';
import VersionTimeline from '@/components/VersionTimeline';
import SourceFilter from '@/components/SourceFilter';
import SummaryCard from '@/components/SummaryCard';
import ZoneDetailPanel from '@/components/ZoneDetailPanel';
import HistoryPanel from '@/components/HistoryPanel';
import OffsetWarningBar from '@/components/OffsetWarningBar';
import GuideDrawer from '@/components/GuideDrawer';
import { ShieldAlert, Gauge } from 'lucide-react';

export default function Home() {
  return (
    <div className="w-screen h-screen flex flex-col bg-eng-bg text-eng-text overflow-hidden">
      <OffsetWarningBar />

      <div className="flex items-center justify-between px-4 py-2 border-b border-eng-border bg-eng-panel">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 border-2 border-eng-line flex items-center justify-center">
            <ShieldAlert size={18} className="text-eng-line" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-wide">
              消防分区图纸复核 · Web3D
            </h1>
            <p className="text-[10px] text-eng-muted font-mono">
              Fire Compartment Drawing Review · 仅服务复核判断 · 版本 × 来源 × 对象 × 摘要 四方联动
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-eng-muted font-mono">
          <Gauge size={12} className="text-eng-pass" />
          <span>运行中</span>
          <span className="text-eng-border">|</span>
          <span>CAD 图层 / 后补备注 / 口头备注 三来源自动追溯</span>
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        <aside className="w-[260px] shrink-0 border-r border-eng-border bg-eng-bg overflow-y-auto space-y-3 p-3">
          <VersionTimeline />
          <SourceFilter />
        </aside>

        <main className="flex-1 relative min-w-0">
          <Scene3D />
          <div className="absolute top-3 right-3 z-10">
            <SummaryCard />
          </div>
        </main>
      </div>

      <ZoneDetailPanel />
      <HistoryPanel />
      <GuideDrawer />
    </div>
  );
}
