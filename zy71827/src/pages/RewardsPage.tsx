import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Filter,
  Download,
  Tag,
  History,
  Eye,
  ChevronLeft,
  ChevronRight,
  X,
  Check,
  Merge,
  AlertCircle,
  Gift,
  Settings,
  Trophy,
  UserPlus,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { formatDate, cn, getSourceTypeText, generateRewardKey } from '@/utils/helpers';
import type { Reward, RewardStatus, SourceType, OperationLog } from '@/types';
import EmptyState from '@/components/EmptyState';
import StatusPill from '@/components/StatusPill';
import SourceBadge from '@/components/SourceBadge';
import OperationTimeline from '@/components/OperationTimeline';
import ConfirmDialog from '@/components/ConfirmDialog';
import StatCard from '@/components/StatCard';

interface StatusDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (status: RewardStatus, remark: string) => void;
  selectedCount: number;
}

function StatusDialog({ open, onClose, onConfirm, selectedCount }: StatusDialogProps) {
  const [status, setStatus] = useState<RewardStatus>('confirmed');
  const [remark, setRemark] = useState('');

  const statusOptions: { value: RewardStatus; label: string; color: string }[] = [
    { value: 'confirmed', label: '已确认', color: 'bg-green-500' },
    { value: 'pending', label: '待补', color: 'bg-yellow-500' },
    { value: 'manual', label: '人工修改', color: 'bg-orange-500' },
    { value: 'missed', label: '漏发', color: 'bg-red-500' },
  ];

  const handleSubmit = () => {
    if (!remark.trim()) return;
    onConfirm(status, remark.trim());
    setRemark('');
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed top-1/2 left-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2"
          >
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-slate-800">
                    标记状态 ({selectedCount} 条)
                  </h3>
                  <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg">
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">选择状态</label>
                    <div className="grid grid-cols-2 gap-2">
                      {statusOptions.map((option) => (
                        <button
                          key={option.value}
                          onClick={() => setStatus(option.value)}
                          className={cn(
                            'flex items-center gap-2 px-4 py-3 rounded-lg border transition-all',
                            status === option.value
                              ? 'border-sky-500 bg-sky-50'
                              : 'border-slate-200 hover:border-slate-300'
                          )}
                        >
                          <span className={cn('w-3 h-3 rounded-full', option.color)} />
                          <span className="text-sm font-medium">{option.label}</span>
                          {status === option.value && <Check className="w-4 h-4 text-sky-500 ml-auto" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">备注 *</label>
                    <textarea
                      value={remark}
                      onChange={(e) => setRemark(e.target.value)}
                      placeholder="请填写变更原因..."
                      rows={3}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent resize-none"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 p-4 bg-slate-50 border-t border-slate-100">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!remark.trim()}
                  className={cn(
                    'flex-1 px-4 py-2.5 text-sm font-medium text-white rounded-lg transition-all shadow-md',
                    remark.trim()
                      ? 'bg-gradient-to-r from-sky-500 to-cyan-500 hover:shadow-lg hover:shadow-sky-500/20'
                      : 'bg-slate-300 cursor-not-allowed'
                  )}
                >
                  确认变更
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

interface TracePanelProps {
  reward: Reward | null;
  onClose: () => void;
}

function TracePanel({ reward, onClose }: TracePanelProps) {
  const { dropConfigs, leaderboards, operationLogs } = useAppStore();

  const sourceConfig = useMemo(() => {
    if (!reward) return null;
    if (reward.sourceType === 'drop_config') {
      return dropConfigs.find((d) => d.id === reward.sourceId);
    }
    if (reward.sourceType === 'leaderboard') {
      return leaderboards.find((l) => l.id === reward.sourceId);
    }
    return null;
  }, [reward, dropConfigs, leaderboards]);

  const relatedLogs = useMemo(() => {
    if (!reward) return [];
    return operationLogs
      .filter((log) => log.targetType === 'reward' && log.targetId === reward.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [reward, operationLogs]);

  if (!reward) return null;

  return (
    <AnimatePresence>
      {reward && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed top-0 right-0 z-50 w-full max-w-xl h-full bg-white border-l border-slate-200 shadow-2xl flex flex-col"
          >
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-cyan-500 flex items-center justify-center">
                  <History className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800">来源追溯</h3>
                  <p className="text-xs text-slate-500">奖励记录完整链路</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="bg-slate-50 rounded-xl p-4">
                <h4 className="text-sm font-semibold text-slate-700 mb-3">奖励信息</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-500 mb-1">玩家</p>
                    <p className="font-medium text-slate-800">{reward.playerName}</p>
                    <p className="text-xs text-slate-500">{reward.playerId}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">物品</p>
                    <p className="font-medium text-slate-800">{reward.itemName}</p>
                    <p className="text-xs text-slate-500">x{reward.quantity}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <StatusPill status={reward.status} />
                  <SourceBadge sourceType={reward.sourceType} sourceId={reward.sourceId} />
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-3">来源链路</h4>
                <div className="space-y-3">
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-500 to-cyan-500 flex items-center justify-center flex-shrink-0">
                      <Gift className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 bg-white rounded-lg border border-slate-200 p-4">
                      <p className="font-medium text-slate-800 text-sm">奖励记录</p>
                      <p className="text-xs text-slate-500 mt-1">
                        {reward.playerName} - {reward.itemName} x{reward.quantity}
                      </p>
                      <p className="text-xs text-slate-400 mt-2">{formatDate(reward.createdAt)}</p>
                    </div>
                  </div>

                  <div className="flex justify-center">
                    <ArrowRight className="w-4 h-4 text-slate-300" />
                  </div>

                  <div className="flex items-start gap-4">
                    <div className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                      reward.sourceType === 'drop_config' && 'bg-gradient-to-br from-blue-500 to-indigo-500',
                      reward.sourceType === 'leaderboard' && 'bg-gradient-to-br from-amber-500 to-orange-500',
                      reward.sourceType === 'manual' && 'bg-gradient-to-br from-purple-500 to-pink-500'
                    )}>
                      {reward.sourceType === 'drop_config' && <Settings className="w-4 h-4 text-white" />}
                      {reward.sourceType === 'leaderboard' && <Trophy className="w-4 h-4 text-white" />}
                      {reward.sourceType === 'manual' && <UserPlus className="w-4 h-4 text-white" />}
                    </div>
                    <div className="flex-1 bg-white rounded-lg border border-slate-200 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <p className="font-medium text-slate-800 text-sm">
                          {getSourceTypeText(reward.sourceType)}
                        </p>
                        {sourceConfig && 'version' in sourceConfig && (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                            v{sourceConfig.version}
                          </span>
                        )}
                      </div>
                      {sourceConfig && 'sourceFile' in sourceConfig && (
                        <p className="text-xs text-slate-500">{sourceConfig.sourceFile}</p>
                      )}
                      {sourceConfig && 'screenshotUrl' in sourceConfig && sourceConfig.screenshotUrl && (
                        <img
                          src={sourceConfig.screenshotUrl}
                          alt="排行榜截图"
                          className="w-full h-32 object-cover rounded-lg mt-3"
                        />
                      )}
                      {sourceConfig && 'name' in sourceConfig && (
                        <p className="text-sm font-medium text-slate-700 mt-2">
                          {sourceConfig.name}
                        </p>
                      )}
                      {reward.sourceType === 'manual' && (
                        <p className="text-xs text-slate-500">手动添加的奖励记录</p>
                      )}
                      <p className="text-xs text-slate-400 mt-2">
                        操作人: {reward.operator}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-3">操作历史</h4>
                <OperationTimeline logs={relatedLogs} />
              </div>

              {reward.remark && (
                <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-amber-800">备注</p>
                      <p className="text-sm text-amber-700 mt-1">{reward.remark}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

interface MergePreviewDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  stats: { newCount: number; duplicateCount: number; conflictCount: number };
  loading: boolean;
}

function MergePreviewDialog({ open, onClose, onConfirm, stats, loading }: MergePreviewDialogProps) {
  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      onConfirm={onConfirm}
      title="合并奖励记录"
      confirmText={loading ? '合并中...' : '确认合并'}
      variant="info"
      message={undefined}
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          系统将从掉落配置和排行榜中合并生成奖励记录，自动去重并标记重复记录。
        </p>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-green-50 rounded-xl p-4 text-center border border-green-200">
            <div className="text-2xl font-bold text-green-600">{stats.newCount}</div>
            <div className="text-xs text-green-600 mt-1">新增</div>
          </div>
          <div className="bg-amber-50 rounded-xl p-4 text-center border border-amber-200">
            <div className="text-2xl font-bold text-amber-600">{stats.duplicateCount}</div>
            <div className="text-xs text-amber-600 mt-1">重复</div>
          </div>
          <div className="bg-red-50 rounded-xl p-4 text-center border border-red-200">
            <div className="text-2xl font-bold text-red-600">{stats.conflictCount}</div>
            <div className="text-xs text-red-600 mt-1">冲突</div>
          </div>
        </div>
        {loading && (
          <div className="flex items-center justify-center py-2">
            <Loader2 className="w-5 h-5 text-sky-500 animate-spin mr-2" />
            <span className="text-sm text-slate-600">正在合并...</span>
          </div>
        )}
      </div>
    </ConfirmDialog>
  );
}

const PAGE_SIZE = 20;

export default function RewardsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    rewards,
    dropConfigs,
    leaderboards,
    currentActivity,
    getStats,
    updateRewardStatus,
    mergeRewardsFromSources,
    exportRewardsToCSV,
    loading,
  } = useAppStore();

  const [statusFilter, setStatusFilter] = useState<RewardStatus | 'all'>('all');
  const [sourceFilter, setSourceFilter] = useState<SourceType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [traceReward, setTraceReward] = useState<Reward | null>(null);
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [mergeStats, setMergeStats] = useState({ newCount: 0, duplicateCount: 0, conflictCount: 0 });
  const [mergeLoading, setMergeLoading] = useState(false);

  const stats = getStats();

  useEffect(() => {
    const source = searchParams.get('source') as SourceType | null;
    const id = searchParams.get('id');
    if (source && id) {
      setSourceFilter(source);
    }
  }, [searchParams]);

  const filteredRewards = useMemo(() => {
    let result = [...rewards];

    const sourceParam = searchParams.get('source');
    const idParam = searchParams.get('id');
    if (sourceParam && idParam) {
      result = result.filter((r) => r.sourceType === sourceParam && r.sourceId === idParam);
    } else {
      if (statusFilter !== 'all') {
        result = result.filter((r) => r.status === statusFilter);
      }
      if (sourceFilter !== 'all') {
        result = result.filter((r) => r.sourceType === sourceFilter);
      }
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (r) =>
          r.playerName.toLowerCase().includes(query) ||
          r.itemName.toLowerCase().includes(query)
      );
    }

    return result.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [rewards, statusFilter, sourceFilter, searchQuery, searchParams]);

  const totalPages = Math.ceil(filteredRewards.length / PAGE_SIZE);
  const paginatedRewards = filteredRewards.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, sourceFilter, searchQuery, searchParams]);

  const handleSelectAll = () => {
    if (selectedIds.size === paginatedRewards.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedRewards.map((r) => r.id)));
    }
  };

  const handleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleStatusChange = async (status: RewardStatus, remark: string) => {
    try {
      for (const id of selectedIds) {
        await updateRewardStatus(id, status, remark);
      }
      setSelectedIds(new Set());
    } catch (error) {
      console.error('更新状态失败:', error);
    }
  };

  const calculateMergeStats = () => {
    const existingKeys = new Set(rewards.map(generateRewardKey));
    let newCount = 0;
    let duplicateCount = 0;

    for (const config of dropConfigs) {
      for (const item of config.content) {
        const playerId = `drop_${config.id}_${item.itemId}`;
        const key = generateRewardKey({
          playerId,
          itemName: item.itemName,
          sourceId: config.id,
        });
        if (existingKeys.has(key)) {
          duplicateCount++;
        } else {
          newCount++;
          existingKeys.add(key);
        }
      }
    }

    for (const board of leaderboards) {
      for (const item of board.extractedData) {
        const key = generateRewardKey({
          playerId: item.playerId,
          itemName: '排行榜奖励',
          sourceId: board.id,
        });
        if (existingKeys.has(key)) {
          duplicateCount++;
        } else {
          newCount++;
          existingKeys.add(key);
        }
      }
    }

    setMergeStats({ newCount, duplicateCount, conflictCount: 0 });
    setShowMergeDialog(true);
  };

  const handleMerge = async () => {
    setMergeLoading(true);
    try {
      await mergeRewardsFromSources();
      setShowMergeDialog(false);
    } catch (error) {
      console.error('合并失败:', error);
    } finally {
      setMergeLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const statuses = statusFilter === 'all' ? undefined : [statusFilter];
      const csv = await exportRewardsToCSV(statuses);
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `奖励记录_${formatDate(new Date()).replace(/:/g, '-')}.csv`;
      link.click();
    } catch (error) {
      console.error('导出失败:', error);
    }
  };

  const statusCapsules: { value: RewardStatus | 'all'; label: string; count: number }[] = [
    { value: 'all', label: '全部', count: stats.total },
    { value: 'confirmed', label: '已确认', count: stats.confirmed },
    { value: 'pending', label: '待补', count: stats.pending },
    { value: 'manual', label: '人工修改', count: stats.manual },
    { value: 'missed', label: '漏发', count: stats.missed },
  ];

  const sourceCapsules: { value: SourceType | 'all'; label: string }[] = [
    { value: 'all', label: '全部' },
    { value: 'drop_config', label: '掉落配置' },
    { value: 'leaderboard', label: '排行榜' },
    { value: 'manual', label: '手动' },
  ];

  if (!currentActivity) {
    return (
      <EmptyState
        title="请先选择活动"
        description="在顶部下拉菜单中选择一个活动开始管理"
      />
    );
  }

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm"
      >
        <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 mb-2">奖励记录中心</h1>
            <p className="text-sm text-slate-500">
              管理所有奖励记录，支持状态标记、来源追溯和批量操作
            </p>
          </div>
          <div className="flex items-center gap-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={calculateMergeStats}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-all"
            >
              <Merge className="w-4 h-4" />
              合并奖励
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-sky-500 to-cyan-500 text-white text-sm font-medium rounded-lg shadow-md shadow-sky-500/20 hover:shadow-lg hover:shadow-sky-500/30 transition-all"
            >
              <Download className="w-4 h-4" />
              导出CSV
            </motion.button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            title="已确认"
            value={stats.confirmed}
            icon={Check}
            color="green"
          />
          <StatCard
            title="待补"
            value={stats.pending}
            icon={History}
            color="amber"
          />
          <StatCard
            title="人工修改"
            value={stats.manual}
            icon={Tag}
            color="purple"
          />
          <StatCard
            title="漏发"
            value={stats.missed}
            icon={AlertCircle}
            color="red"
          />
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4"
      >
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-medium text-slate-600">状态:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {statusCapsules.map((capsule) => (
              <button
                key={capsule.value}
                onClick={() => setStatusFilter(capsule.value)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-sm font-medium transition-all',
                  statusFilter === capsule.value
                    ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                )}
              >
                {capsule.label}
                <span className={cn(
                  'ml-1.5 px-1.5 py-0.5 rounded-full text-xs',
                  statusFilter === capsule.value ? 'bg-white/20' : 'bg-white'
                )}>
                  {capsule.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-medium text-slate-600">来源:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {sourceCapsules.map((capsule) => (
              <button
                key={capsule.value}
                onClick={() => {
                  setSourceFilter(capsule.value);
                  setSearchParams({});
                }}
                className={cn(
                  'px-3 py-1.5 rounded-full text-sm font-medium transition-all',
                  sourceFilter === capsule.value && !searchParams.get('source')
                    ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                )}
              >
                {capsule.label}
              </button>
            ))}
            {searchParams.get('source') && (
              <button
                onClick={() => setSearchParams({})}
                className="px-3 py-1.5 rounded-full text-sm font-medium bg-amber-100 text-amber-700 flex items-center gap-1"
              >
                {searchParams.get('source') === 'drop_config' ? '指定配置' : '指定排行榜'}
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[250px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索玩家名或物品名..."
              className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all"
            />
          </div>

          <div className="flex items-center gap-2">
            {selectedIds.size > 0 && (
              <>
                <span className="text-sm text-slate-500">已选 {selectedIds.size} 条</span>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowStatusDialog(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-medium rounded-lg shadow-md shadow-amber-500/20 hover:shadow-lg transition-all"
                >
                  <Tag className="w-4 h-4" />
                  标记状态
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleExport}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-all"
                >
                  <Download className="w-4 h-4" />
                  导出选中
                </motion.button>
              </>
            )}
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
      >
        {filteredRewards.length === 0 ? (
          <EmptyState
            icon={Gift}
            title="暂无奖励记录"
            description={
              searchQuery || statusFilter !== 'all' || sourceFilter !== 'all'
                ? '没有找到符合条件的记录，请尝试调整筛选条件'
                : '点击顶部的合并奖励按钮从掉落配置和排行榜生成奖励记录'
            }
            actionText={
              searchQuery || statusFilter !== 'all' || sourceFilter !== 'all'
                ? '清除筛选'
                : '合并奖励'
            }
            onAction={() => {
              if (searchQuery || statusFilter !== 'all' || sourceFilter !== 'all') {
                setSearchQuery('');
                setStatusFilter('all');
                setSourceFilter('all');
                setSearchParams({});
              } else {
                calculateMergeStats();
              }
            }}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="w-12 py-4 px-4">
                      <input
                        type="checkbox"
                        checked={paginatedRewards.length > 0 && selectedIds.size === paginatedRewards.length}
                        onChange={handleSelectAll}
                        className="w-4 h-4 rounded border-slate-300 text-sky-500 focus:ring-sky-500"
                      />
                    </th>
                    <th className="text-left py-4 px-4 font-medium text-slate-600">玩家</th>
                    <th className="text-left py-4 px-4 font-medium text-slate-600">物品</th>
                    <th className="text-left py-4 px-4 font-medium text-slate-600">状态</th>
                    <th className="text-left py-4 px-4 font-medium text-slate-600">来源</th>
                    <th className="text-left py-4 px-4 font-medium text-slate-600">操作人</th>
                    <th className="text-left py-4 px-4 font-medium text-slate-600">更新时间</th>
                    <th className="text-right py-4 px-4 font-medium text-slate-600">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRewards.map((reward, index) => (
                    <motion.tr
                      key={reward.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.02 }}
                      className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                    >
                      <td className="py-4 px-4">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(reward.id)}
                          onChange={() => handleSelect(reward.id)}
                          className="w-4 h-4 rounded border-slate-300 text-sky-500 focus:ring-sky-500"
                        />
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-sky-400 to-cyan-500 flex items-center justify-center text-white font-semibold text-sm">
                            {reward.playerName.charAt(0)}
                          </div>
                          <div>
                            <p className="font-medium text-slate-800">{reward.playerName}</p>
                            <p className="text-xs text-slate-500 font-mono">{reward.playerId}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div>
                          <p className="font-medium text-slate-800">{reward.itemName}</p>
                          <p className="text-xs text-slate-500">x{reward.quantity}</p>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <StatusPill status={reward.status} />
                      </td>
                      <td className="py-4 px-4">
                        <SourceBadge sourceType={reward.sourceType} sourceId={reward.sourceId} />
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-slate-700">{reward.operator}</span>
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-slate-500 text-sm">{formatDate(reward.updatedAt)}</span>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setShowStatusDialog(true)}
                            className="p-2 text-slate-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition-colors"
                            title="标记状态"
                          >
                            <Tag className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setTraceReward(reward)}
                            className="p-2 text-slate-400 hover:text-sky-500 hover:bg-sky-50 rounded-lg transition-colors"
                            title="查看追溯"
                          >
                            <History className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setTraceReward(reward)}
                            className="p-2 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors"
                            title="查看详情"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50">
                <span className="text-sm text-slate-500">
                  共 {filteredRewards.length} 条记录，第 {currentPage} / {totalPages} 页
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className={cn(
                      'p-2 rounded-lg transition-colors',
                      currentPage === 1
                        ? 'text-slate-300 cursor-not-allowed'
                        : 'text-slate-600 hover:bg-slate-200'
                    )}
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum: number;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={cn(
                          'w-9 h-9 rounded-lg text-sm font-medium transition-colors',
                          currentPage === pageNum
                            ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
                            : 'text-slate-600 hover:bg-slate-200'
                        )}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className={cn(
                      'p-2 rounded-lg transition-colors',
                      currentPage === totalPages
                        ? 'text-slate-300 cursor-not-allowed'
                        : 'text-slate-600 hover:bg-slate-200'
                    )}
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </motion.div>

      <StatusDialog
        open={showStatusDialog}
        onClose={() => setShowStatusDialog(false)}
        onConfirm={handleStatusChange}
        selectedCount={selectedIds.size}
      />

      <TracePanel
        reward={traceReward}
        onClose={() => setTraceReward(null)}
      />

      <MergePreviewDialog
        open={showMergeDialog}
        onClose={() => setShowMergeDialog(false)}
        onConfirm={handleMerge}
        stats={mergeStats}
        loading={mergeLoading}
      />
    </div>
  );
}
