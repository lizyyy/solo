import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Upload, MapPin, Clock, AlertTriangle, CheckCircle, Filter, Edit2, Trash2, ChevronDown } from 'lucide-react';
import { useAppStore } from '../store';
import StatsCard from '../components/StatsCard';
import StatusBadge from '../components/StatusBadge';
import ImportModal from '../components/ImportModal';
import type { ImportPointData } from '../utils/importExport';
import type { PointStatus, PointSource } from '../types';

const PointList = () => {
  const navigate = useNavigate();
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  
  const {
    points,
    filters,
    setFilters,
    getFilteredPoints,
    importPoints,
    addPoint,
    deletePoint,
    updatePoint,
    getConflictsByPointId,
  } = useAppStore();

  const filteredPoints = getFilteredPoints();
  
  const stats = {
    total: points.length,
    pending: points.filter((p) => p.status === 'pending').length,
    conflict: points.filter((p) => p.status === 'conflict').length,
    completed: points.filter((p) => p.status === 'completed').length,
  };

  const handleImport = (data: ImportPointData[]) => {
    importPoints(data);
  };

  const handleAddDemo = () => {
    addPoint({
      name: '人民医院东门北侧停车场入口',
      location: '人民路123号',
      hospital: '市第一人民医院',
      source: 'street',
      sourceDesc: '街道2024年巡检表第15行',
      rawNote: '现场标识牌歪斜，有乱停现象，建议增设临时泊位约20个，旁边有空地！！注意：业主说可能有管线',
      status: 'pending',
      createdBy: '老曹',
    });
  };

  const handleQuickStatusChange = (id: string, status: PointStatus) => {
    updatePoint(id, { status });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">点位总览</h1>
          <p className="text-slate-500 mt-1">管理医院周边停车诱导点位数据</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setImportModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <Upload className="w-4 h-4" />
            导入点位
          </button>
          <button
            onClick={handleAddDemo}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
            示例点位
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatsCard title="点位总数" value={stats.total} icon={MapPin} color="blue" />
        <StatsCard title="待处理" value={stats.pending} icon={Clock} color="amber" />
        <StatsCard title="有冲突" value={stats.conflict} icon={AlertTriangle} color="red" onClick={() => setFilters({ status: 'conflict' })} />
        <StatsCard title="已完成" value={stats.completed} icon={CheckCircle} color="emerald" />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="搜索点位名称、位置、备注..."
                value={filters.search}
                onChange={(e) => setFilters({ search: e.target.value })}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <Filter className="w-4 h-4" />
              筛选
              <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-100">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">状态</label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters({ status: e.target.value as PointStatus | 'all' })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="all">全部状态</option>
                  <option value="pending">待处理</option>
                  <option value="processing">处理中</option>
                  <option value="conflict">有冲突</option>
                  <option value="completed">已完成</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">来源</label>
                <select
                  value={filters.source}
                  onChange={(e) => setFilters({ source: e.target.value as PointSource | 'all' })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="all">全部来源</option>
                  <option value="street">街道表格</option>
                  <option value="onsite">现场巡检</option>
                  <option value="approval">审批记录</option>
                  <option value="other">其他来源</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">所属医院</label>
                <input
                  type="text"
                  placeholder="输入医院名称"
                  value={filters.hospital}
                  onChange={(e) => setFilters({ hospital: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">点位名称</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">所属医院</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">位置</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">来源</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">状态</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">原始备注</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">更新时间</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-slate-600">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPoints.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                    暂无点位数据，点击上方"导入点位"或"示例点位"开始
                  </td>
                </tr>
              ) : (
                filteredPoints.map((point) => {
                  const conflicts = getConflictsByPointId(point.id);
                  return (
                    <tr key={point.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <button
                          onClick={() => navigate(`/point/${point.id}`)}
                          className="text-slate-800 font-medium hover:text-amber-600 transition-colors text-left"
                        >
                          {point.name}
                        </button>
                        {conflicts.filter((c) => !c.resolved).length > 0 && (
                          <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700">
                            {conflicts.filter((c) => !c.resolved).length} 个冲突
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-sm">{point.hospital}</td>
                      <td className="px-4 py-3 text-slate-600 text-sm">{point.location}</td>
                      <td className="px-4 py-3">
                        <StatusBadge type="source" value={point.source} />
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={point.status}
                          onChange={(e) => handleQuickStatusChange(point.id, e.target.value as PointStatus)}
                          className="text-sm border-0 bg-transparent focus:outline-none cursor-pointer"
                        >
                          <option value="pending">待处理</option>
                          <option value="processing">处理中</option>
                          <option value="conflict">有冲突</option>
                          <option value="completed">已完成</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        <div className="text-sm text-slate-600 truncate" title={point.rawNote}>
                          {point.rawNote || '-'}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-sm">
                        {new Date(point.updatedAt).toLocaleDateString('zh-CN')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => navigate(`/point/${point.id}`)}
                            className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                            title="查看详情"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm('确定要删除这个点位吗？相关照片、方案和冲突记录也会被删除。')) {
                                deletePoint(point.id);
                              }
                            }}
                            className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="删除"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 text-sm text-slate-500">
          共 {filteredPoints.length} 条记录
          {filters.search || filters.status !== 'all' || filters.hospital || filters.source !== 'all'
            ? '（已筛选）'
            : ''}
        </div>
      </div>

      <ImportModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onImport={handleImport}
      />
    </div>
  );
};

export default PointList;
