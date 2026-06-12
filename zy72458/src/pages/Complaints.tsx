import { useEffect, useState } from 'react';
import { useAppStore } from '../store';
import StatusBadge from '../components/StatusBadge';
import DuplicateTypeBadge from '../components/DuplicateTypeBadge';
import { Link } from 'react-router-dom';
import { Eye, Camera, FileText, Upload, X, Plus, AlertTriangle } from 'lucide-react';
import { ImportComplaintDto } from '../../shared/types';

export default function Complaints() {
  const { complaints, fetchComplaints, loading, currentUser } = useAppStore();
  const [filter, setFilter] = useState<string>('all');
  const [dupFilter, setDupFilter] = useState<string>('all');
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [importResult, setImportResult] = useState<any>(null);

  useEffect(() => {
    fetchComplaints();
  }, []);

  const filtered = complaints.filter(c => {
    if (filter !== 'all' && c.status !== filter) return false;
    if (dupFilter === 'new' && c.duplicateType !== 'none') return false;
    if (dupFilter === 'this_batch' && c.duplicateType !== 'this_batch') return false;
    if (dupFilter === 'historical' && c.duplicateType !== 'historical') return false;
    if (dupFilter === 'duplicate' && !c.isDuplicate) return false;
    return true;
  });

  const parseImport = (text: string): ImportComplaintDto[] => {
    const lines = text.trim().split('\n').filter(l => l.trim());
    return lines.map((line, idx) => {
      const parts = line.split(/[,，]/).map(s => s.trim());
      return {
        complaintNo: parts[0] || `TS-AUTO-${Date.now()}-${idx}`,
        originalRowNo: Number(parts[1]) || idx + 1,
        residentOpinionSummary: parts[2] || '（未填写汇总）',
        residentOpinionOriginal: parts[3] || undefined,
        intersectionPhotoUrl: parts[4] || undefined,
        source: '居民投诉编号第一次导入',
      };
    });
  };

  const handleImport = async () => {
    const items = parseImport(importText);
    const res = await fetch('/api/complaints/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items, operator: currentUser }),
    });
    const data = await res.json();
    setImportResult(data);
    await fetchComplaints();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">全部状态</option>
          <option value="pending_photo">待补看照片</option>
          <option value="pending_review">待复核</option>
          <option value="missing_opinion">意见只剩汇总</option>
          <option value="resolved">已结案</option>
        </select>
        <select
          value={dupFilter}
          onChange={e => setDupFilter(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">全部导入类型</option>
          <option value="new">新记录</option>
          <option value="duplicate">全部重复</option>
          <option value="this_batch">本次重复</option>
          <option value="historical">历史重复</option>
        </select>
        <span className="text-sm text-slate-500">共 {filtered.length} 条记录</span>
        <div className="flex-1" />
        <button
          onClick={() => setShowImport(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
        >
          <Upload size={16} />
          导入居民投诉编号
        </button>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">投诉编号</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">导入类型</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">原始行号</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">状态</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">路口照片</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">居民意见</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">报告说明（同源）</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map(c => (
              <tr key={c.id} className={`hover:bg-slate-50 ${c.status === 'missing_opinion' ? 'bg-red-50/40' : ''}`}>
                <td className="px-4 py-3">
                  <div className="text-sm font-medium text-slate-800">{c.complaintNo}</div>
                  <div className="text-xs text-slate-400 mt-0.5">来源：{c.source || '未标注'}</div>
                </td>
                <td className="px-4 py-3">
                  <DuplicateTypeBadge type={c.duplicateType} />
                </td>
                <td className="px-4 py-3 text-sm text-slate-600 font-mono">#{c.originalRowNo}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={c.status} isDuplicate={c.isDuplicate} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    {c.intersectionPhoto.hasPhoto ? (
                      <>
                        <Camera size={14} className="text-green-500" />
                        <span className="text-xs text-green-600">已补看</span>
                      </>
                    ) : (
                      <>
                        <Camera size={14} className="text-slate-400" />
                        <span className="text-xs text-slate-400">未补看</span>
                      </>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    {c.residentOpinion.hasOriginal ? (
                      <>
                        <FileText size={14} className="text-green-500" />
                        <span className="text-xs text-green-600">有原文</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle size={14} className="text-red-500" />
                        <span className="text-xs text-red-600 font-medium">只剩汇总</span>
                      </>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-slate-600 max-w-sm">
                  <div className="truncate" title={c.reportNote}>
                    {c.reportNote || '—'}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Link
                    to={`/complaints/${c.id}`}
                    className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 text-sm"
                  >
                    <Eye size={14} />
                    查看
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showImport && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-auto">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <Plus size={20} />
                导入居民投诉编号（第一次导入）
              </h3>
              <button
                onClick={() => { setShowImport(false); setImportResult(null); }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <p className="text-sm text-slate-600 mb-2">
                  格式（每行一条，逗号分隔）：<code className="bg-slate-100 px-1 rounded">投诉编号,原始行号,意见汇总,意见原文(可选),照片URL(可选)</code>
                </p>
                <textarea
                  value={importText}
                  onChange={e => setImportText(e.target.value)}
                  rows={8}
                  placeholder={[
                    'TS-2026-101, 101, 菜市场出入口堵塞, 我们小区门口每天都堵, /images/001.jpg',
                    'TS-2026-102, 102, 凌晨噪音扰民',
                    'TS-2026-101, 103, 菜市场出入口堵塞（重复）',
                  ].join('\n')}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>

              {importResult && (
                <div className={`p-4 rounded-lg text-sm ${importResult.success ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
                  <p className="font-medium mb-2">{importResult.message}</p>
                  {importResult.data && (
                    <div className="space-y-1 text-xs">
                      <p>新记录：<b>{importResult.data.breakdown?.newRecords?.length ?? 0}</b> 条</p>
                      <p>本次重复（同批次）：<b>{importResult.data.breakdown?.thisBatchDuplicates?.length ?? 0}</b> 条</p>
                      <p>历史重复：<b>{importResult.data.breakdown?.historicalDuplicates?.length ?? 0}</b> 条</p>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => { setShowImport(false); setImportResult(null); }}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  关闭
                </button>
                <button
                  onClick={handleImport}
                  disabled={loading || !importText.trim()}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                >
                  <Upload size={16} />
                  执行导入
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
