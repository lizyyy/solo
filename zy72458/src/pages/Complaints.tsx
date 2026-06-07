import { useEffect, useState } from 'react';
import { useAppStore } from '../store';
import StatusBadge from '../components/StatusBadge';
import { Link } from 'react-router-dom';
import { Eye, Camera, FileText } from 'lucide-react';

export default function Complaints() {
  const { complaints, fetchComplaints, loading } = useAppStore();
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    fetchComplaints();
  }, []);

  const filtered = complaints.filter(c => {
    if (filter === 'all') return true;
    if (filter === 'duplicate') return c.isDuplicate;
    return c.status === filter;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
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
          <option value="duplicate">重复导入</option>
        </select>
        <span className="text-sm text-slate-500">共 {filtered.length} 条记录</span>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">投诉编号</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">原始行号</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">状态</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">路口照片</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">居民意见</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">导入时间</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map(c => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <div className="text-sm font-medium text-slate-800">{c.complaintNo}</div>
                  {c.isDuplicate && (
                    <div className="text-xs text-orange-600 mt-0.5">重复导入</div>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-slate-600">{c.originalRowNo}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={c.status} />
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
                        <FileText size={14} className="text-red-500" />
                        <span className="text-xs text-red-600">只剩汇总</span>
                      </>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-slate-500">
                  {new Date(c.importTime).toLocaleDateString('zh-CN')}
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
    </div>
  );
}
