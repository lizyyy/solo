import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  FileUp,
  Upload,
  Merge,
  Download,
  Calendar,
  User,
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { formatDate, cn, getStatusText } from '@/utils/helpers';
import type { RewardStatus } from '@/types';
import StatCard from '@/components/StatCard';
import StatusPill from '@/components/StatusPill';
import OperationTimeline from '@/components/OperationTimeline';
import EmptyState from '@/components/EmptyState';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const COLORS = ['#10b981', '#f59e0b', '#f97316', '#ef4444'];

const getActivityStatusText = (status: string) => {
  const map: Record<string, string> = {
    active: '进行中',
    completed: '已结束',
    draft: '草稿',
    archived: '已归档',
  };
  return map[status] || status;
};

const getActivityStatusColor = (status: string) => {
  const map: Record<string, string> = {
    active: 'bg-green-500',
    completed: 'bg-slate-500',
    draft: 'bg-yellow-500',
    archived: 'bg-gray-500',
  };
  return map[status] || 'bg-gray-500';
};

export default function Dashboard() {
  const navigate = useNavigate();
  const {
    currentActivity,
    operationLogs,
    getStats,
    mergeRewardsFromSources,
    exportRewardsToCSV,
  } = useAppStore();

  const stats = getStats();

  const pieData = [
    { name: '已确认', value: stats.confirmed, status: 'confirmed' as RewardStatus },
    { name: '待补', value: stats.pending, status: 'pending' as RewardStatus },
    { name: '人工修改', value: stats.manual, status: 'manual' as RewardStatus },
    { name: '漏发', value: stats.missed, status: 'missed' as RewardStatus },
  ].filter((d) => d.value > 0);

  const quickActions = [
    {
      title: '导入掉落配置',
      description: '从CSV/Excel导入物品掉落规则',
      icon: FileUp,
      color: 'from-blue-500 to-sky-600',
      onClick: () => navigate('/drop-config'),
    },
    {
      title: '上传排行榜',
      description: '上传排行榜截图并提取数据',
      icon: Upload,
      color: 'from-amber-500 to-orange-600',
      onClick: () => navigate('/leaderboard'),
    },
    {
      title: '合并奖励记录',
      description: '从配置和排行榜生成奖励记录',
      icon: Merge,
      color: 'from-emerald-500 to-teal-600',
      onClick: () => mergeRewardsFromSources(),
    },
    {
      title: '导出报告',
      description: '导出完整的奖励发放报告',
      icon: Download,
      color: 'from-violet-500 to-purple-600',
      onClick: async () => {
        const csv = await exportRewardsToCSV();
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `rewards_report_${Date.now()}.csv`;
        link.click();
      },
    },
  ];

  const handleStatClick = (status: RewardStatus) => {
    navigate(`/rewards?status=${status}`);
  };

  const recentLogs = [...operationLogs]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10);

  if (!currentActivity) {
    return (
      <EmptyState
        title="请先选择活动"
        description="在顶部下拉菜单中选择一个活动开始管理"
      />
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      <motion.div variants={itemVariants} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <h1 className="text-2xl font-bold text-slate-800">{currentActivity.name}</h1>
              <span className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium text-white',
                getActivityStatusColor(currentActivity.status)
              )}>
                <span className="w-1.5 h-1.5 rounded-full bg-white/80" />
                {getActivityStatusText(currentActivity.status)}
              </span>
            </div>
            <div className="flex items-center gap-6 text-sm text-slate-500">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                {formatDate(currentActivity.startDate)} ~ {formatDate(currentActivity.endDate)}
              </span>
              <span className="flex items-center gap-1.5">
                <User className="w-4 h-4" />
                操作人：{currentActivity.operator}
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div onClick={() => handleStatClick('confirmed')} className="cursor-pointer">
          <StatCard
            title="已确认"
            value={stats.confirmed}
            icon={CheckCircle2}
            color="green"
          />
        </div>
        <div onClick={() => handleStatClick('pending')} className="cursor-pointer">
          <StatCard
            title="待补"
            value={stats.pending}
            icon={Clock}
            color="amber"
          />
        </div>
        <div onClick={() => handleStatClick('manual')} className="cursor-pointer">
          <StatCard
            title="人工修改"
            value={stats.manual}
            icon={AlertTriangle}
            color="red"
          />
        </div>
        <div onClick={() => handleStatClick('missed')} className="cursor-pointer">
          <StatCard
            title="漏发"
            value={stats.missed}
            icon={XCircle}
            color="purple"
          />
        </div>
      </motion.div>

      <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <motion.button
              key={action.title}
              onClick={action.onClick}
              whileHover={{ y: -4, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="relative overflow-hidden bg-white rounded-2xl border border-slate-200 p-5 text-left hover:shadow-md transition-all group"
            >
              <div className={cn('absolute -right-8 -top-8 w-24 h-24 rounded-full opacity-10 bg-gradient-to-br', action.color)} />
              <div className={cn('w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center mb-3', action.color)}>
                <Icon className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-semibold text-slate-800 mb-1">{action.title}</h3>
              <p className="text-xs text-slate-500">{action.description}</p>
            </motion.button>
          );
        })}
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div variants={itemVariants} className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">最近操作</h2>
          <OperationTimeline logs={recentLogs} />
        </motion.div>

        <motion.div variants={itemVariants} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">状态分布</h2>
          {pieData.length > 0 ? (
            <>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                          strokeWidth={0}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number, name: string) => [
                        `${value} 条`,
                        name,
                      ]}
                      contentStyle={{
                        borderRadius: '12px',
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {pieData.map((item, index) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <StatusPill status={item.status} className="scale-90" />
                    <span className="text-sm font-medium text-slate-600">{item.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <EmptyState
              title="暂无数据"
              description="还没有奖励记录，先导入配置或上传排行榜"
              className="py-8"
            />
          )}
        </motion.div>
      </div>
    </motion.div>
  );
}
