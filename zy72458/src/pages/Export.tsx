import { useEffect, useState } from 'react';
import { useAppStore } from '../store';
import StatusBadge from '../components/StatusBadge';
import DuplicateTypeBadge from '../components/DuplicateTypeBadge';
import { Download, CheckCircle, Info, FileText, Camera, ThumbsUp } from 'lucide-react';

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
          <p className="text-blue-800 font-medium">统一数据出口说明</p>
          <p className="text-blue-600 text-sm mt-1">
            页面展示、接口返回（/api/complaints、/api/export/unified）、文件导出均读取同一份 <code>complaints.json</code>，
            包含：来源、处理状态、复核结论、报告说明。异常记录（missing_opinion）不会因任何操作自动消失，必须社区书记复核确认。
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="font-medium text-slate-800">导出数据</h3>
            <p className="text-sm text-slate-500 mt-1">
              共 <b>{complaints.length}</b> 条记录，其中：
              <span className="ml-2 text-red-600">missing_opinion {complaints.filter(c => c.status === 'missing_opinion').length} 条</span>
              <span className="ml-2 text-emerald-600">新记录 {complaints.filter(c => c.duplicateType === 'none').length} 条</span>
              <span className="ml-2 text-orange-600">本次重复 {complaints.filter(c => c.duplicateType === 'this_batch').length} 条</span>
              <span className="ml-2 text-violet-600">历史重复 {complaints.filter(c => c.duplicateType === 'historical').length} 条</span>
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
            {preview ? '隐藏预览' : '显示完整数据预览（含来源/报告说明/结论）'}
          </button>
          
          {preview && (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-3 py-2.5 text-xs font-medium text-slate-500 uppercase">投诉编号</th>
                    <th className="text-left px-3 py-2.5 text-xs font-medium text-slate-500 uppercase">导入类型</th>
                    <th className="text-left px-3 py-2.5 text-xs font-medium text-slate-500 uppercase">行号</th>
                    <th className="text-left px-3 py-2.5 text-xs font-medium text-slate-500 uppercase">来源</th>
                    <th className="text-left px-3 py-2.5 text-xs font-medium text-slate-500 uppercase">状态</th>
                    <th className="text-left px-3 py-2.5 text-xs font-medium text-slate-500 uppercase">
                      <div className="flex items-center gap-1"><Camera size={12}/>照片</div>
                    </th>
                    <th className="text-left px-3 py-2.5 text-xs font-medium text-slate-500 uppercase">
                      <div className="flex items-center gap-1"><FileText size={12}/>意见原文</div>
                    </th>
                    <th className="text-left px-3 py-2.5 text-xs font-medium text-slate-500 uppercase">
                      <div className="flex items-center gap-1"><ThumbsUp size={12}/>复核结论</div>
                    </th>
                    <th className="text-left px-3 py-2.5 text-xs font-medium text-slate-500 uppercase">报告说明（同源字段）</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {complaints.map(c => (
                    <tr key={c.id} className={`hover:bg-slate-50 ${c.status === 'missing_opinion' ? 'bg-red-50/40' : ''}`}>
                      <td className="px-3 py-2 text-sm text-slate-800 font-mono">{c.complaintNo}</td>
                      <td className="px-3 py-2">
                        <DuplicateTypeBadge type={c.duplicateType} />
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-600 font-mono">#{c.originalRowNo}</td>
                      <td className="px-3 py-2 text-xs text-slate-600">{c.source || '—'}</td>
                      <td className="px-3 py-2">
                        <StatusBadge status={c.status} />
                      </td>
                      <td className="px-3 py-2">
                        {c.intersectionPhoto.hasPhoto ? (
                          <CheckCircle size={14} className="text-green-500" />
                        ) : (
                          <span className="text-xs text-slate-400">无</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {c.residentOpinion.hasOriginal ? (
                          <CheckCircle size={14} className="text-green-500" />
                        ) : (
                          <span className="text-xs text-red-600 font-medium">缺失</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {c.reviewConclusion === 'approved' ? (
                          <span className="text-green-600 bg-green-50 px-1.5 py-0.5 rounded">复核通过</span>
                        ) : c.reviewConclusion === 'pending' ? (
                          <span className="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">记录待跟进</span>
                        ) : (
                          <span className="text-slate-400">未复核</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-600 max-w-md">
                        <div className="truncate" title={c.reportNote}>
                          {c.reportNote || '—'}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <h3 className="font-medium text-slate-800 mb-4">导出一致性说明</h3>
        <div className="space-y-3 text-sm text-slate-600">
          <p>1. <strong>统一数据源</strong>：所有导出、展示、API 调用均通过 <code>complaintService.getForExport()</code> 读取同一份 <code>data/complaints.json</code></p>
          <p>2. <strong>导出快照</strong>：每次导出时自动保存快照至 <code>data/export-snapshot.json</code>，用于后续一致性校验</p>
          <p>3. <strong>自检对比</strong>：自检中心的「导出一致性校验」会对比当前数据与上次导出快照差异</p>
          <p>4. <strong>异常不消失</strong>：<code>status === 'missing_opinion'</code> 的记录不会自动消失，只有补录原文或社区书记复核后才流转</p>
          <p>5. <strong>同名字段同源</strong>：<code>source</code>（来源）、<code>reportNote</code>（报告说明）、<code>reviewConclusion</code>（复核结论）在页面、接口、导出 JSON 中是同字段</p>
          <p>6. <strong>审计留痕</strong>：每次导出操作均记录操作人、时间、数量，记录在 <code>operation-records.json</code> 中，可复盘</p>
        </div>
      </div>
    </div>
  );
}
