import React, { useEffect, useState } from 'react';
import { useAppStore } from '@/store';
import { Download, Eye, CheckCircle, AlertCircle } from 'lucide-react';
import { StatusBadge, SourceBadge } from '@/components/StatusBadge';
import type { FinalRecord } from '../../shared/types';

export const ExportPage: React.FC = () => {
  const { getExportPreview, downloadExport, loading, error } = useAppStore();
  const [previewData, setPreviewData] = useState<FinalRecord[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    loadPreview();
  }, []);

  const loadPreview = async () => {
    try {
      const data = await getExportPreview();
      setPreviewData(data);
    } catch (err) {
      // 错误已在store中处理
    }
  };

  const handleDownload = async () => {
    await downloadExport();
    setMessage('导出成功！');
    setTimeout(() => setMessage(null), 3000);
  };

  const stats = {
    total: previewData.length,
    normal: previewData.filter(r => r.status === 'normal').length,
    pending: previewData.filter(r => r.status === 'pending_review').length,
    conflict: previewData.filter(r => r.status === 'conflict').length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold text-slate-800">数据导出</h3>
          <p className="text-sm text-slate-500 mt-1">
            导出施工围挡绕行告示明细，与页面展示、接口返回使用同一份数据
          </p>
        </div>
        <button
          onClick={handleDownload}
          disabled={loading || previewData.length === 0}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Download className="w-4 h-4" />
          导出Excel
        </button>
      </div>

      {message && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <CheckCircle className="w-5 h-5" />
          {message}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-sm text-slate-500">总记录数</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{stats.total}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-sm text-slate-500">正常</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{stats.normal}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-sm text-slate-500">待复核</p>
          <p className="text-2xl font-bold text-orange-600 mt-1">{stats.pending}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-sm text-slate-500">冲突</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{stats.conflict}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-slate-500" />
            <h4 className="font-medium text-slate-700">导出预览</h4>
          </div>
          <button
            onClick={loadPreview}
            className="text-xs text-blue-600 hover:text-blue-700"
          >
            刷新预览
          </button>
        </div>
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          {previewData.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              暂无数据可导出
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">位置</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">状态</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">来源</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">居民意见</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">有原文</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">修改人</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {previewData.map((record) => (
                  <tr key={record.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{record.location}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={record.status} />
                    </td>
                    <td className="px-4 py-3">
                      <SourceBadge source={record.source} />
                    </td>
                    <td className="px-4 py-3 text-slate-600 max-w-xs truncate">
                      {record.residentOpinionSummary}
                    </td>
                    <td className="px-4 py-3">
                      {record.hasOpinionOriginal ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 text-xs">
                          <CheckCircle className="w-3 h-3" />
                          是
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-orange-600 text-xs">
                          <AlertCircle className="w-3 h-3" />
                          否
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {record.modifiedBy}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <h4 className="text-sm font-medium text-blue-700 mb-2">导出说明</h4>
        <ul className="text-sm text-blue-600 space-y-1 list-disc list-inside">
          <li>导出数据与页面展示、接口返回使用同一份数据源，确保三方一致</li>
          <li>导出内容包含：位置、数据来源、处理状态、坡道信息、采样点信息、居民意见原文/汇总、原始行号等</li>
          <li>建议先在「自检中心」完成四项自检后再导出，确保数据准确</li>
        </ul>
      </div>
    </div>
  );
};
