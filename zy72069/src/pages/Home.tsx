import Scene3D from '@/components/Scene3D';
import PointTable from '@/components/PointTable';
import SchemePanel from '@/components/SchemePanel';
import { useStore } from '@/store/useStore';
import { calculateStatistics, filterPoints } from '@/utils/statistics';
import { useNavigate } from 'react-router-dom';

export default function Home() {
  const { points, schemes, currentSchemeId, anomalies, filterStatus, filterSource } = useStore();
  const navigate = useNavigate();

  const currentScheme = schemes.find((s) => s.id === currentSchemeId);
  const stats = calculateStatistics(points, anomalies);
  const filteredPoints = filterPoints(points, filterStatus, filterSource);

  return (
    <div className="h-screen flex flex-col bg-[#0a0a1a] text-white overflow-hidden">
      <header className="flex items-center justify-between px-4 py-2 bg-[#1a1a2e] border-b border-[#1a3a5c]">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-bold tracking-wide">教学电场线空间台</h1>
          <span className="text-[10px] text-[#666]">
            {currentScheme?.name} ({currentScheme?.version})
          </span>
        </div>
        <div className="flex items-center gap-3 text-[10px]">
          <span className="text-[#16c79a]">通过 {stats.passCount}</span>
          <span className="text-[#f5a623]">确认 {stats.confirmCount}</span>
          <span className="text-[#e94560]">旧口径 {stats.legacyCount}</span>
          <span className="text-[#888]">|</span>
          <span className="text-[#e94560]">异常 {stats.unresolvedAnomalies}</span>
          <span className="text-[#888]">|</span>
          <span className="text-[#4a90d9]">显示 {filteredPoints.length}/{stats.totalPoints}</span>
          <button
            onClick={() => navigate('/report')}
            className="ml-2 px-3 py-1 bg-[#0f3460] hover:bg-[#1a4a80] text-white text-[10px] rounded transition-colors"
          >
            生成报告
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-[60%] border-r border-[#1a3a5c]">
          <Scene3D />
        </div>

        <div className="w-[40%] flex flex-col">
          <div className="h-[45%] border-b border-[#1a3a5c] overflow-hidden">
            <div className="px-2 py-1 bg-[#1a1a2e] border-b border-[#1a3a5c] text-[10px] text-[#888]">
              点位表格
            </div>
            <div className="h-[calc(100%-24px)]">
              <PointTable />
            </div>
          </div>

          <div className="h-[55%] overflow-hidden">
            <div className="px-2 py-1 bg-[#1a1a2e] border-b border-[#1a3a5c] text-[10px] text-[#888]">
              方案 & 详情
            </div>
            <div className="h-[calc(100%-24px)]">
              <SchemePanel />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
