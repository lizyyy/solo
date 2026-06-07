import { useState } from 'react';
import { Search, Eye, MapPin, Bus, FileText, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { useStore } from '@/store/useStore';
import StatusBadge from '@/components/StatusBadge';
import { cn } from '@/lib/utils';

export default function Points() {
  const { points, approveReview, rejectReview } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPoint, setSelectedPoint] = useState<string | null>(null);

  const filteredPoints = points.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.location.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedPointData = points.find((p) => p.id === selectedPoint);

  const getReviewStatusBadge = (status: string) => {
    const config: Record<string, { label: string; className: string }> = {
      'not-needed': { label: '无需复核', className: 'bg-slate-100 text-slate-600' },
      pending: { label: '待复核', className: 'bg-amber-100 text-amber-700' },
      approved: { label: '已通过', className: 'bg-emerald-100 text-emerald-700' },
      rejected: { label: '已驳回', className: 'bg-red-100 text-red-700' },
    };
    const cfg = config[status] || config['not-needed'];
    return (
      <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium', cfg.className)}>
        {cfg.label}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">点位清单</h2>
          <p className="text-sm text-slate-500 mt-1">共 {filteredPoints.length} 个点位</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-100">
        <div className="p-4 border-b border-slate-100">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="搜索点位名称或位置..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  点位名称
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  位置
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  状态
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  施工改道
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  复核状态
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPoints.map((point) => (
                <tr key={point.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <MapPin size={16} className="text-primary-500" />
                      <span className="text-sm font-medium text-slate-800">{point.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">{point.location}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={point.status} />
                  </td>
                  <td className="px-4 py-3">
                    {point.hasConstructionDetour ? (
                      <span className="flex items-center gap-1 text-sm text-amber-600">
                        <AlertTriangle size={14} />
                        有
                      </span>
                    ) : (
                      <span className="text-sm text-slate-400">无</span>
                    )}
                  </td>
                  <td className="px-4 py-3">{getReviewStatusBadge(point.reviewStatus)}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setSelectedPoint(point.id)}
                      className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700"
                    >
                      <Eye size={14} />
                      查看详情
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedPointData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[80vh] overflow-auto">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-800">{selectedPointData.name}</h3>
              <button
                onClick={() => setSelectedPoint(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <XCircle size={20} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-500 mb-1">位置</p>
                  <p className="text-sm text-slate-800">{selectedPointData.location}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">状态</p>
                  <StatusBadge status={selectedPointData.status} />
                </div>
              </div>

              <div className="space-y-3">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Bus size={16} className="text-blue-600" />
                    <p className="text-sm font-medium text-blue-800">公交刷卡时段</p>
                  </div>
                  <p className="text-sm text-blue-700">
                    {selectedPointData.busCardTime || '暂无数据'}
                  </p>
                </div>

                <div className="p-4 bg-purple-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText size={16} className="text-purple-600" />
                    <p className="text-sm font-medium text-purple-800">红线图备注</p>
                  </div>
                  <p className="text-sm text-purple-700">
                    {selectedPointData.redLineNote || '暂无备注'}
                  </p>
                </div>
              </div>

              {selectedPointData.hasConstructionDetour && (
                <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle size={16} className="text-amber-600" />
                      <p className="text-sm font-medium text-amber-800">施工临时改道提示</p>
                    </div>
                    {getReviewStatusBadge(selectedPointData.reviewStatus)}
                  </div>
                  <p className="text-sm text-amber-700 mb-3">
                    {selectedPointData.mapSynced
                      ? '地图已同步改道信息'
                      : '⚠️ 施工临时改道没有同步到地图，请居民代表复核'}
                  </p>
                  {selectedPointData.reviewStatus === 'pending' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          approveReview(selectedPointData.id);
                          setSelectedPoint(null);
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500 text-white rounded text-sm hover:bg-emerald-600 transition-colors"
                      >
                        <CheckCircle size={14} />
                        通过复核
                      </button>
                      <button
                        onClick={() => {
                          rejectReview(selectedPointData.id);
                          setSelectedPoint(null);
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 bg-red-500 text-white rounded text-sm hover:bg-red-600 transition-colors"
                      >
                        <XCircle size={14} />
                        驳回
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
