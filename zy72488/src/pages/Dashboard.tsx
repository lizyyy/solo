import { Link } from 'react-router-dom';
import {
  MapPin,
  AlertTriangle,
  Clock,
  UserCheck,
  ChevronRight,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import { useStore } from '@/store/useStore';

export default function Dashboard() {
  const { points, conflicts, history, workflows } = useStore();

  const totalPoints = points.length;
  const pendingConflicts = conflicts.filter((c) => c.status === 'pending').length;
  const pendingReviews = points.filter((p) => p.reviewStatus === 'pending').length;
  const inProgressWorkflows = workflows.filter((w) => w.status === 'in-progress').length;

  const stats = [
    {
      label: '点位总数',
      value: totalPoints,
      icon: MapPin,
      color: 'bg-blue-500',
    },
    {
      label: '待处理冲突',
      value: pendingConflicts,
      icon: AlertTriangle,
      color: 'bg-red-500',
    },
    {
      label: '待复核改道',
      value: pendingReviews,
      icon: UserCheck,
      color: 'bg-amber-500',
    },
    {
      label: '进行中流程',
      value: inProgressWorkflows,
      icon: Clock,
      color: 'bg-emerald-500',
    },
  ];

  const recentHistory = history.slice(0, 5);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-800">工作台</h2>
        <p className="text-sm text-slate-500 mt-1">欢迎回来，老马</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white rounded-lg shadow-sm p-5 border border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">{stat.label}</p>
                <p className="text-2xl font-bold text-slate-800 mt-1">{stat.value}</p>
              </div>
              <div className={stat.color + ' w-12 h-12 rounded-lg flex items-center justify-center text-white'}>
                <stat.icon size={24} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 bg-white rounded-lg shadow-sm border border-slate-100">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">最近操作记录</h3>
            <Link to="/history" className="text-sm text-primary-600 hover:text-primary-700 flex items-center">
              查看全部 <ChevronRight size={16} />
            </Link>
          </div>
          <div className="divide-y divide-slate-100">
            {recentHistory.map((record) => (
              <div key={record.id} className="p-4 flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Clock size={14} className="text-primary-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-800">
                    <span className="font-medium">{record.operator}</span>
                    <span className="text-slate-500 mx-1">·</span>
                    <span>{record.remark}</span>
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {record.pointName} · {new Date(record.createdAt).toLocaleString('zh-CN')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-100">
          <div className="p-4 border-b border-slate-100">
            <h3 className="font-semibold text-slate-800">待办事项</h3>
          </div>
          <div className="p-4 space-y-3">
            {pendingConflicts > 0 && (
              <Link
                to="/conflicts"
                className="flex items-center gap-3 p-3 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
              >
                <AlertCircle size={20} className="text-red-500 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-800">{pendingConflicts} 个冲突待处理</p>
                  <p className="text-xs text-red-600">公交时段与红线图备注有矛盾</p>
                </div>
              </Link>
            )}
            {pendingReviews > 0 && (
              <Link
                to="/points"
                className="flex items-center gap-3 p-3 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors"
              >
                <UserCheck size={20} className="text-amber-500 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-800">{pendingReviews} 个改道待复核</p>
                  <p className="text-xs text-amber-600">施工临时改道未同步地图</p>
                </div>
              </Link>
            )}
            {inProgressWorkflows > 0 && (
              <Link
                to="/workflow"
                className="flex items-center gap-3 p-3 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors"
              >
                <Clock size={20} className="text-emerald-500 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-emerald-800">{inProgressWorkflows} 个流程进行中</p>
                  <p className="text-xs text-emerald-600">继续完成三步流程</p>
                </div>
              </Link>
            )}
            {pendingConflicts === 0 && pendingReviews === 0 && inProgressWorkflows === 0 && (
              <div className="text-center py-8">
                <CheckCircle size={48} className="text-emerald-400 mx-auto mb-3" />
                <p className="text-sm text-slate-500">暂无待办事项</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
