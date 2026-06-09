import Scene3D from '../components/Scene3D';
import RemarksPanel from '../components/RemarksPanel';
import FilterSidebar from '../components/FilterSidebar';
import GuideOverlay from '../components/GuideOverlay';
import { useReviewStore } from '../store/reviewStore';
import { SCHEME_COLORS, STATUS_LABEL } from '../data/mockData';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Layers, FileText } from 'lucide-react';

export default function HomePage() {
  const { showGuide, activeScheme, records, selectedZoneId, zones, anomalies } = useReviewStore();
  const schemeConf = SCHEME_COLORS[activeScheme];

  const quickSummary = useMemo(() => {
    const sr = records.filter((r) => r.schemeId === activeScheme);
    const selZone = zones.find((z) => z.id === selectedZoneId);
    const selRec = records.find((r) => r.zoneId === selectedZoneId && r.schemeId === activeScheme);
    const selAnoms = anomalies.filter((a) => a.zoneId === selectedZoneId && a.schemeId === activeScheme);
    const globalAnoms = anomalies.filter((a) => a.schemeId === activeScheme && !a.resolved);
    return { sr, selZone, selRec, selAnoms, globalAnoms };
  }, [activeScheme, records, selectedZoneId, zones, anomalies]);

  return (
    <div className="h-full flex bg-[#0E1521]">
      <FilterSidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex-1 flex min-h-0">
          <div className="flex-1 relative min-w-0">
            <Scene3D />

            {quickSummary.globalAnoms.length > 0 && (
              <Link
                to="/anomaly"
                className="absolute top-4 right-4 z-10 flex items-center gap-2 px-3.5 py-2 rounded-[5px] border-2 bg-rose-500/15 backdrop-blur-sm border-rose-400/60 text-rose-200 font-mono text-[11px] tracking-wider hover:bg-rose-500/25 transition-all shadow-lg shadow-rose-900/30"
              >
                <AlertTriangle size={13} className="animate-pulse" />
                <span>
                  方案 {activeScheme} 还有 <b className="text-rose-100 text-[12px]">{quickSummary.globalAnoms.length}</b> 项未解决异常
                </span>
              </Link>
            )}

            <div className="absolute top-4 right-48 z-10 flex items-center gap-2 px-3 py-1.5 rounded-[4px] bg-slate-900/75 backdrop-blur border border-slate-600/50 font-mono text-[10.5px] text-slate-400 tracking-wider">
              <Layers size={12} style={{ color: schemeConf.main }} />
              <span>{schemeConf.label} · 共 {quickSummary.sr.length} 条记录</span>
            </div>
          </div>

          <div className="w-[460px] flex-shrink-0 border-l-2 border-slate-700/70 bg-gradient-to-b from-[#141C2A] to-[#0F1621] flex flex-col">
            <div className="px-4 py-3 border-b border-slate-700/60 flex items-center justify-between bg-slate-900/40">
              <div className="flex items-center gap-2">
                <FileText size={14} className="text-sky-400" />
                <span className="font-mono text-[11.5px] tracking-[0.18em] text-slate-200 font-bold">三源备注 · 口径对比</span>
              </div>
              {quickSummary.selZone && (
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ background: quickSummary.selZone.color[activeScheme], boxShadow: `0 0 8px ${quickSummary.selZone.color[activeScheme]}` }}
                  />
                  <span className="font-mono text-[10.5px] text-slate-400">
                    {quickSummary.selZone.color[activeScheme].toUpperCase()}
                  </span>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-auto px-4 py-4" style={{ scrollbarWidth: 'thin' }}>
              <RemarksPanel />
            </div>

            {quickSummary.selRec && (
              <div className="px-4 py-3 border-t border-slate-700/60 bg-slate-950/50">
                <div className="flex items-center gap-2 font-mono text-[10px] text-slate-500 tracking-widest mb-1.5">
                  <span>当前选中记录 · 状态</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={'px-2.5 py-1 rounded-[3px] font-mono text-[10.5px] tracking-wider border-2 ' + STATUS_LABEL[quickSummary.selRec.status].bg + ' ' + STATUS_LABEL[quickSummary.selRec.status].border + ' ' + STATUS_LABEL[quickSummary.selRec.status].color}>
                    {STATUS_LABEL[quickSummary.selRec.status].text}
                  </span>
                  {quickSummary.selAnoms.length > 0 && (
                    <span className="px-2 py-1 rounded-[3px] font-mono text-[10px] bg-rose-500/10 border border-rose-400/50 text-rose-200">
                      ⚠ 关联 {quickSummary.selAnoms.length} 项异常
                    </span>
                  )}
                  <span className="ml-auto font-mono text-[10px] text-slate-600">
                    REC · {quickSummary.selRec.id}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showGuide && <GuideOverlay />}
    </div>
  );
}
