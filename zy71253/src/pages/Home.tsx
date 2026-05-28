import { useEffect } from 'react';
import PhaseCanvas3D from '@/components/PhaseCanvas3D';
import ParamSliders from '@/components/ParamSliders';
import TrajectoryPlayback from '@/components/TrajectoryPlayback';
import SidePanel from '@/components/SidePanel';
import ReportExport from '@/components/ReportExport';
import { useStore } from '@/store/useStore';
import { FileDown } from 'lucide-react';

export default function Home() {
  const recalculate = useStore((s) => s.recalculate);
  const openReportModal = useStore((s) => s.openReportModal);

  useEffect(() => {
    recalculate();
  }, [recalculate]);

  return (
    <div className="h-screen w-screen flex bg-[#060e1a] overflow-hidden"
      style={{ fontFamily: 'Noto Sans SC, sans-serif' }}>
      <div className="flex-1 flex flex-col relative">
        <header className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-5 py-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#FF6B4A] to-[#00D4AA] flex items-center justify-center">
              <span className="text-white text-xs font-black"
                style={{ fontFamily: 'JetBrains Mono, monospace' }}>φ</span>
            </div>
            <div>
              <h1
                className="text-sm font-bold text-[#aabbcc] leading-tight"
                style={{ fontFamily: 'JetBrains Mono, monospace' }}
              >
                微分方程相图岛
              </h1>
              <p className="text-[10px] text-[#556677]"
                style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                Phase Portrait Island
              </p>
            </div>
          </div>
          <button
            onClick={openReportModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#1a3050] bg-[#0d1b2e]/80 backdrop-blur-sm text-[#667788] hover:text-[#FF6B4A] hover:border-[#FF6B4A]/40 transition-colors text-xs"
            style={{ fontFamily: 'JetBrains Mono, monospace' }}
          >
            <FileDown size={14} />
            导出报告
          </button>
        </header>

        <div className="flex-1 relative">
          <PhaseCanvas3D />
        </div>

        <div className="absolute bottom-4 left-4 right-4 z-10">
          <div className="max-w-3xl mx-auto">
            <TrajectoryPlayback />
          </div>
        </div>

        <div className="absolute top-16 left-4 w-72 z-10">
          <ParamSliders />
        </div>
      </div>

      <SidePanel />
      <ReportExport />
    </div>
  );
}
