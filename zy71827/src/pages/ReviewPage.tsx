import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
  Legend,
} from 'recharts';
import * as XLSX from 'xlsx';
import {
  FileText,
  Download,
  Calendar,
  User,
  Gift,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  Settings,
  Trophy,
  ChevronDown,
  ChevronUp,
  DownloadCloud,
  Eye,
  Users,
  TrendingUp,
  BarChart3,
  History,
  FileSpreadsheet,
  Filter,
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import {
  formatDate,
  formatDateShort,
  cn,
  getStatusText,
  getMissSourceText,
} from '@/utils/helpers';
import type { RewardStatus, MissSource, Reward } from '@/types';
import StatCard from '@/components/StatCard';
import StatusPill from '@/components/StatusPill';
import OperationTimeline from '@/components/OperationTimeline';
import EmptyState from '@/components/EmptyState';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const CHART_COLORS = {
  confirmed: '#10b981',
  pending: '#f59e0b',
  manual: '#f97316',
  missed: '#ef4444',
};

interface ProcessingCaliber {
  id: string;
  title: string;
  icon: React.ElementType;
  content: string;
}

const processingCalibers: ProcessingCaliber[] = [
  {
    id: 'drop',
    title: '掉落配置处理口径',
    icon: Settings,
    content:
      '1. 所有掉落配置以最新版本为准，旧版本仅作追溯参考；\n2. 同一物品多次配置时，取数量最大值作为发放标准；\n3. 配置项中"通关第N关"等条件，需确认玩家实际达成记录；\n4. 配置文件导入时间晚于活动结束时间的，需人工审核后生效。',
  },
  {
    id: 'leaderboard',
    title: '排行榜数据处理口径',
    icon: Trophy,
    content:
      '1. 排行榜数据以官方截图为准，OCR识别结果需人工核对；\n2. 排名相同的玩家，按达成时间先后顺序发放奖励；\n3. 活动期间多次更新的排行榜，取最后一次快照数据；\n4. 截图中被遮挡或模糊的玩家信息，需联系游戏方核实。',
  },
  {
    id: 'deduplicate',
    title: '去重规则说明',
    icon: Filter,
    content:
      '1. 同一玩家、同一物品、同一来源视为重复记录；\n2. 重复记录中保留创建时间最早的一条；\n3. 不同来源的相同物品奖励不视为重复，可叠加发放；\n4. 去重操作会记录操作日志，保留原始数据供追溯。',
  },
  {
    id: 'status',
    title: '状态判定标准',
    icon: BarChart3,
    content:
      '1. 已确认：数据来源清晰、数量准确，已自动发放；\n2. 待补：需要人工核实截图或联系玩家确认；\n3. 人工修改：原始数据有误，已通过人工修正后发放；\n4. 漏发：确认应发但未发放，已登记漏发追踪记录。',
  },
];

function RingProgress({ value, total, size = 200 }: { value: number; total: number; size?: number }) {
  const percentage = total > 0 ? (value / total) * 100 : 0;
  const strokeWidth = 20;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#gradient)"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
        <defs>
          <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-bold text-slate-800">
          {percentage.toFixed(1)}%
        </span>
        <span className="text-sm text-slate-500 mt-1">发放完成率</span>
      </div>
    </div>
  );
}

function CollapsiblePanel({
  caliber,
  isExpanded,
  onToggle,
}: {
  caliber: ProcessingCaliber;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const Icon = caliber.icon;

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
      <button
        onClick={onToggle}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-50">
            <Icon className="w-5 h-5 text-blue-600" />
          </div>
          <span className="font-medium text-slate-800">{caliber.title}</span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-slate-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-slate-400" />
        )}
      </button>
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-4 pt-0">
              <div className="pt-4 border-t border-slate-100">
                <pre className="text-sm text-slate-600 whitespace-pre-wrap font-sans leading-relaxed">
                  {caliber.content}
                </pre>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface CategorySectionProps {
  title: string;
  count: number;
  percentage: number;
  bgColor: string;
  borderColor: string;
  textColor: string;
  icon: React.ElementType;
  extraContent?: React.ReactNode;
  onExport: () => void;
  onView: () => void;
}

