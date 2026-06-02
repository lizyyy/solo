import { useEffect, useState } from 'react';
import { useAppStore } from '@/store';
import StatusBadge from '@/components/ui/StatusBadge';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { formatDateTime, getTimePeriodText } from '@/utils/export';
import { MapPin, Navigation, AlertTriangle, Merge, Eye } from 'lucide-react';
import type { Point, PointStatus } from '@/types';

const statusOptions: { value: PointStatus | 'all'; label: string }[] = [
  { value: 'all', label: '全部状态' },
  { value: 'pending', label: '待处理' },
  { value: 'processing', label: '处理中' },
  { value: 'verified', label: '已核实' },
  { value: 'completed', label: '已完成' },
  { value: 'review', label: '需复看' },
];

export default function PointsIndex() {
  const { points, loading, fetchPoints, setSelectedPointId } = useAppStore();
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<PointStatus | 'all'>('all');

  useEffect(() => {
    fetchPoints();
  }, [fetchPoints]);

  const handleSearch = () => {
    fetchPoints({
      status: statusFilter === 'all' ? undefined : statusFilter,
      keyword: keyword || undefined,
    });
  };

  const handleViewDetail = (point: Point) => {
    setSelectedPointId(point.id);
  };

  const handleMerge = (point: Point) => {
    setSelectedPointId(point.id);
  };

  const handleReset = () => {
    setKeyword('');
    setStatusFilter('all');
    fetchPoints();
  };

  if (loading && points.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner text="加载中..." />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">点位列表</h1>
        <p className="text-slate-500 mt-1">管理所有点位信息，支持搜索、筛选和归并操作</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-64">
            <label className="block text-sm font-medium text-slate-700 mb-1">关键词搜索</label>
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="输入点位名称、别名或地址..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>
          <div className="w-48">
            <label className="block text-sm font-medium text-slate-700 mb-1">状态筛选</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as PointStatus | 'all')}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
            >
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSearch}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
            >
              搜索
            </button>
            <button
              onClick={handleReset}
              className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition font-medium"
            >
              重置
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  点位名称
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  别名
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  地址
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  坐标
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  状态
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  涉及时段
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {points.map((point) => (
                <tr key={point.id} className="hover:bg-slate-50 transition">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-slate-400" />
                      <span className="font-medium text-slate-900">{point.name}</span>
                      {point.isMerged && (
                        <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full font-medium">
                          已归并
                        </span>
                      )}
                      {point.isAdjacent && (
                        <span className="relative group">
                          <AlertTriangle className="w-4 h-4 text-orange-500" />
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap z-10">
                            存在相邻点位风险
                          </div>
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      创建于 {formatDateTime(point.createdAt)}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {point.aliases.length > 0 ? (
                        point.aliases.slice(0, 3).map((alias, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded"
                          >
                            {alias}
                          </span>
                        ))
                      ) : (
                        <span className="text-slate-400 text-sm">-</span>
                      )}
                      {point.aliases.length > 3 && (
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded">
                          +{point.aliases.length - 3}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600 max-w-xs truncate">
                    {point.address}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Navigation className="w-4 h-4 text-slate-400" />
                      <span className="text-sm font-mono text-slate-700">
                        {point.coordinates.lat.toFixed(6)}, {point.coordinates.lng.toFixed(6)}
                      </span>
                      {point.coordinates.offset && (
                        <span className="relative group">
                          <AlertTriangle className="w-4 h-4 text-red-500" />
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-red-600 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap z-10">
                            坐标已偏移，原坐标: {point.coordinates.originalLat?.toFixed(6)}, {point.coordinates.originalLng?.toFixed(6)}
                          </div>
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={point.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {point.timePeriods.map((period, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded"
                        >
                          {getTimePeriodText(period)}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleViewDetail(point)}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition"
                      >
                        <Eye className="w-4 h-4" />
                        查看详情
                      </button>
                      {!point.isMerged && (
                        <button
                          onClick={() => handleMerge(point)}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm text-purple-600 hover:bg-purple-50 rounded-lg transition"
                        >
                          <Merge className="w-4 h-4" />
                          归并
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {points.length === 0 && !loading && (
          <div className="py-12 text-center text-slate-500">
            <MapPin className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p>暂无点位数据</p>
          </div>
        )}
      </div>
    </div>
  );
}
