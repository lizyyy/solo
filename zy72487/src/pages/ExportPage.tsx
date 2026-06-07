import { useState } from 'react';
import { Download, FileText, FileSpreadsheet, Eye, Info } from 'lucide-react';
import { api } from '@/lib/api';
import { useRecordStore } from '@/stores/useRecordStore';
import { useEffect } from 'react';

export default function ExportPage() {
  const { records, fetchAll } = useRecordStore();
  const [activeTab, setActiveTab] = useState<'detail' | 'summary'>('detail');

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleExportDetail = () => {
    api.export.downloadDetail();
  };

  const handleExportSummary = () => {
    api.export.downloadSummary();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">数据导出</h2>
        <p className="text-sm text-slate-500 mt-1">
          导出数据与页面展示、接口返回读取同一份数据源，确保三者一致
        </p>
      </div>

      <div className="card p-4">
        <div className="flex items-center gap-4 border-b border-slate-200 -mx-4 -mt-4 px-4 mb-4">
          <button
            onClick={() => setActiveTab('detail')}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'detail'
                ? 'border-municipal-600 text-municipal-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4" />
              验收明细导出
            </div>
          </button>
          <button
            onClick={() => setActiveTab('summary')}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'summary'
                ? 'border-municipal-600 text-municipal-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              街道摘要导出
            </div>
          </button>
        </div>

        {activeTab === 'detail' ? (
          <div className="space-y-4">
            <div className="p-4 bg-municipal-50 border border-municipal-100 rounded-lg flex items-start gap-3">
              <Info className="w-5 h-5 text-municipal-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-municipal-700">
                <p className="font-medium">导出说明</p>
                <p className="mt-1">
                  明细导出包含完整的验收信息，包括红线图备注、网格员巡查表原文、冲突处理记录、计算参数元数据等。
                  所有数据与页面展示、接口返回使用统一数据源。
                </p>
              </div>
            </div>

            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50">
                  <tr>
                    <th className="table-header">红线图编号</th>
                    <th className="table-header">小区名称</th>
                    <th className="table-header">状态</th>
                    <th className="table-header">备注预览</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {records.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="table-cell font-mono text-xs">{r.redLineNo}</td>
                      <td className="table-cell">{r.communityName}</td>
                      <td className="table-cell">
                        {r.status === 'completed' ? '已完成' : r.status === 'pending_summary' ? '待摘要' : '处理中'}
                      </td>
                      <td className="table-cell">
                        <span className="text-xs text-slate-500 font-mono">
                          {r.redLineRemark.substring(0, 40)}...
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={handleExportDetail}
                className="btn-primary flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                导出验收明细 Excel
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-municipal-50 border border-municipal-100 rounded-lg flex items-start gap-3">
              <Info className="w-5 h-5 text-municipal-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-municipal-700">
                <p className="font-medium">导出说明</p>
                <p className="mt-1">
                  街道摘要导出用于街道会看，包含精简的验收状态、异常标记和摘要信息。
                  新旧小区名不会自动归一化，会在导出中明确标注供街道复核。
                </p>
              </div>
            </div>

            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50">
                  <tr>
                    <th className="table-header">红线图编号</th>
                    <th className="table-header">小区名称</th>
                    <th className="table-header">验收状态</th>
                    <th className="table-header">异常标记</th>
                    <th className="table-header">街道摘要</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {records.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="table-cell font-mono text-xs">{r.redLineNo}</td>
                      <td className="table-cell">
                        {r.communityName}
                        {r.communityNameOld && (
                          <span className="text-xs text-warning-600 ml-1">
                            （原：{r.communityNameOld}）
                          </span>
                        )}
                      </td>
                      <td className="table-cell">
                        {r.status === 'completed' ? '已完成' : r.status === 'pending_summary' ? '待摘要' : '处理中'}
                      </td>
                      <td className="table-cell">
                        {(r.hasConflict && r.conflictStatus === 'pending') ||
                        (r.hasNameIssue && r.nameReviewStatus === 'pending') ? (
                          <span className="text-warning-600 text-xs">需复核</span>
                        ) : (
                          <span className="text-success-600 text-xs">正常</span>
                        )}
                      </td>
                      <td className="table-cell">
                        <span className="text-xs text-slate-500">
                          {r.streetSummary || '（待更新）'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={handleExportSummary}
                className="btn-primary flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                导出街道摘要 Excel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
