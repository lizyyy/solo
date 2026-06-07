import { useEffect, useState } from 'react';
import { useAppStore } from '../store';
import StatusBadge from '../components/StatusBadge';
import { Download, CheckCircle, Info } from 'lucide-react';

export default function Export() {
  const { complaints, exportData, fetchComplaints, loading } = useAppStore();
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    fetchComplaints();
  }, []);

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
        <Info className="text-blue-500 flex-shrink-0 mt-0.5" size={20} />
        <div>
          <p className="text-blue-800 font-medium">统一数据出口</p>
          <p className="text-blue-600 text-sm mt-1">
            页面展示、接口返回、文件导出读取同一份数据源，确保数据一致性
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="font-medium text-slate-800">导出数据</h3>
            <p className="text-sm text-slate-500 mt-1">
              共 {complaints.length} 条记录将被导出，导出格式为 JSON
            </p>
          </div>
          <button
            onClick={() => exportData()}
            disabled={loading}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <Download size={18} />
            {loading ? '导出中...' : '导出全部数据'}
          </button>
        </div>

        <div>
          <button
            onClick={() => setPreview(!preview)}
            className="text-sm text-blue-600 hover:text-blue-700 mb-3"
          >
            {preview ? '隐藏预览' : '显示数据预览'}
          </button>
          
          {preview && (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">投诉编号</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">原始行号</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">状态</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">路口照片</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">意见原文</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {complaints.slice(0, 10).map(c => (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 text-sm text-slate-800">{c.complaintNo}</td>
                      <td className="px-4 py-2.5 text-sm text-slate-600">{c.originalRowNo}</td>
                      <td className="px-4 py-2.5">
                        <StatusBadge status={c.status} isDuplicate={c.isDuplicate} />
                      </td>
                      <td className="px-4 py-2.5">
                        {c.intersectionPhoto.hasPhoto ? (
                          <span className="inline-flex items-center gap-1 text-xs text-green-600">
                            <CheckCircle size={12} /> 有
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">无</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        {c.residentOpinion.hasOriginal ? (
                          <span className="inline-flex items-center gap-1 text-xs text-green-600">
                            <CheckCircle size={12} /> 有
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-red-600">
                            缺失
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {complaints.length > 10 && (
                <div className="px-4 py-3 bg-slate-50 text-xs text-slate-500 text-center border-t border-slate-200">
                  仅显示前 10 条，实际导出 {complaints.length} 条
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <h3 className="font-medium text-slate-800 mb-4">导出一致性说明</h3>
        <div className="space-y-3 text-sm text-slate-600">
          <p>1. <strong>统一数据源</strong>：所有导出、展示、API 调用均读取同一份数据文件</p>
          <p>2. <strong>导出快照</strong>：每次导出时自动保存数据快照，用于后续一致性校验</p>
          <p>3. <strong>自检对比</strong>：自检中心的「导出一致性校验」可对比当前数据与上次导出快照</p>
          <p>4. <strong>审计留痕</strong>：每次导出操作均记录操作人、时间、数量，可复盘</p>
        </div>
      </div>
    </div>
  );
}
