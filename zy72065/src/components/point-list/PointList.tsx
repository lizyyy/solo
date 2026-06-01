import { Search, Filter, AlertTriangle, XCircle, Map, Tablet, FileSpreadsheet } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { useFilteredPoints } from '../../hooks/useFilteredPoints';
import { getStatusColor, getStatusLabel, getSourceLabel } from '../../utils/terrain';

interface PointListProps {
  onPointClick: (pointId: string) => void;
}

export function PointList({ onPointClick }: PointListProps) {
  const filteredPoints = useFilteredPoints();
  const selectedPointId = useStore((state) => state.selectedPointId);
  const searchQuery = useStore((state) => state.searchQuery);
  const setSearchQuery = useStore((state) => state.setSearchQuery);
  const filters = useStore((state) => state.filters);
  const setFilters = useStore((state) => state.setFilters);

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'gis':
        return <Map size={14} />;
      case 'tablet':
        return <Tablet size={14} />;
      case 'excel':
        return <FileSpreadsheet size={14} />;
      default:
        return null;
    }
  };

  const toggleStatusFilter = (status: string) => {
    const currentStatus = filters.status;
    if (currentStatus.includes(status as any)) {
      setFilters({ status: currentStatus.filter((s) => s !== status) as any });
    } else {
      setFilters({ status: [...currentStatus, status] as any });
    }
  };

  const toggleSourceFilter = (source: string) => {
    const currentSource = filters.source;
    if (currentSource.includes(source as any)) {
      setFilters({ source: currentSource.filter((s) => s !== source) as any });
    } else {
      setFilters({ source: [...currentSource, source] as any });
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-900 border-r border-gray-800">
      <div className="p-4 border-b border-gray-800">
        <h2 className="text-lg font-semibold text-white mb-3">监测点位</h2>
        
        <div className="relative mb-3">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="搜索点位名称或ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Filter size={14} />
            <span>状态筛选</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {['normal', 'warning', 'danger'].map((status) => (
              <button
                key={status}
                onClick={() => toggleStatusFilter(status)}
                className={`px-2 py-1 text-xs rounded border transition-colors ${
                  filters.status.includes(status as any)
                    ? 'border-blue-500 bg-blue-500/20 text-blue-400'
                    : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600'
                }`}
              >
                <span
                  className="inline-block w-2 h-2 rounded-full mr-1"
                  style={{ backgroundColor: getStatusColor(status) }}
                />
                {getStatusLabel(status)}
              </button>
            ))}
          </div>
        </div>
        
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Filter size={14} />
            <span>来源筛选</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {['gis', 'tablet', 'excel'].map((source) => (
              <button
                key={source}
                onClick={() => toggleSourceFilter(source)}
                className={`px-2 py-1 text-xs rounded border transition-colors flex items-center gap-1 ${
                  filters.source.includes(source as any)
                    ? 'border-blue-500 bg-blue-500/20 text-blue-400'
                    : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600'
                }`}
              >
                {getSourceIcon(source)}
                {getSourceLabel(source)}
              </button>
            ))}
          </div>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        {filteredPoints.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm">
            暂无匹配的点位数据
          </div>
        ) : (
          <div className="divide-y divide-gray-800">
            {filteredPoints.map((point) => (
              <div
                key={point.id}
                onClick={() => onPointClick(point.id)}
                className={`p-3 cursor-pointer transition-colors hover:bg-gray-800/50 ${
                  selectedPointId === point.id ? 'bg-gray-800 border-l-2 border-blue-500' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: getStatusColor(point.status) }}
                      />
                      <span className="text-sm font-medium text-white truncate">
                        {point.name}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-gray-500 font-mono">
                      {point.id}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-gray-400">
                      {getSourceIcon(point.source)}
                      <span>位移: <span className="text-gray-300">{point.displacement.toFixed(1)}mm</span></span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 ml-2">
                    {point.hasConflict && (
                      <div className="p-1 rounded bg-yellow-500/20 text-yellow-500" title="存在数据冲突">
                        <AlertTriangle size={12} />
                      </div>
                    )}
                    {point.isCorrupted && (
                      <div className="p-1 rounded bg-red-500/20 text-red-500" title="数据损坏">
                        <XCircle size={12} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      <div className="p-3 border-t border-gray-800 bg-gray-900/50">
        <div className="text-xs text-gray-500 text-center">
          共 <span className="text-gray-300">{filteredPoints.length}</span> 个点位
        </div>
      </div>
    </div>
  );
}