function CategorySection({
  title,
  count,
  percentage,
  bgColor,
  borderColor,
  textColor,
  icon: Icon,
  extraContent,
  onExport,
  onView,
}: CategorySectionProps) {
  return (
    <motion.div
      variants={itemVariants}
      className={cn(
        'rounded-2xl border-2 p-6 bg-white',
        borderColor,
        'hover:shadow-lg transition-all'
      )}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={cn('p-3 rounded-xl', bgColor)}>
            <Icon className={cn('w-6 h-6', textColor)} />
          </div>
          <div>
            <h3 className={cn('font-bold text-lg', textColor)}>{title}</h3>
            <p className="text-sm text-slate-500">{percentage.toFixed(1)}% 占比</p>
          </div>
        </div>
        <span className={cn('text-3xl font-bold', textColor)}>
          {count.toLocaleString()}
        </span>
      </div>

      {extraContent && <div className="mb-4">{extraContent}</div>}

      <div className="flex gap-2">
        <button
          onClick={onView}
          className={cn(
            'flex-1 px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5 transition-all',
            bgColor,
            textColor,
            'hover:opacity-80'
          )}
        >
          <Eye className="w-4 h-4" />
          快捷查看
        </button>
        <button
          onClick={onExport}
          className="flex-1 px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 transition-all"
        >
          <DownloadCloud className="w-4 h-4" />
          导出
        </button>
      </div>
    </motion.div>
  );
}

