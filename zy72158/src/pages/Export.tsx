import { useState } from 'react';
import { FileText, Download, FileSpreadsheet, FileJson, Printer, Eye } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { exportToCSV, exportPublicNotice, downloadFile, exportToJSON } from '@/services/exportService';
import StatusBadge from '@/components/StatusBadge';
import { formatDate } from '@/utils/timeUtils';

export default function Export() {
  const stalls = useStore(state => state.stalls);
  const [previewContent, setPreviewContent] = useState<string>('');
  const [showPreview, setShowPreview] = useState(false);
  const [previewType, setPreviewType] = useState<'notice' | 'csv' | 'json'>('notice');

  const handleExportCSV = () => {
    const content = exportToCSV(stalls);
    downloadFile(content, `商业街外摆审批清单_${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8');
  };

  const handleExportNotice = () => {
    const content = exportPublicNotice(stalls);
    downloadFile(content, `商业街外摆审批公示_${new Date().toISOString().slice(0, 10)}.txt`, 'text/plain;charset=utf-8');
  };

  const handleExportJSON = () => {
    const content = exportToJSON(stalls);
    downloadFile(content, `商业街外摆审批数据_${new Date().toISOString().slice(0, 10)}.json`, 'application/json');
  };

  const handlePreview = (type: 'notice' | 'csv' | 'json') => {
    setPreviewType(type);
    if (type === 'notice') {
      setPreviewContent(exportPublicNotice(stalls));
    } else if (type === 'csv') {
      setPreviewContent(exportToCSV(stalls));
    } else {
      setPreviewContent(exportToJSON(stalls));
    }
    setShowPreview(true);
  };

  const stats = {
    total: stalls.length,
    approved: stalls.filter(s => s.status === 'approved' || s.status === 'legacy').length,
    pending: stalls.filter(s => s.status === 'pending' || s.status === 'need_confirm').length,
    rejected: stalls.filter(s => s.status === 'rejected').length,
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
          <p className="text-sm font-medium text-gray-500">总记录数</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{stats.total}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
          <p className="text-sm font-medium text-gray-500">已通过</p>
          <p className="text-3xl font-bold text-green-600 mt-1">{stats.approved}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
          <p className="text-sm font-medium text-gray-500">待处理</p>
          <p className="text-3xl font-bold text-yellow-600 mt-1">{stats.pending}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
          <p className="text-sm font-medium text-gray-500">已驳回</p>
          <p className="text-3xl font-bold text-red-600 mt-1">{stats.rejected}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">公示清单</h3>
              <p className="text-sm text-gray-500">TXT 格式，可打印</p>
            </div>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            导出完整的审批公示清单，包含审批记录和数据来源追溯信息，便于交接和存档。
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => handlePreview('notice')}
              className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
            >
              <Eye className="w-4 h-4" />
              预览
            </button>
            <button
              onClick={handleExportNotice}
              className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              导出
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <FileSpreadsheet className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">表格数据</h3>
              <p className="text-sm text-gray-500">CSV 格式，Excel 兼容</p>
            </div>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            导出结构化的审批数据表格，可用于进一步统计分析或导入其他系统。
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => handlePreview('csv')}
              className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
            >
              <Eye className="w-4 h-4" />
              预览
            </button>
            <button
              onClick={handleExportCSV}
              className="flex-1 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              导出
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-purple-100 rounded-lg">
              <FileJson className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">原始数据</h3>
              <p className="text-sm text-gray-500">JSON 格式，完整备份</p>
            </div>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            导出完整的原始数据，包含所有审批记录和来源信息，用于系统间数据迁移。
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => handlePreview('json')}
              className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
            >
              <Eye className="w-4 h-4" />
              预览
            </button>
            <button
              onClick={handleExportJSON}
              className="flex-1 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              导出
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">审批清单预览</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">序号</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">商户名称</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">位置</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">面积</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">时间段</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">状态</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">来源数</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">更新时间</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {stalls.map((stall, index) => (
                <tr key={stall.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-600">{index + 1}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{stall.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{stall.location}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{stall.area}㎡</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{stall.timePeriod}</td>
                  <td className="px-4 py-3"><StatusBadge status={stall.status} /></td>
                  <td className="px-4 py-3 text-sm text-gray-600">{stall.sources.length}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{formatDate(stall.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">
                {previewType === 'notice' ? '公示清单预览' : 
                 previewType === 'csv' ? 'CSV 数据预览' : 'JSON 数据预览'}
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <Printer className="w-5 h-5 text-gray-600" />
                </button>
                <button
                  onClick={() => setShowPreview(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  ×
                </button>
              </div>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-100px)]">
              <pre className="whitespace-pre-wrap text-sm text-gray-700 font-mono bg-gray-50 p-4 rounded-lg">
                {previewContent}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
