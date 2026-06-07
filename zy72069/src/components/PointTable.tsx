import { useStore } from '@/store/useStore';
import { STATUS_LABELS, STATUS_COLORS } from '@/types';
import type { PointStatus } from '@/types';
import { calculateStatistics, filterPoints } from '@/utils/statistics';

export default function PointTable() {
  const {
    points,
    selectedPointId,
    setSelectedPointId,
    filterStatus,
    filterSource,
    setFilterStatus,
    setFilterSource,
    anomalies,
  } = useStore();

  const filteredPoints = filterPoints(points, filterStatus, filterSource);
  const stats = calculateStatistics(points, anomalies);

  const toggleStatusFilter = (status: PointStatus) => {
    if (filterStatus.includes(status)) {
      setFilterStatus(filterStatus.filter((s) => s !== status));
    } else {
      setFilterStatus([...filterStatus, status]);
    }
  };

  const toggleSourceFilter = (source: string) => {
    if (filterSource.includes(source)) {
      setFilterSource(filterSource.filter((s) => s !== source));
    } else {
      setFilterSource([...filterSource, source]);
    }
  };

  const getAnomalyForPoint = (pointId: string) => anomalies.find((a) => a.pointId === pointId);

  return (
    <div className="flex flex-col h-full text-xs">
      <div className="p-2 border-b border-[#1a3a5c]">
        <div className="mb-1 text-[#888]">状态筛选</div>
        <div className="flex gap-1 flex-wrap">
          {(['pass', 'confirm', 'legacy'] as PointStatus[]).map((s) => (
            <button
              key={s}
              onClick={() => toggleStatusFilter(s)}
              className={`px-2 py-0.5 rounded text-[10px] border transition-colors ${
                filterStatus.includes(s)
                  ? 'border-transparent'
                  : 'border-[#333] opacity-40'
              }`}
              style={{
                backgroundColor: filterStatus.includes(s) ? STATUS_COLORS[s] + '33' : 'transparent',
                color: STATUS_COLORS[s],
              }}
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
        <div className="mb-1 mt-2 text-[#888]">来源筛选</div>
        <div className="flex gap-1 flex-wrap">
          {['点位表', '现场照片', 'GIS底图', '手改坐标'].map((source) => (
            <button
              key={source}
              onClick={() => toggleSourceFilter(source)}
              className={`px-2 py-0.5 rounded text-[10px] border transition-colors ${
                filterSource.includes(source)
                  ? 'border-[#0f3460] bg-[#0f3460]/30 text-[#4a90d9]'
                  : 'border-[#333] text-[#555] opacity-40'
              }`}
            >
              {source}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 bg-[#1a1a2e] z-10">
            <tr className="text-[#888] text-[10px]">
              <th className="text-left p-1.5 border-b border-[#1a3a5c]">ID</th>
              <th className="text-left p-1.5 border-b border-[#1a3a5c]">名称</th>
              <th className="text-left p-1.5 border-b border-[#1a3a5c]">状态</th>
              <th className="text-left p-1.5 border-b border-[#1a3a5c]">来源</th>
              <th className="text-left p-1.5 border-b border-[#1a3a5c]">GIS备注</th>
              <th className="text-left p-1.5 border-b border-[#1a3a5c]">处理备注</th>
              <th className="text-left p-1.5 border-b border-[#1a3a5c]">处理时间</th>
            </tr>
          </thead>
          <tbody>
            {filteredPoints.map((point) => {
              const anomaly = getAnomalyForPoint(point.id);
              const isSelected = selectedPointId === point.id;
              return (
                <tr
                  key={point.id}
                  onClick={() => setSelectedPointId(point.id)}
                  className={`cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-[#0f3460]/50'
                      : 'hover:bg-[#0f3460]/20'
                  }`}
                >
                  <td className="p-1.5 border-b border-[#111] text-[#4a90d9] font-mono">{point.id}</td>
                  <td className="p-1.5 border-b border-[#111] text-white">{point.name}</td>
                  <td className="p-1.5 border-b border-[#111]">
                    <span
                      className="px-1.5 py-0.5 rounded text-[10px]"
                      style={{
                        backgroundColor: STATUS_COLORS[point.status] + '22',
                        color: STATUS_COLORS[point.status],
                      }}
                    >
                      {STATUS_LABELS[point.status]}
                    </span>
                  </td>
                  <td className="p-1.5 border-b border-[#111] text-[#aaa]">{point.source}</td>
                  <td className="p-1.5 border-b border-[#111] text-[#f5a623] max-w-[120px] truncate" title={point.gisNote}>
                    {point.gisNote || '—'}
                  </td>
                  <td className="p-1.5 border-b border-[#111] text-[#aaa] max-w-[150px] truncate" title={anomaly ? anomaly.processNote : point.processNote}>
                    {anomaly ? anomaly.processNote : point.processNote || '—'}
                  </td>
                  <td className="p-1.5 border-b border-[#111] text-[#666] font-mono whitespace-nowrap">
                    {point.processTime}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="p-2 border-t border-[#1a3a5c] text-[#555] text-[10px]">
        共 {filteredPoints.length} / {stats.totalPoints} 条 · 未解决异常 {stats.unresolvedAnomalies} 条
      </div>
    </div>
  );
}
