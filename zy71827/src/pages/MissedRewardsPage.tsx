import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';
import {
  AlertOctagon,
  Clock,
  Loader2,
  CheckCircle2,
  XCircle,
  Settings,
  Trophy,
  User,
  Search,
  Filter,
  ExternalLink,
  MessageSquare,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  UserPlus,
  Send,
  X,
  Calendar,
  History,
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import {
  cn,
  getMissSourceText,
  getMissProgressText,
  formatDate,
  getSourceTypeText,
} from '@/utils/helpers';
import type {
  MissedReward,
  MissSource,
  MissProgress,
  Reward,
  DropConfig,
  Leaderboard,
} from '@/types';
import StatCard from '@/components/StatCard';
import EmptyState from '@/components/EmptyState';
import ConfirmDialog from '@/components/ConfirmDialog';

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

const MISS_SOURCE_COLORS: Record<MissSource, string> = {
  drop_config_missing: '#3b82f6',
  leaderboard_missing: '#f59e0b',
  merge_error: '#ef4444',
  other: '#8b5cf6',
};

const MISS_PROGRESS_STEPS: MissProgress[] = ['reported', 'confirmed', 'compensated', 'closed'];

const MISS_PROGRESS_COLORS: Record<MissProgress, { bg: string; text: string; border: string }> = {
  reported: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300' },
  confirmed: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300' },
  compensated: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300' },
  closed: { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-300' },
};

interface ProgressUpdateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  missedReward: MissedReward | null;
  onConfirm: (progress: MissProgress, nextStep: string, remark: string) => void;
}

function ProgressUpdateDialog({
  isOpen,
  onClose,
  missedReward,
  onConfirm,
}: ProgressUpdateDialogProps) {
  const [newProgress, setNewProgress] = useState<MissProgress>('reported');
  const [nextStep, setNextStep] = useState('');
  const [remark, setRemark] = useState('');

  const handleConfirm = () => {
    onConfirm(newProgress, nextStep, remark);
    onClose();
  };

  if (!missedReward) return null;

  return (
    <ConfirmDialog
      open={isOpen}
      onClose={onClose}
      title="更新漏发处理进度"
      confirmText="确认更新"
      onConfirm={handleConfirm}
    >
      <div className="space-y-4">
        <div className="bg-slate-50 rounded-lg p-4">
          <p className="text-sm text-slate-600">
            当前进度：
            <span className="font-semibold ml-1">
              {getMissProgressText(missedReward.progress)}
            </span>
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            新进度
          </label>
          <div className="grid grid-cols-2 gap-2">
            {MISS_PROGRESS_STEPS.map((step) => (
              <button
                key={step}
                onClick={() => setNewProgress(step)}
                className={cn(
                  'px-4 py-3 rounded-lg text-sm font-medium border-2 transition-all',
                  newProgress === step
                    ? cn(
                        MISS_PROGRESS_COLORS[step].bg,
                        MISS_PROGRESS_COLORS[step].text,
                        MISS_PROGRESS_COLORS[step].border
                      )
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                )}
              >
                {getMissProgressText(step)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            下一步行动
          </label>
          <input
            type="text"
            value={nextStep}
            onChange={(e) => setNextStep(e.target.value)}
            placeholder="例如：已补发奖励至玩家邮箱"
            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            备注说明
          </label>
          <textarea
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            placeholder="可选：补充说明处理细节"
            rows={3}
            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-none"
          />
        </div>
      </div>
    </ConfirmDialog>
  );
}

interface ReassignDialogProps {
  isOpen: boolean;
  onClose: () => void;
  missedReward: MissedReward | null;
  operators: string[];
  onConfirm: (newResponsible: string) => void;
}

function ReassignDialog({
  isOpen,
  onClose,
  missedReward,
  operators,
  onConfirm,
}: ReassignDialogProps) {
  const [selectedOperator, setSelectedOperator] = useState('');

  const handleConfirm = () => {
    if (selectedOperator) {
      onConfirm(selectedOperator);
      onClose();
    }
  };

  if (!missedReward) return null;

  return (
    <ConfirmDialog
      open={isOpen}
      onClose={onClose}
      title="重新分配责任人"
      confirmText="确认分配"
      onConfirm={handleConfirm}
    >
      <div className="space-y-4">
        <div className="bg-slate-50 rounded-lg p-4">
          <p className="text-sm text-slate-600">
            当前责任人：
            <span className="font-semibold ml-1">{missedReward.responsible}</span>
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            选择新责任人
          </label>
          <div className="space-y-2">
            {operators.map((op) => (
              <button
                key={op}
                onClick={() => setSelectedOperator(op)}
                className={cn(
                  'w-full px-4 py-3 rounded-lg text-sm font-medium border-2 flex items-center gap-3 transition-all',
                  selectedOperator === op
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                )}
              >
                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center">
                  <User className="w-4 h-4 text-slate-500" />
                </div>
                <span>{op}</span>
                {selectedOperator === op && (
                  <CheckCircle2 className="w-4 h-4 ml-auto text-blue-500" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </ConfirmDialog>
  );
}

interface MissedRewardCardProps {
  missedReward: MissedReward;
  reward: Reward | undefined;
  dropConfig: DropConfig | undefined;
  leaderboard: Leaderboard | undefined;
  onUpdateProgress: (mr: MissedReward) => void;
  onViewSource: (mr: MissedReward) => void;
  onReassign: (mr: MissedReward) => void;
}

function MissedRewardCard({
  missedReward,
  reward,
  dropConfig,
  leaderboard,
  onUpdateProgress,
  onViewSource,
  onReassign,
}: MissedRewardCardProps) {
  const progressIndex = MISS_PROGRESS_STEPS.indexOf(missedReward.progress);
  const progressColors = MISS_PROGRESS_COLORS[missedReward.progress];
  const sourceIcon =
    missedReward.missSource === 'drop_config_missing' ||
    missedReward.missSource === 'merge_error'
      ? Settings
      : Trophy;
  const SourceIcon = sourceIcon;

  const getProgressColor = (index: number) => {
    if (index <= progressIndex) {
      return MISS_PROGRESS_COLORS[MISS_PROGRESS_STEPS[index]].bg.replace('bg-', 'bg-').replace('-100', '-500');
    }
    return 'bg-slate-200';
  };

  return (
    <motion.div
      variants={itemVariants}
      className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-all"
    >
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-rose-400 to-red-500 flex items-center justify-center flex-shrink-0">
          <span className="text-white text-lg font-bold">
            {reward?.playerName?.charAt(0) || '?'}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div>
              <h3 className="font-semibold text-slate-800">
                {reward?.playerName || '未知玩家'}
              </h3>
              <p className="text-xs text-slate-500">
                ID: {reward?.playerId || '-'}
              </p>
            </div>
            <span
              className={cn(
                'px-3 py-1 rounded-full text-xs font-medium border',
                progressColors.bg,
                progressColors.text,
                progressColors.border
              )}
            >
              {getMissProgressText(missedReward.progress)}
            </span>
          </div>

          <div className="bg-slate-50 rounded-lg p-3 mb-3">
            <div className="flex items-center gap-2 mb-1">
              <Gift className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-medium text-slate-700">
                {reward?.itemName || '未知物品'}
              </span>
              <span className="text-sm text-slate-500">
                × {reward?.quantity || 0}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-md',
                  missedReward.missSource === 'drop_config_missing' ||
                  missedReward.missSource === 'merge_error'
                    ? 'bg-blue-50 text-blue-600'
                    : 'bg-amber-50 text-amber-600'
                )}
              >
                <SourceIcon className="w-3 h-3" />
                {getMissSourceText(missedReward.missSource)}
              </span>
            </div>
          </div>

          <div className="mb-3">
            <div className="flex items-center gap-1.5 mb-2">
              {MISS_PROGRESS_STEPS.map((step, index) => (
                <div key={step} className="flex items-center">
                  <div
                    className={cn(
                      'w-3 h-3 rounded-full transition-colors',
                      getProgressColor(index)
                    )}
                  />
                  {index < MISS_PROGRESS_STEPS.length - 1 && (
                    <div
                      className={cn(
                        'w-8 h-0.5 mx-0.5 transition-colors',
                        index < progressIndex ? 'bg-green-500' : 'bg-slate-200'
                      )}
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-between text-xs text-slate-400">
              <span>上报</span>
              <span>确认</span>
              <span>补发</span>
              <span>关闭</span>
            </div>
          </div>

          {missedReward.nextStep && (
            <div className="bg-blue-50 rounded-lg p-3 mb-3">
              <div className="flex items-start gap-2">
                <Lightbulb className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-medium text-blue-700">下一步行动</p>
                  <p className="text-xs text-blue-600 mt-0.5">
                    {missedReward.nextStep}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-3 border-t border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center">
                <User className="w-3.5 h-3.5 text-slate-500" />
              </div>
              <span className="text-xs text-slate-600">
                责任人：
                <span className="font-medium">{missedReward.responsible}</span>
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => onUpdateProgress(missedReward)}
                className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-1"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                更新进度
              </button>
              <button
                onClick={() => onViewSource(missedReward)}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-1"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                查看来源
              </button>
              <button
                onClick={() => onReassign(missedReward)}
                className="px-3 py-1.5 text-xs font-medium text-purple-600 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors flex items-center gap-1"
              >
                <UserPlus className="w-3.5 h-3.5" />
                转派
              </button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

interface GuideCardProps {
  title: string;
  icon: React.ElementType;
  color: string;
  responsible: string;
  steps: string[];
}

function GuideCard({ title, icon: Icon, color, responsible, steps }: GuideCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      variants={itemVariants}
      className={cn(
        'rounded-2xl border-2 bg-white overflow-hidden',
        `border-${color}-200`
      )}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          'w-full px-5 py-4 flex items-center justify-between transition-colors',
          `bg-${color}-50`
        )}
      >
        <div className="flex items-center gap-3">
          <div className={cn('p-2 rounded-lg', `bg-${color}-100`)}>
            <Icon className={cn('w-5 h-5', `text-${color}-600`)} />
          </div>
          <div className="text-left">
            <h3 className={cn('font-semibold', `text-${color}-700`)}>{title}</h3>
            <p className="text-xs text-slate-500">责任人：{responsible}</p>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className={cn('w-5 h-5', `text-${color}-500`)} />
        ) : (
          <ChevronDown className={cn('w-5 h-5', `text-${color}-500`)} />
        )}
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-4 pt-0">
              <div className="pt-4 border-t border-slate-100">
                <p className="text-xs font-medium text-slate-600 mb-2">处理步骤：</p>
                <ol className="space-y-2">
                  {steps.map((step, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-slate-600">
                      <span
                        className={cn(
                          'w-5 h-5 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 mt-0.5',
                          `bg-${color}-100 text-${color}-600`
                        )}
                      >
                        {idx + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function Gift(props: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className}
    >
      <rect x="3" y="8" width="18" height="4" rx="1" />
      <path d="M12 8v13" />
      <path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" />
      <path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5" />
    </svg>
  );
}

export default function MissedRewardsPage() {
  const navigate = useNavigate();
  const [progressFilter, setProgressFilter] = useState<MissProgress | 'all'>('all');
  const [sourceFilter, setSourceFilter] = useState<MissSource | 'all'>('all');
  const [responsibleFilter, setResponsibleFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [progressDialogOpen, setProgressDialogOpen] = useState(false);
  const [reassignDialogOpen, setReassignDialogOpen] = useState(false);
  const [selectedMissedReward, setSelectedMissedReward] = useState<MissedReward | null>(null);

  const {
    missedRewards,
    rewards,
    dropConfigs,
    leaderboards,
    operationLogs,
    updateMissedRewardProgress,
    currentOperator,
  } = useAppStore();

  const operators = useMemo(() => {
    const ops = new Set<string>();
    ops.add(currentOperator);
    missedRewards.forEach((m) => ops.add(m.responsible));
    operationLogs.forEach((l) => ops.add(l.operator));
    return Array.from(ops);
  }, [missedRewards, operationLogs, currentOperator]);

  const missedStats = useMemo(() => {
    const stats = {
      total: missedRewards.length,
      reported: 0,
      confirmed: 0,
      compensated: 0,
      closed: 0,
    };
    for (const mr of missedRewards) {
      stats[mr.progress]++;
    }
    return stats;
  }, [missedRewards]);

  const sourceDistribution = useMemo(() => {
    const sourceMap = new Map<MissSource, number>();
    for (const mr of missedRewards) {
      sourceMap.set(mr.missSource, (sourceMap.get(mr.missSource) || 0) + 1);
    }
    return Array.from(sourceMap.entries())
      .map(([source, count]) => ({
        name: getMissSourceText(source),
        value: count,
        source,
      }))
      .sort((a, b) => b.value - a.value);
  }, [missedRewards]);

  const filteredMissedRewards = useMemo(() => {
    return missedRewards.filter((mr) => {
      if (progressFilter !== 'all' && mr.progress !== progressFilter) return false;
      if (sourceFilter !== 'all' && mr.missSource !== sourceFilter) return false;
      if (responsibleFilter !== 'all' && mr.responsible !== responsibleFilter) return false;

      if (searchQuery) {
        const reward = rewards.find((r) => r.id === mr.rewardId);
        const query = searchQuery.toLowerCase();
        return (
          reward?.playerName.toLowerCase().includes(query) ||
          reward?.playerId.toLowerCase().includes(query) ||
          reward?.itemName.toLowerCase().includes(query) ||
          mr.responsible.toLowerCase().includes(query)
        );
      }

      return true;
    });
  }, [missedRewards, rewards, progressFilter, sourceFilter, responsibleFilter, searchQuery]);

  const getRelatedReward = (rewardId: string) => rewards.find((r) => r.id === rewardId);

  const getRelatedDropConfig = (sourceId: string) =>
    dropConfigs.find((d) => d.id === sourceId);

  const getRelatedLeaderboard = (sourceId: string) =>
    leaderboards.find((l) => l.id === sourceId);

  const handleUpdateProgress = (mr: MissedReward) => {
    setSelectedMissedReward(mr);
    setProgressDialogOpen(true);
  };

  const handleReassign = (mr: MissedReward) => {
    setSelectedMissedReward(mr);
    setReassignDialogOpen(true);
  };

  const handleViewSource = (mr: MissedReward) => {
    const reward = getRelatedReward(mr.rewardId);
    if (!reward) return;

    if (mr.missSource === 'drop_config_missing') {
      const config = getRelatedDropConfig(reward.sourceId);
      if (config) {
        navigate(`/drop-config?highlight=${config.id}`);
      }
    } else if (mr.missSource === 'leaderboard_missing') {
      const board = getRelatedLeaderboard(reward.sourceId);
      if (board) {
        navigate(`/leaderboard?highlight=${board.id}`);
      }
    } else {
      navigate('/rewards');
    }
  };

  const handleConfirmProgressUpdate = async (
    progress: MissProgress,
    nextStep: string,
    remark: string
  ) => {
    if (selectedMissedReward) {
      await updateMissedRewardProgress(selectedMissedReward.id, progress, nextStep);
    }
  };

  const handleConfirmReassign = (newResponsible: string) => {
    console.log('Reassign to:', newResponsible);
  };

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
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 rounded-xl bg-red-50">
            <AlertOctagon className="w-6 h-6 text-red-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">漏发奖励追踪</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              跟踪处理所有漏发奖励，确保每一笔都有交代
            </p>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <motion.div variants={itemVariants} className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <StatCard
              title="漏发总数"
              value={missedStats.total}
              icon={AlertOctagon}
              color="red"
            />
            <StatCard
              title="待处理"
              value={missedStats.reported}
              icon={Clock}
              color="amber"
            />
            <StatCard
              title="处理中"
              value={missedStats.confirmed}
              icon={Loader2}
              color="blue"
            />
            <StatCard
              title="已补发"
              value={missedStats.compensated}
              icon={CheckCircle2}
              color="green"
            />
            <StatCard
              title="已关闭"
              value={missedStats.closed}
              icon={XCircle}
              color="purple"
            />
          </motion.div>
        </div>

        <motion.div
          variants={itemVariants}
          className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm"
        >
          <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <Filter className="w-4 h-4" />
            漏发来源分布
          </h3>
          {sourceDistribution.length > 0 ? (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sourceDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={35}
                    outerRadius={65}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {sourceDistribution.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={MISS_SOURCE_COLORS[entry.source]}
                        strokeWidth={0}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => [`${value} 条`, '数量']}
                    contentStyle={{
                      borderRadius: '12px',
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState title="暂无数据" description="还没有漏发记录" className="py-6" />
          )}
          <div className="space-y-1.5 mt-2">
            {sourceDistribution.map((item, index) => (
              <div key={item.source} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: MISS_SOURCE_COLORS[item.source] }}
                  />
                  <span className="text-slate-600">{item.name}</span>
                </div>
                <span className="font-medium text-slate-700">{item.value}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      <motion.div
        variants={itemVariants}
        className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm"
      >
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索玩家名称、ID、物品..."
              className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            />
          </div>

          <select
            value={progressFilter}
            onChange={(e) => setProgressFilter(e.target.value as MissProgress | 'all')}
            className="px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
          >
            <option value="all">全部进度</option>
            <option value="reported">待处理</option>
            <option value="confirmed">处理中</option>
            <option value="compensated">已补发</option>
            <option value="closed">已关闭</option>
          </select>

          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value as MissSource | 'all')}
            className="px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
          >
            <option value="all">全部来源</option>
            <option value="drop_config_missing">掉落配置缺失</option>
            <option value="leaderboard_missing">排行榜数据缺失</option>
            <option value="merge_error">合并错误</option>
            <option value="other">其他原因</option>
          </select>

          <select
            value={responsibleFilter}
            onChange={(e) => setResponsibleFilter(e.target.value)}
            className="px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
          >
            <option value="all">全部责任人</option>
            {operators.map((op) => (
              <option key={op} value={op}>
                {op}
              </option>
            ))}
          </select>
        </div>
      </motion.div>

      <motion.div
        variants={itemVariants}
        className="bg-gradient-to-r from-blue-50 via-purple-50 to-amber-50 rounded-2xl border border-blue-100 p-5"
      >
        <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-amber-500" />
          处理指引卡片 - 不同漏发来源找谁处理
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <GuideCard
            title="掉落配置问题"
            icon={Settings}
            color="blue"
            responsible="配置组 - 张运维"
            steps={[
              '核对掉落配置表中对应物品是否存在',
              '确认配置版本是否为最新版',
              '联系配置组补充缺失配置',
              '重新合并奖励数据验证',
            ]}
          />
          <GuideCard
            title="排行榜问题"
            icon={Trophy}
            color="amber"
            responsible="数据组 - 李运营"
            steps={[
              '查看排行榜原始截图确认玩家排名',
              '核对OCR识别数据是否准确',
              '联系数据组重新提取或修正',
              '人工补录遗漏的玩家奖励',
            ]}
          />
          <GuideCard
            title="合并错误"
            icon={RefreshCw}
            color="red"
            responsible="技术组 - 王策划"
            steps={[
              '查看合并日志定位错误原因',
              '确认是否为去重规则导致误删',
              '联系技术组修复合并逻辑',
              '手动恢复被误删的奖励记录',
            ]}
          />
        </div>
      </motion.div>

      <div className="space-y-4">
        <motion.div variants={itemVariants}>
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <History className="w-5 h-5 text-slate-600" />
            漏发记录列表
            <span className="text-sm font-normal text-slate-500">
              ({filteredMissedRewards.length} 条记录)
            </span>
          </h2>
        </motion.div>

        {filteredMissedRewards.length > 0 ? (
          <div className="space-y-4">
            {filteredMissedRewards.map((mr) => {
              const reward = getRelatedReward(mr.rewardId);
              const dropConfig = reward ? getRelatedDropConfig(reward.sourceId) : undefined;
              const leaderboard = reward ? getRelatedLeaderboard(reward.sourceId) : undefined;

              return (
                <MissedRewardCard
                  key={mr.id}
                  missedReward={mr}
                  reward={reward}
                  dropConfig={dropConfig}
                  leaderboard={leaderboard}
                  onUpdateProgress={handleUpdateProgress}
                  onViewSource={handleViewSource}
                  onReassign={handleReassign}
                />
              );
            })}
          </div>
        ) : (
          <EmptyState
            title="暂无符合条件的漏发记录"
            description="尝试调整筛选条件或搜索关键词"
            className="py-16"
          />
        )}
      </div>

      <ProgressUpdateDialog
        isOpen={progressDialogOpen}
        onClose={() => setProgressDialogOpen(false)}
        missedReward={selectedMissedReward}
        onConfirm={handleConfirmProgressUpdate}
      />

      <ReassignDialog
        isOpen={reassignDialogOpen}
        onClose={() => setReassignDialogOpen(false)}
        missedReward={selectedMissedReward}
        operators={operators}
        onConfirm={handleConfirmReassign}
      />
    </motion.div>
  );
}
