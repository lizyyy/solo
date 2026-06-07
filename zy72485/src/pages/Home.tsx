import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  MapPin,
  Clock,
  AlertTriangle,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { useAppStore } from '../store';
import { labelMap } from '../data/mockData';

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

export default function Home() {
  const navigate = useNavigate();
  const { getStats, points, reviewTasks, changeLogs } = useAppStore();
  const stats = getStats();

  const pendingTasks = reviewTasks.filter(t => t.status === 'pending');
  const recentChanges = changeLogs.slice(0, 5);
  const warningPoints = points.filter(p => p.status === 'warning' || p.status === 'exception');

  const statCards = [
    {
      label: '施工告示总数',
      value: stats.totalNotices,
      icon: FileText,
      color: 'from-blue-500 to-blue-600',
      bgColor: 'bg-blue-50',
      trend: '+2',
      trendUp: true,
    },
    {
      label: '点位总数',
      value: stats.totalPoints,
      icon: MapPin,
      color: 'from-emerald-500 to-emerald-600',
      bgColor: 'bg-emerald-50',
      trend: '+1',
      trendUp: true,
    },
    {
      label: '待复核任务',
      value: stats.pendingReview,
      icon: Clock,
      color: 'from-amber-500 to-amber-600',
      bgColor: 'bg-amber-50',
      trend: '+1',
      trendUp: true,
    },
    {
      label: '异常点位',
      value: stats.exceptionCount,
      icon: AlertTriangle,
      color: 'from-rose-500 to-rose-600',
      bgColor: 'bg-rose-50',
      trend: '-0',
      trendUp: false,
    },
  ];

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      <motion.div variants={item}>
        <h2 className="font-serif text-2xl font-semibold text-slate-800 mb-1">
          滨水驿站人流预警
        </h2>
        <p className="text-slate-500 text-sm">
          今天是 {new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
        </p>
      </motion.div>

      <motion.div variants={item} className="grid grid-cols-4 gap-4">
        {statCards.map((card, index) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={index}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              className="stat-card"
            >
              <div className="flex items-start justify-between">
                <div className={`w-12 h-12 rounded-xl ${card.bgColor} flex items-center justify-center`}>
                  <Icon className="w-6 h-6" style={{ color: card.color.includes('blue') ? '#3b82f6' : card.color.includes('emerald') ? '#10b981' : card.color.includes('amber') ? '#f59e0b' : '#ef4444' }} />
                </div>
                <div className={`flex items-center gap-1 text-xs ${card.trendUp ? 'text-emerald-600' : 'text-slate-500'}`}>
                  {card.trendUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  {card.trend}
                </div>
              </div>
              <div className="mt-4">
                <p className="text-3xl font-bold text-slate-800">{card.value}</p>
                <p className="text-sm text-slate-500 mt-1">{card.label}</p>
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      <div className="grid grid-cols-3 gap-6">
        <motion.div variants={item} className="col-span-2 card">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">待办任务</h3>
            <button
              onClick={() => navigate('/review')}
              className="text-sm text-primary hover:text-primary-600 flex items-center gap-1"
            >
              查看全部 <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {pendingTasks.length > 0 ? (
              pendingTasks.map((task) => (
                <div
                  key={task.id}
                  className="p-4 hover:bg-slate-50 transition-colors cursor-pointer"
                  onClick={() => navigate('/review')}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="tag-rose">{labelMap.reviewTaskType[task.type]}</span>
                        <span className="text-sm font-medium text-slate-700">{task.pointName}</span>
                      </div>
                      <p className="text-sm text-slate-500 line-clamp-1">{task.description}</p>
                    </div>
                    <div className="text-right ml-4">
                      <p className="text-xs text-slate-400">指派给</p>
                      <p className="text-sm text-slate-600">{task.assigneeName}</p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-slate-400">
                暂无待办任务
              </div>
            )}
          </div>
        </motion.div>

        <motion.div variants={item} className="card">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">预警点位</h3>
            <button
              onClick={() => navigate('/points')}
              className="text-sm text-primary hover:text-primary-600 flex items-center gap-1"
            >
              查看全部 <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {warningPoints.slice(0, 4).map((point) => (
              <div
                key={point.id}
                className="p-4 hover:bg-slate-50 transition-colors cursor-pointer"
                onClick={() => navigate('/points')}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={`tag-${point.status === 'warning' ? 'amber' : 'rose'}`}>
                    {labelMap.pointStatus[point.status]}
                  </span>
                  <span className="text-sm font-medium text-slate-700 truncate">{point.name}</span>
                </div>
                <p className="text-xs text-slate-500 line-clamp-1">{point.keepReason}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      <motion.div variants={item} className="card">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-semibold text-slate-800">近期变更动态</h3>
          <button
            onClick={() => navigate('/history')}
            className="text-sm text-primary hover:text-primary-600 flex items-center gap-1"
          >
            查看全部 <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="divide-y divide-slate-100">
          {recentChanges.map((log) => (
            <div key={log.id} className="p-4 flex items-start gap-4">
              <div className={`w-2 h-2 rounded-full mt-2 ${log.action === 'create' ? 'bg-emerald-500' : log.action === 'update' ? 'bg-blue-500' : 'bg-amber-500'}`} />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-slate-700">{log.operatorName}</span>
                  <span className="text-xs text-slate-400">
                    {labelMap.actionType[log.action]}{labelMap.entityType[log.entityType]}
                  </span>
                </div>
                <p className="text-sm text-slate-600">{log.reason}</p>
                {log.affectedResults.length > 0 && (
                  <p className="text-xs text-slate-400 mt-1">
                    影响：{log.affectedResults.join('、')}
                  </p>
                )}
              </div>
              <div className="text-xs text-slate-400">
                {new Date(log.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
