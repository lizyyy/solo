import { useState } from 'react';
import { FileSpreadsheet, Download, CheckCircle, AlertTriangle, MapPin, Eye } from 'lucide-react';
import { useAppStore } from '../store';
import { PointStatus } from '../types';
import { exportToExcel, exportToCSV } from '../utils/export';
import { cn, getStatusColor, getStatusLabel, getSourceColor, getSourceLabel } from '../lib/utils';

function truncate(str: string, max: number) {
  if (!str) return '';
  return str.length > max ? str.substring(0, max) + '...' : str;
}

export function ExportPage() {
  const { points } = useAppStore();
  const [activeFilter, setActiveFilter] = useState<PointStatus | 'all'>('all');
  const [showPreview, setShowPreview] = useState(false);

  const stats = {
    total: points.length,
    verified: points.filter((p) => p.status === 'verified').length,
    pending: points.filter((p) => p.status === 'pending').length,
    onsite: points.filter((p) => p.status === 'onsite').length,
  };

  const filteredPoints = activeFilter === 'all' ? points : points.filter((p) => p.status === activeFilter);

  const handleExportExcel = () => {
    exportToExcel(filteredPoints, `15分钟生活圈缺口图_${new Date().toLocaleDateString('zh-CN')}`);
  };

  const handleExportCSV = () => {
    exportToCSV(filteredPoints, `15分钟生活圈缺口图_${new Date().toLocaleDateString('zh-CN')}`);
  };

  const handleExportByStatus = (status: PointStatus) => {
    const statusPoints = points.filter((p) => p.status === status);
    exportToExcel(statusPoints, `${getStatusLabel(status)}_${new Date().toLocaleDateString('zh-CN')}`);
  };

  const summary = (point: typeof points[0]) => {
    const feedbacks = point.feedbacks.map(f => `[${f.source}] ${f.content}`).join('；');
    const photos = point.photos.map(p => p.description || '无说明').join('；');
    const resolutionLabel: Record<string, string> = { use_gis: '采用GIS数据', use_import: '采用导入数据', custom: '手动处理' };
    const fieldLabel: Record<string, string> = { name: '名称', address: '地址', category: '类别' };
    const conflicts = point.conflicts
      .filter(c => c.resolved)
      .map(c => `${fieldLabel[c.type]}：${resolutionLabel[c.resolution || '']} → ${c.resolvedValue || ''}`)
      .join('；');
    const history = point.history
      .map(h => `[${h.operator}] ${h.remark || (h.action === 'status_change' ? '状态变更' : h.action === 'remark' ? '备注' : h.action === 'merge' ? '归并' : h.action === 'update' ? '更新' : '导入')}`)
      .join(' | ');
    return { feedbacks, photos, conflicts, history };
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">导出公示</h1>
        <p className="text-gray-600">按状态分类导出点位清单，方便社区公示使用</p>
      </div>

      <div className="grid grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-500">总计</p>
            <FileSpreadsheet className="w-5 h-5 text-gray-400" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
          <p className="text-xs text-gray-400 mt-1">点位总数</p>
        </div>

        <div className="bg-white rounded-xl border border-green-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-green-600">已处理</p>
            <CheckCircle className="w-5 h-5 text-green-500" />
          </div>
          <p className="text-3xl font-bold text-green-700">{stats.verified}</p>
          <button
            onClick={() => handleExportByStatus('verified')}
            className="text-xs text-green-600 hover:text-green-700 mt-1 flex items-center gap-1"
          >
            <Download className="w-3 h-3" />
            单独导出
          </button>
        </div>

        <div className="bg-white rounded-xl border border-orange-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-orange-600">待核实</p>
            <AlertTriangle className="w-5 h-5 text-orange-500" />
          </div>
          <p className="text-3xl font-bold text-orange-700">{stats.pending}</p>
          <button
            onClick={() => handleExportByStatus('pending')}
            className="text-xs text-orange-600 hover:text-orange-700 mt-1 flex items-center gap-1"
          >
            <Download className="w-3 h-3" />
            单独导出
          </button>
        </div>

        <div className="bg-white rounded-xl border border-red-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-red-600">需要现场复看</p>
            <MapPin className="w-5 h-5 text-red-500" />
          </div>
          <p className="text-3xl font-bold text-red-700">{stats.onsite}</p>
          <button
            onClick={() => handleExportByStatus('onsite')}
            className="text-xs text-red-600 hover:text-red-700 mt-1 flex items-center gap-1"
          >
            <Download className="w-3 h-3" />
            单独导出
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-semibold text-gray-900">导出选项</h3>
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            <Eye className="w-4 h-4" />
            {showPreview ? '隐藏预览' : '预览数据'}
          </button>
        </div>

        <div className="flex items-center gap-4 mb-6">
          <span className="text-sm text-gray-600">筛选状态:</span>
          <div className="flex gap-2">
            {(['all', 'verified', 'pending', 'onsite'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setActiveFilter(status)}
                className={cn(
                  'px-4 py-2 text-sm rounded-lg transition-colors',
                  activeFilter === status
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                )}
              >
                {status === 'all' ? '全部' : getStatusLabel(status)}
                <span className="ml-1 opacity-70">
                  ({status === 'all' ? stats.total : status === 'verified' ? stats.verified : status === 'pending' ? stats.pending : stats.onsite})
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-4">
          <button
            onClick={handleExportExcel}
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 font-medium"
          >
            <Download className="w-5 h-5" />
            导出 Excel
          </button>
          <button
            onClick={handleExportCSV}
            className="px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2 font-medium"
          >
            <Download className="w-5 h-5" />
            导出 CSV
          </button>
        </div>
      </div>

      {showPreview && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h3 className="font-semibold text-gray-900">数据预览 ({filteredPoints.length} 条)</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left py-3 px-4 font-medium text-gray-600">点位名称</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">地址</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">类别</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">来源</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">状态</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">描述/备注</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">反馈</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">照片说明</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">冲突处理</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">历史记录</th>
                </tr>
              </thead>
              <tbody>
                {filteredPoints.slice(0, 20).map((point) => {
                  const s = summary(point);
                  return (
                    <tr key={point.id} className="border-b border-gray-100 hover:bg-gray-50 align-top">
                      <td className="py-3 px-4 text-gray-900">{point.name}</td>
                      <td className="py-3 px-4 text-gray-600">{point.address}</td>
                      <td className="py-3 px-4 text-gray-600">{point.category}</td>
                      <td className="py-3 px-4">
                        <span className={cn('px-2 py-1 text-xs rounded-full whitespace-nowrap', getSourceColor(point.source))}>
                          {getSourceLabel(point.source)}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={cn('px-2 py-1 text-xs rounded-full whitespace-nowrap', getStatusColor(point.status))}>
                          {getStatusLabel(point.status)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-600 max-w-xs">{truncate(point.description, 100)}</td>
                      <td className="py-3 px-4 text-gray-600 max-w-xs">{truncate(s.feedbacks, 100)}</td>
                      <td className="py-3 px-4 text-gray-600 max-w-xs">{truncate(s.photos, 80)}</td>
                      <td className="py-3 px-4 text-gray-600 max-w-xs">{truncate(s.conflicts, 100)}</td>
                      <td className="py-3 px-4 text-gray-600 max-w-xs">{truncate(s.history, 120)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredPoints.length > 20 && (
              <div className="px-6 py-4 text-center text-sm text-gray-500">
                还有 {filteredPoints.length - 20} 条数据未显示
              </div>
            )}
          </div>
        </div>
      )}

      <div className="mt-8 p-6 bg-blue-50 border border-blue-200 rounded-xl">
        <h3 className="font-semibold text-blue-800 mb-2">导出说明</h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• <strong>已处理</strong>：信息完整、无冲突、可直接用于公示的点位</li>
          <li>• <strong>待核实</strong>：存在数据冲突或信息不完整，需要进一步核对的点位</li>
          <li>• <strong>需要现场复看</strong>：位置或情况存疑，需要现场确认的点位</li>
          <li>• 导出文件包含：点位名称、地址、坐标、来源、类别、状态、描述、反馈记录、照片说明、冲突处理结果、历史意见等完整信息</li>
          <li>• Excel格式支持在Office中进一步编辑和排版</li>
        </ul>
      </div>
    </div>
  );
}
