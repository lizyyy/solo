import { useEffect } from 'react';
import { useAppStore } from '../store';
import { FileText, Clock, AlertTriangle, CheckCircle, AlertCircle, Copy, Users, Sparkles, Layers, History } from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import DuplicateTypeBadge from '../components/DuplicateTypeBadge';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const { stats, complaints, fetchStats, fetchComplaints, currentRole } = useAppStore();

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
    { label: '新记录', value: stats.newRecords, icon: Sparkles, color: 'bg-emerald-50 text-emerald-600' },
    { label: '本次重复', value: stats.thisBatchDuplicates, icon: Layers, color: 'bg-orange-50 text-orange-600' },
    { label: '历史重复', value: stats.historicalDuplicates, icon: History, color: 'bg-violet-50 text-violet-600' },
  ] : [];

  const recentComplaints = complaints.slice(0, 5);
  const missingList = complaints.filter(c => c.status === 'missing_opinion').slice(0, 3);

  return (
    <div className="space-y-6">
      {stats && stats.missingOpinion > 0 && currentRole === 'secretary' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="text-red-500 flex-shrink-0" size={24} />
          <div>
            <p className="text-red-800 font-medium">
              有 {stats.missingOpinion} 条记录居民意见只剩汇总无原文（status === missing_opinion），不归为正常，需您复核
            </p>
            <Link to="/review" className="text-red-600 text-sm underline">
              前往复核视图
            </Link>
          </div>
        </div>
      )}

      {stats && stats.missingOpinion > 0 && currentRole !== 'secretary' && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center gap-3">
          <AlertTriangle className="text-amber-500 flex-shrink-0" size={24} />
          <div>
            <p className="text-amber-800 font-medium">
              有 {stats.missingOpinion} 条记录居民意见只剩汇总无原文，已标记 missing_opinion，留待社区书记复核
            </p>
            <p className="text-xs text-amber-600 mt-1">
              注意：未归为正常，异常不会消失。可在列表页筛选「意见只剩汇总」查看
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-4 gap-4">
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

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 bg-white rounded-lg border border-slate-200">
          <div className="px-5 py-4 border-b border-slate-200">
            <h3 className="font-medium text-slate-800">最近投诉（含三种导入类型标签）</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {recentComplaints.map(c => (
              <Link
                key={c.id}
                to={`/complaints/${c.id}`}
                className="px-5 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors gap-4"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-slate-800">{c.complaintNo}</p>
                    <DuplicateTypeBadge type={c.duplicateType} />
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    原始行号：{c.originalRowNo} · 来源：{c.source || '未标注'}
                  </p>
                  {c.reportNote && (
                    <p className="text-xs text-slate-400 mt-1 truncate max-w-xl">{c.reportNote}</p>
                  )}
                </div>
                <StatusBadge status={c.status} isDuplicate={c.isDuplicate} />
              </Link>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-red-200">
            <div className="px-5 py-4 border-b border-red-100 bg-red-50/60">
              <h3 className="font-medium text-red-800 flex items-center gap-2">
                <AlertTriangle size={16} />
                居民意见缺原文（留待复核）
              </h3>
              <p className="text-xs text-red-600 mt-1">仅 status === missing_opinion 的记录</p>
            </div>
            <div className="divide-y divide-red-50 max-h-64 overflow-auto">
              {missingList.length === 0 ? (
                <div className="p-5 text-center text-sm text-slate-400">暂无异常</div>
              ) : (
                missingList.map(c => (
                  <Link
                    key={c.id}
                    to={`/complaints/${c.id}`}
                    className="block px-5 py-3 hover:bg-red-50 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium text-slate-800">{c.complaintNo}</p>
                      <span className="text-xs text-red-600 bg-red-100 px-1.5 py-0.5 rounded">第{c.currentStep}步</span>
                    </div>
                    <p className="text-xs text-slate-500 truncate">{c.residentOpinion.summary}</p>
                  </Link>
                ))
              )}
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
                查看所有投诉 / 导入
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
                导出数据（同源）
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
