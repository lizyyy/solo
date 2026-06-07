import { useState } from 'react';
import {
  AlertTriangle,
  MapPin,
  User,
  Calendar,
  RotateCcw,
  Search,
  Filter,
  Info,
} from 'lucide-react';
import { useAppStore } from '@/store';
import { showToast } from '@/utils/errorMessageUtils';

export default function StallRotation() {
  const { stallRotations, points, streets, rollbackToVersion, currentUser } = useAppStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const getPointById = (id: string) => points.find((p) => p.id === id);
  const getStreetName = (id: string) => streets.find((s) => s.id === id)?.name || id;

  const filteredRotations = stallRotations.filter((stall) => {
    const point = getPointById(stall.pointId);
    const matchSearch =
      stall.stallNumber.includes(searchQuery) ||
      stall.vendorName.includes(searchQuery) ||
      point?.name.includes(searchQuery);
    const matchStatus = filterStatus === 'all' || stall.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const handleRollback = (stallId: string) => {
    if (confirm('确定要回滚这条摊位记录吗？')) {
      const success = rollbackToVersion(stallId, 'stallRotation', 0);
      if (success) {
        showToast('回滚成功', 'success');
      } else {
        showToast('回滚失败，无可回滚版本', 'error');
      }
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="px-2 py-1 bg-green-50 text-green-700 rounded text-xs">正常</span>;
      case 'inactive':
        return <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs">停用</span>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800 font-serif">摊位轮换管理</h2>
        <p className="text-slate-500 mt-1">管理摊位轮换记录，边界点位自动标记待复核</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="搜索摊位号、摊主、点位..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={18} className="text-slate-400" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">全部状态</option>
              <option value="active">正常</option>
              <option value="inactive">停用</option>
            </select>
          </div>
          <span className="text-sm text-slate-500">共 {filteredRotations.length} 条记录</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredRotations.map((stall) => {
          const point = getPointById(stall.pointId);
          const isBoundary = point?.isBoundary;
          const isPending = point?.boundaryStatus === 'pending';

          return (
            <div
              key={stall.id}
              className={`bg-white rounded-xl shadow-sm border transition-all duration-300 hover:shadow-md ${
                isPending
                  ? 'border-amber-300 ring-2 ring-amber-100'
                  : 'border-slate-100'
              }`}
            >
              {isPending && (
                <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 rounded-t-xl flex items-center gap-2">
                  <AlertTriangle size={16} className="text-amber-600" />
                  <span className="text-amber-700 text-sm font-medium">边界点位待复核</span>
                </div>
              )}

              <div className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-slate-800">{stall.stallNumber}</span>
                      {getStatusBadge(stall.status)}
                    </div>
                    <p className="text-sm text-slate-500 mt-1 flex items-center gap-1">
                      <User size={14} />
                      {stall.vendorName}
                    </p>
                  </div>
                  {isBoundary && (
                    <span className="px-2 py-1 bg-orange-50 text-orange-600 rounded text-xs flex items-center gap-1">
                      <MapPin size={12} />
                      边界
                    </span>
                  )}
                </div>

                {point && (
                  <div className="space-y-2 text-sm">
                    <div className="flex items-start gap-2 text-slate-600">
                      <MapPin size={14} className="mt-0.5 flex-shrink-0 text-slate-400" />
                      <div>
                        <p>{point.name}</p>
                        <p className="text-slate-400 text-xs">
                          {point.streetIds.map(getStreetName).join(' / ')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600">
                      <Calendar size={14} className="text-slate-400" />
                      <span>轮换日期：{stall.rotationDate}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600">
                      <Info size={14} className="text-slate-400" />
                      <span>关联时段：{stall.busTimeSlotIds.length} 个</span>
                    </div>
                  </div>
                )}

                <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs text-slate-400">摊位ID：{stall.id}</span>
                  {currentUser?.role !== 'staff' && (
                    <button
                      onClick={() => handleRollback(stall.id)}
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="回滚"
                    >
                      <RotateCcw size={16} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Info size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-blue-800">边界规则说明</p>
            <ul className="text-sm text-blue-700 mt-2 space-y-1">
              <li>• 点位落在两个街道边界上时，自动标记为"边界待复核"状态</li>
              <li>• 社区书记可查看但不能直接确认归属，需项目经理在复核中心判定</li>
              <li>• 已复核通过的边界点位修改后，自动重回待复核状态</li>
              <li>• 任何修改都生成新版本记录，支持单步回滚和批量回滚</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