export default function ReviewPage() {
  const navigate = useNavigate();
  const [expandedCaliber, setExpandedCaliber] = useState<string | null>(null);
  const {
    currentActivity,
    rewards,
    missedRewards,
    operationLogs,
    dropConfigs,
    leaderboards,
    getStats,
    exportRewardsToCSV,
  } = useAppStore();

  const stats = getStats();
  const total = stats.total || 1;

  const dailyTrendData = useMemo(() => {
    const dateMap = new Map<string, number>();
    for (const reward of rewards) {
      const date = formatDateShort(reward.createdAt);
      const count = dateMap.get(date) || 0;
      dateMap.set(date, count + 1);
    }
    return Array.from(dateMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [rewards]);

  const statusDistributionData = useMemo(() => {
    return [
      { name: '已确认', value: stats.confirmed, status: 'confirmed' as RewardStatus },
      { name: '待补', value: stats.pending, status: 'pending' as RewardStatus },
      { name: '人工修改', value: stats.manual, status: 'manual' as RewardStatus },
      { name: '漏发', value: stats.missed, status: 'missed' as RewardStatus },
    ];
  }, [stats]);

  const pendingReasons = useMemo(() => {
    const reasonMap = new Map<string, number>();
    const pendingRewards = rewards.filter((r) => r.status === 'pending');
    for (const reward of pendingRewards) {
      const source = reward.sourceType === 'drop_config' ? '掉落配置待核实' : '排行榜数据待核对';
      reasonMap.set(source, (reasonMap.get(source) || 0) + 1);
    }
    return Array.from(reasonMap.entries())
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count);
  }, [rewards]);

  const manualOperators = useMemo(() => {
    const operatorMap = new Map<string, number>();
    const manualRewards = rewards.filter((r) => r.status === 'manual');
    for (const reward of manualRewards) {
      operatorMap.set(reward.operator, (operatorMap.get(reward.operator) || 0) + 1);
    }
    return Array.from(operatorMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [rewards]);

  const keyOperationLogs = useMemo(() => {
    const keyActions: Array<'import' | 'create' | 'update'> = ['import', 'create', 'update'];
    const keyTargets: Array<'drop_config' | 'leaderboard' | 'reward'> = [
      'drop_config',
      'leaderboard',
      'reward',
    ];
    return operationLogs
      .filter(
        (log) => keyActions.includes(log.action as any) && keyTargets.includes(log.targetType as any)
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 8);
  }, [operationLogs]);

  const handleExportCategory = async (statusFilter: RewardStatus[]) => {
    const csv = await exportRewardsToCSV(statusFilter);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    const statusText = statusFilter.map(getStatusText).join('_');
    link.download = `${currentActivity?.name || '活动'}_${statusText}_${Date.now()}.csv`;
    link.click();
  };

  const handleExportFullReport = async (format: 'csv' | 'excel') => {
    const activityName = currentActivity?.name || '活动复盘报告';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const baseLink = `${window.location.origin}/rewards?source=`;

    const reportData = {
      '活动基本信息': [
        { 项目: '活动名称', 内容: currentActivity?.name || '' },
        { 项目: '活动时间', 内容: `${formatDate(currentActivity?.startDate || '')} ~ ${formatDate(currentActivity?.endDate || '')}` },
        { 项目: '活动状态', 内容: currentActivity?.status || '' },
        { 项目: '操作人', 内容: currentActivity?.operator || '' },
      ],
      '核心数据概览': [
        { 项目: '总奖励数', 数量: stats.total, 占比: '100%' },
        { 项目: '已确认', 数量: stats.confirmed, 占比: `${((stats.confirmed / total) * 100).toFixed(1)}%` },
        { 项目: '待补', 数量: stats.pending, 占比: `${((stats.pending / total) * 100).toFixed(1)}%` },
        { 项目: '人工修改', 数量: stats.manual, 占比: `${((stats.manual / total) * 100).toFixed(1)}%` },
        { 项目: '漏发', 数量: stats.missed, 占比: `${((stats.missed / total) * 100).toFixed(1)}%` },
        { 项目: '发放完成率', 数量: `${(((stats.confirmed + stats.manual) / total) * 100).toFixed(1)}%`, 占比: '' },
      ],
      '处理口径说明': processingCalibers.map((c) => ({
        口径名称: c.title,
        说明: c.content.replace(/\n/g, '; '),
      })),
      '漏发追踪摘要': missedRewards.map((m) => {
        const reward = rewards.find((r) => r.id === m.rewardId);
        return {
          漏发ID: m.id,
          玩家名称: reward?.playerName || '',
          物品名称: reward?.itemName || '',
          漏发来源: getMissSourceText(m.missSource as MissSource),
          责任人: m.responsible,
          当前进度: m.progress,
          下一步行动: m.nextStep,
          追溯链接: baseLink + (reward?.sourceId || ''),
        };
      }),
    };

    if (format === 'csv') {
      const csvLines: string[] = [];
      for (const [section, data] of Object.entries(reportData)) {
        csvLines.push(`【${section}】`);
        if (data.length > 0) {
          const headers = Object.keys(data[0] as object);
          csvLines.push(headers.join(','));
          for (const row of data) {
            const values = Object.values(row as object).map((v) =>
              typeof v === 'string' && (v.includes(',') || v.includes('\n'))
                ? `"${v.replace(/"/g, '""')}"`
                : v
            );
            csvLines.push(values.join(','));
          }
        }
        csvLines.push('');
      }

      const csvContent = '\ufeff' + csvLines.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${activityName}_完整报告_${timestamp}.csv`;
      link.click();
    } else {
      const wb = XLSX.utils.book_new();
      for (const [section, data] of Object.entries(reportData)) {
        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, section.slice(0, 30));
      }
      XLSX.writeFile(wb, `${activityName}_完整报告_${timestamp}.xlsx`);
    }
  };

  if (!currentActivity) {
    return (
      <EmptyState
        title="请先选择活动"
        description="在顶部下拉菜单中选择一个活动查看复盘报告"
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
      <motion.div
        variants={itemVariants}
        className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm"
      >
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-xl bg-blue-50">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-800">
                  {currentActivity.name} - 活动复盘
                </h1>
                <p className="text-sm text-slate-500 mt-0.5">
                  奖励发放全链路追溯分析报告
                </p>
              </div>
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
              <span className="flex items-center gap-1.5">
                <Settings className="w-4 h-4" />
                配置版本：{dropConfigs.length} 个
              </span>
              <span className="flex items-center gap-1.5">
                <Trophy className="w-4 h-4" />
                排行榜：{leaderboards.length} 个
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleExportFullReport('csv')}
              className="px-4 py-2.5 bg-green-600 text-white rounded-xl text-sm font-medium flex items-center gap-2 hover:bg-green-700 transition-all shadow-sm"
            >
              <Download className="w-4 h-4" />
              导出 CSV 报告
            </button>
            <button
              onClick={() => handleExportFullReport('excel')}
              className="px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium flex items-center gap-2 hover:bg-blue-700 transition-all shadow-sm"
            >
              <FileSpreadsheet className="w-4 h-4" />
              导出 Excel 报告
            </button>
          </div>
        </div>
      </motion.div>

      <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-6 gap-4">
        <div className="lg:col-span-5">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <StatCard
              title="总奖励数"
              value={stats.total}
              icon={Gift}
              color="blue"
            />
            <div onClick={() => navigate('/rewards?status=confirmed')} className="cursor-pointer">
              <StatCard
                title="已确认"
                value={stats.confirmed}
                icon={CheckCircle2}
                color="green"
              />
            </div>
            <div onClick={() => navigate('/rewards?status=pending')} className="cursor-pointer">
              <StatCard
                title="待补"
                value={stats.pending}
                icon={Clock}
                color="amber"
              />
            </div>
            <div onClick={() => navigate('/rewards?status=manual')} className="cursor-pointer">
              <StatCard
                title="人工修改"
                value={stats.manual}
                icon={AlertTriangle}
                color="red"
              />
            </div>
            <div onClick={() => navigate('/missed-rewards')} className="cursor-pointer">
              <StatCard
                title="漏发"
                value={stats.missed}
                icon={XCircle}
                color="purple"
              />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-center bg-white rounded-2xl border border-slate-200 p-4">
          <RingProgress value={stats.confirmed + stats.manual} total={total} />
        </div>
      </motion.div>

      <motion.div
        variants={itemVariants}
        className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm"
      >
        <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Settings className="w-5 h-5 text-blue-600" />
          处理口径说明
        </h2>
        <div className="space-y-3">
          {processingCalibers.map((caliber) => (
            <CollapsiblePanel
              key={caliber.id}
              caliber={caliber}
              isExpanded={expandedCaliber === caliber.id}
              onToggle={() =>
                setExpandedCaliber(expandedCaliber === caliber.id ? null : caliber.id)
              }
            />
          ))}
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <CategorySection
          title="已确认"
          count={stats.confirmed}
          percentage={(stats.confirmed / total) * 100}
          bgColor="bg-green-50"
          borderColor="border-green-200"
          textColor="text-green-700"
          icon={CheckCircle2}
          onExport={() => handleExportCategory(['confirmed'])}
          onView={() => navigate('/rewards?status=confirmed')}
        />
        <CategorySection
          title="待补"
          count={stats.pending}
          percentage={(stats.pending / total) * 100}
          bgColor="bg-yellow-50"
          borderColor="border-yellow-200"
          textColor="text-yellow-700"
          icon={Clock}
          extraContent={
            <div className="bg-yellow-50/50 rounded-lg p-3">
              <p className="text-xs font-medium text-yellow-800 mb-2">主要待补原因：</p>
              {pendingReasons.length > 0 ? (
                <ul className="space-y-1">
                  {pendingReasons.slice(0, 3).map((item, idx) => (
                    <li
                      key={idx}
                      className="text-xs text-yellow-700 flex items-center justify-between"
                    >
                      <span>{item.reason}</span>
                      <span className="font-semibold">{item.count} 条</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-yellow-600">暂无待补记录</p>
              )}
            </div>
          }
          onExport={() => handleExportCategory(['pending'])}
          onView={() => navigate('/rewards?status=pending')}
        />
        <CategorySection
          title="人工修改"
          count={stats.manual}
          percentage={(stats.manual / total) * 100}
          bgColor="bg-orange-50"
          borderColor="border-orange-200"
          textColor="text-orange-700"
          icon={AlertTriangle}
          extraContent={
            <div className="bg-orange-50/50 rounded-lg p-3">
              <p className="text-xs font-medium text-orange-800 mb-2">修改人统计：</p>
              {manualOperators.length > 0 ? (
                <ul className="space-y-1">
                  {manualOperators.slice(0, 3).map((item, idx) => (
                    <li
                      key={idx}
                      className="text-xs text-orange-700 flex items-center justify-between"
                    >
                      <span className="flex items-center gap-1.5">
                        <User className="w-3 h-3" />
                        {item.name}
                      </span>
                      <span className="font-semibold">{item.count} 条</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-orange-600">暂无人工修改记录</p>
              )}
            </div>
          }
          onExport={() => handleExportCategory(['manual'])}
          onView={() => navigate('/rewards?status=manual')}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          variants={itemVariants}
          className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm"
        >
          <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            每日奖励发放趋势
          </h2>
          {dailyTrendData.length > 0 ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyTrendData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
                  <YAxis stroke="#64748b" fontSize={12} />
                  <Tooltip
                    formatter={(value: number) => [`${value} 条`, '发放数量']}
                    contentStyle={{
                      borderRadius: '12px',
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#3b82f6"
                    strokeWidth={3}
                    dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState title="暂无数据" description="还没有奖励发放记录" className="py-12" />
          )}
        </motion.div>

        <motion.div
          variants={itemVariants}
          className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm"
        >
          <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-purple-600" />
            各状态分布
          </h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={statusDistributionData}
                margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} />
                <Tooltip
                  formatter={(value: number) => [`${value} 条`, '数量']}
                  contentStyle={{
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  }}
                />
                <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                  {statusDistributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[entry.status]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      <motion.div
        variants={itemVariants}
        className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm"
      >
        <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <History className="w-5 h-5 text-amber-600" />
          关键操作时间轴
        </h2>
        <OperationTimeline logs={keyOperationLogs} />
      </motion.div>
    </motion.div>
  );
}
