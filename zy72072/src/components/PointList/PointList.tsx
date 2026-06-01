import { Search } from 'lucide-react';
import { useProjectStore } from '../../store/useProjectStore';
import { PointStatus } from '../../types';
import { cn } from '../../lib/utils';

const statusConfig = {
  normal: { label: '正常', color: 'bg-emerald-500', text: 'text-emerald-400' },
  pending: { label: '待确认', color: 'bg-amber-500', text: 'text-amber-400' },
  abnormal: { label: '异常', color: 'bg-red-500', text: 'text-red-400' },
};

const sourceColors: Record<string, string> = {
  '剧场灯位安全网': 'bg-blue-500/20 text-blue-400',
  '点位表导入': 'bg-emerald-500/20 text-emerald-400',
  '现场照片': 'bg-purple-500/20 text-purple-400',
  '方案备注': 'bg-cyan-500/20 text-cyan-400',
  '手改坐标': 'bg-orange-500/20 text-orange-400',
  'GIS底图补录': 'bg-gray-500/20 text-gray-400',
};

export const PointList = () => {
  const {
    lightPoints,
    selectedPointId,
    setSelectedPointId,
    statusFilter,
    setStatusFilter,
    searchQuery,
    setSearchQuery,
  } = useProjectStore();

  const filteredPoints = lightPoints.filter((p) => {
    const matchStatus = statusFilter === 'all' || p.status === statusFilter;
    const matchSearch =
      searchQuery === '' ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.source.includes(searchQuery);
    return matchStatus && matchSearch;
  });

  const stats = {
    total: lightPoints.length,
    normal: lightPoints.filter((p) => p.status === 'normal').length,
    pending: lightPoints.filter((p) => p.status === 'pending').length,
    abnormal: lightPoints.filter((p) => p.status === 'abnormal').length,
  };

  return (
    <div className="h-full flex flex-col bg-slate-900 text-white">
      <div className="p-4 border-b border-slate-700">
        <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
          <span className="w-2 h-6 bg-blue-500 rounded"></span>
          灯位清单
        </h2>

        <div className="flex gap-2 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="搜索点位..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div className="flex gap-1 bg-slate-800 rounded p-1">
          {(['all', 'normal', 'pending', 'abnormal'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={cn(
                'flex-1 py-1.5 px-2 rounded text-xs font-medium transition-all',
                statusFilter === status
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:text-white'
              )}
            >
              {status === 'all' ? (
                `全部 (${stats.total})`
              ) : (
                <>
                  {statusConfig[status].label} ({stats[status]})
                </>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {filteredPoints.length === 0 ? (
          <div className="text-center text-slate-500 py-8">
            没有匹配的点位
          </div>
        ) : (
          filteredPoints.map((point) => (
            <div
              key={point.id}
              onClick={() => setSelectedPointId(point.id)}
              className={cn(
                'p-3 rounded-lg cursor-pointer transition-all border',
                selectedPointId === point.id
                  ? 'bg-blue-900/50 border-blue-500'
                  : 'bg-slate-800/50 border-transparent hover:bg-slate-800 hover:border-slate-600'
              )}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span
                    className={cn('w-2 h-2 rounded-full', statusConfig[point.status].color)}
                  />
                  <span className="font-medium text-sm truncate max-w-32">
                    {point.name}
                  </span>
                </div>
                {point.source === '剧场灯位安全网' && (
                  <span className="text-xs bg-blue-500/30 text-blue-400 px-1.5 py-0.5 rounded">
                    安全网
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 mb-1">
                <span
                  className={cn(
                    'text-xs px-1.5 py-0.5 rounded',
                    sourceColors[point.source] || 'bg-slate-600/20 text-slate-400'
                  )}
                >
                  {point.source}
                </span>
                <span className="text-xs text-slate-500">
                  {point.sourceRow}
                </span>
              </div>

              <div className="text-xs text-slate-400 mt-1">
                X:{point.x.toFixed(1)} Y:{point.y.toFixed(1)} Z:{point.z.toFixed(1)}
              </div>

              <div className="text-xs text-slate-500 mt-1">
                {point.updateTime}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
