import { useEffect } from 'react';
import { useAppStore } from '../store';
import { FileText, Clock, AlertTriangle, CheckCircle, AlertCircle, Copy, Users } from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const { stats, complaints, fetchStats, fetchComplaints } = useAppStore();

  useEffect(() => {
    fetchStats();
    fetchComplaints();
  }, []);

  const statCards = stats ? [
    { label: '投诉总数', value: stats.total, icon: FileText, color: 'bg-blue-50 text-blue-600' },
    { label: '待补看照片', value: stats.pendingPhoto, icon: Clock, color: 'bg-amber-50 text-amber-600' },
    { label: '待复核', value: stats.pendingReview, icon: Users, color: 'bg-blue-50 text-blue-600' },
    { label: '意见只剩汇总', value: stats.missingOpinion, icon: AlertTriangle, color: 'bg-red-50 text-red-600' },
    { label: '已结案', value: stats.resolved, icon: CheckCircle, color: 'bg-green-50 text-green-600' },
    { label: '重复导入', value: stats.duplicates, icon: Copy, color: 'bg-orange-50 text-orange-600' },
  ] : [];

  const recentComplaints = complaints.slice(0, 5);

  return (
    <div className="space-y-6">
      {stats && stats.missingOpinion > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="text-red-500 flex-shrink-0" size={24} />
          <div>
            <p className="text-red-800 font-medium">
              有 {stats.missingOpinion} 条记录居民意见只剩汇总无原文，需社区书记复核
            </p>
            <Link to="/review" className="text-red-600 text-sm underline">
              前往复核视图
            </Link>
          </div>
        </div>
      )}

      <div className="grid grid-cols-6 gap-4">
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div key={idx} className="bg-white rounded-lg border border-slate-200 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">{card.label}</p>
                  <p className="text-2xl font-bold text-slate-800 mt-1">{card.value}</p>
                </div>
                <div className={`p-3 rounded-lg ${card.color}`}>
                  <Icon size={20} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-slate-200">
          <div className="px-5 py-4 border-b border-slate-200">
            <h3 className="font-medium text-slate-800">最近投诉</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {recentComplaints.map(c => (
              <Link
                key={c.id}
                to={`/complaints/${c.id}`}
                className="px-5 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-slate-800">{c.complaintNo}</p>
                  <p className="text-xs text-slate-500 mt-0.5">原始行号：{c.originalRowNo}</p>
                </div>
                <StatusBadge status={c.status} isDuplicate={c.isDuplicate} />
              </Link>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200">
          <div className="px-5 py-4 border-b border-slate-200">
            <h3 className="font-medium text-slate-800">快速操作</h3>
          </div>
          <div className="p-5 space-y-3">
            <Link
              to="/complaints"
              className="block w-full py-3 px-4 bg-blue-600 text-white text-center rounded-lg hover:bg-blue-700 transition-colors"
            >
              查看所有投诉
            </Link>
            <Link
              to="/self-check"
              className="block w-full py-3 px-4 bg-slate-100 text-slate-700 text-center rounded-lg hover:bg-slate-200 transition-colors"
            >
              运行自检
            </Link>
            <Link
              to="/export"
              className="block w-full py-3 px-4 bg-slate-100 text-slate-700 text-center rounded-lg hover:bg-slate-200 transition-colors"
            >
              导出数据
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
