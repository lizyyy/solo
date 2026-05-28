import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GitCompare,
  ChevronDown,
  Plus,
  Minus,
  Edit3,
  Check,
  X,
  Building2,
  ArrowRightLeft,
  AlertTriangle,
  TrendingUp,
  ArrowRight,
  Calendar,
} from 'lucide-react';
import type { Snapshot, DiffResult, Enterprise, Transaction, Issue, Gap } from '@/types';
import type { Snapshot as UtilsSnapshot } from '@/utils/types';
import { useDataStore } from '@/store/useDataStore';
import { useUIStore } from '@/store/useUIStore';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { compareSnapshots } from '@/utils/versionDiff';
import { cn } from '@/lib/utils';

interface VersionCompareModalProps {
  isOpen: boolean;
  onClose: () => void;
  snapshots: Snapshot[];
}

type ChangeType = 'added' | 'removed' | 'modified';

interface ChangeItem {
  type: ChangeType;
  category: 'enterprises' | 'transactions' | 'issues' | 'gaps';
  id: string;
  name: string;
  oldValue?: unknown;
  newValue?: unknown;
}

const categoryConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  enterprises: { label: '企业', icon: <Building2 className="w-4 h-4" />, color: '#00D4FF' },
  transactions: { label: '交易', icon: <ArrowRightLeft className="w-4 h-4" />, color: '#00FF9D' },
  issues: { label: '问题', icon: <AlertTriangle className="w-4 h-4" />, color: '#FF3B3B' },
  gaps: { label: '缺口', icon: <TrendingUp className="w-4 h-4" />, color: '#FF8A00' },
};

const changeTypeConfig: Record<ChangeType, { label: string; icon: React.ReactNode; variant: 'success' | 'danger' | 'warning' }> = {
  added: { label: '新增', icon: <Plus className="w-4 h-4" />, variant: 'success' },
  removed: { label: '删除', icon: <Minus className="w-4 h-4" />, variant: 'danger' },
  modified: { label: '修改', icon: <Edit3 className="w-4 h-4" />, variant: 'warning' },
};

export default function VersionCompareModal({
  isOpen,
  onClose,
  snapshots,
}: VersionCompareModalProps) {
  const { applyDiff, loadSnapshot } = useDataStore();
  const { setShowVersionCompareModal } = useUIStore();

  const [oldSnapshotId, setOldSnapshotId] = useState<string | null>(null);
  const [newSnapshotId, setNewSnapshotId] = useState<string | null>(null);
  const [showOldDropdown, setShowOldDropdown] = useState(false);
  const [showNewDropdown, setShowNewDropdown] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const oldSnapshot = useMemo(
    () => snapshots.find((s) => s.id === oldSnapshotId) || null,
    [snapshots, oldSnapshotId]
  );

  const newSnapshot = useMemo(
    () => snapshots.find((s) => s.id === newSnapshotId) || null,
    [snapshots, newSnapshotId]
  );

  const diffResult = useMemo(() => {
    if (!oldSnapshot || !newSnapshot) return null;
    const utilsOldSnapshot: UtilsSnapshot = {
      version: oldSnapshot.id,
      timestamp: oldSnapshot.timestamp,
      data: oldSnapshot.data as unknown as Record<string, unknown>,
    };
    const utilsNewSnapshot: UtilsSnapshot = {
      version: newSnapshot.id,
      timestamp: newSnapshot.timestamp,
      data: newSnapshot.data as unknown as Record<string, unknown>,
    };
    return compareSnapshots(utilsOldSnapshot, utilsNewSnapshot) as unknown as DiffResult;
  }, [oldSnapshot, newSnapshot]);

  const changes = useMemo((): ChangeItem[] => {
    if (!diffResult) return [];

    const items: ChangeItem[] = [];
    const diff = diffResult as unknown as {
      added: Record<string, unknown[]>;
      removed: Record<string, unknown[]>;
      modified: Record<string, { oldValue: unknown; newValue: unknown }[]>;
    };

    (['enterprises', 'transactions', 'issues', 'gaps'] as const).forEach((category) => {
      const added = diff.added?.[category] || [];
      const removed = diff.removed?.[category] || [];
      const modified = diff.modified?.[category] || [];

      added.forEach((item: unknown) => {
        const typedItem = item as { id: string; name?: string; title?: string };
        items.push({
          type: 'added',
          category,
          id: typedItem.id,
          name: typedItem.name || typedItem.title || typedItem.id,
          newValue: typedItem,
        });
      });

      removed.forEach((item: unknown) => {
        const typedItem = item as { id: string; name?: string; title?: string };
        items.push({
          type: 'removed',
          category,
          id: typedItem.id,
          name: typedItem.name || typedItem.title || typedItem.id,
          oldValue: typedItem,
        });
      });

      modified.forEach((item: { oldValue: unknown; newValue: unknown }) => {
        const oldItem = item.oldValue as { id: string; name?: string; title?: string };
        items.push({
          type: 'modified',
          category,
          id: oldItem.id,
          name: oldItem.name || oldItem.title || oldItem.id,
          oldValue: item.oldValue,
          newValue: item.newValue,
        });
      });
    });

    return items;
  }, [diffResult]);

  const filteredChanges = useMemo(() => {
    if (activeCategory === 'all') return changes;
    return changes.filter((c) => c.category === activeCategory);
  }, [changes, activeCategory]);

  const getSummary = (snapshot: Snapshot | null) => {
    if (!snapshot) return null;
    return {
      enterprises: snapshot.data.enterprises.length,
      transactions: snapshot.data.transactions.length,
      issues: snapshot.data.issues.length,
      gaps: snapshot.data.gaps.length,
    };
  };

  const getChangeCount = (category: string) => {
    return changes.filter((c) => c.category === category).length;
  };

  const handleApply = () => {
    if (diffResult) {
      applyDiff(diffResult);
      handleClose();
    }
  };

  const handleLoadOld = () => {
    if (oldSnapshotId) {
      loadSnapshot(oldSnapshotId);
      handleClose();
    }
  };

  const handleClose = () => {
    setOldSnapshotId(null);
    setNewSnapshotId(null);
    setShowVersionCompareModal(false);
    onClose();
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderSnapshotSelector = (
    selectedId: string | null,
    setSelectedId: (id: string | null) => void,
    showDropdown: boolean,
    setShowDropdown: (show: boolean) => void,
    label: string,
    side: 'left' | 'right'
  ) => {
    const selected = snapshots.find((s) => s.id === selectedId);

    return (
      <div className="flex-1 relative">
        <label className="block text-sm text-white/60 mb-2">{label}</label>
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className={cn(
            'w-full px-4 py-3 rounded-xl text-left transition-all',
            'bg-white/5 border border-white/10 hover:border-white/20',
            'flex items-center justify-between'
          )}
        >
          {selected ? (
            <div>
              <div className="font-medium text-white">{selected.description}</div>
              <div className="text-xs text-white/40 flex items-center gap-1 mt-1">
                <Calendar className="w-3 h-3" />
                {formatDate(selected.timestamp)}
              </div>
            </div>
          ) : (
            <span className="text-white/40">选择{label}</span>
          )}
          <ChevronDown className={cn(
            'w-5 h-5 text-white/40 transition-transform',
            showDropdown && 'rotate-180'
          )} />
        </button>

        <AnimatePresence>
          {showDropdown && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={cn(
                'absolute top-full mt-2 w-full z-50 max-h-64 overflow-y-auto',
                side === 'right' ? 'right-0' : 'left-0'
              )}
              style={{
                backgroundColor: 'rgba(10, 22, 40, 0.98)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '12px',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
              }}
            >
              {snapshots.length === 0 ? (
                <div className="px-4 py-8 text-center text-white/40">
                  暂无快照
                </div>
              ) : (
                snapshots.map((snapshot) => (
                  <button
                    key={snapshot.id}
                    onClick={() => {
                      setSelectedId(snapshot.id);
                      setShowDropdown(false);
                    }}
                    className={cn(
                      'w-full px-4 py-3 text-left transition-colors border-b border-white/5 last:border-b-0',
                      selectedId === snapshot.id
                        ? 'bg-accent-cyan/20'
                        : 'hover:bg-white/5'
                    )}
                  >
                    <div className={cn(
                      'font-medium',
                      selectedId === snapshot.id ? 'text-accent-cyan' : 'text-white/80'
                    )}>
                      {snapshot.description}
                    </div>
                    <div className="text-xs text-white/40 flex items-center gap-1 mt-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(snapshot.timestamp)}
                    </div>
                  </button>
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const renderDataSummary = (snapshot: Snapshot | null, side: 'left' | 'right') => {
    const summary = getSummary(snapshot);
    const isLeft = side === 'left';

    return (
      <div className="flex-1 p-4 rounded-xl" style={{
        backgroundColor: isLeft ? 'rgba(255, 59, 59, 0.05)' : 'rgba(0, 255, 157, 0.05)',
        border: isLeft ? '1px solid rgba(255, 59, 59, 0.2)' : '1px solid rgba(0, 255, 157, 0.2)',
      }}>
        {!summary ? (
          <div className="text-center py-12 text-white/30">
            请选择{isLeft ? '旧' : '新'}版本
          </div>
        ) : (
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-white/80 mb-4">数据摘要</h4>
            {Object.entries(categoryConfig).map(([key, config]) => {
              const count = summary[key as keyof typeof summary];
              const changeCount = getChangeCount(key);
              const hasChanges = changeCount > 0;

              return (
                <motion.div
                  key={key}
                  className={cn(
                    'flex items-center justify-between p-3 rounded-lg',
                    hasChanges && isLeft && 'bg-accent-red/10',
                    hasChanges && !isLeft && 'bg-accent-green/10'
                  )}
                  animate={hasChanges ? {
                    boxShadow: [
                      '0 0 0 rgba(0, 0, 0, 0)',
                      isLeft
                        ? '0 0 15px rgba(255, 59, 59, 0.3)'
                        : '0 0 15px rgba(0, 255, 157, 0.3)',
                      '0 0 0 rgba(0, 0, 0, 0)',
                    ],
                  } : undefined}
                  transition={hasChanges ? {
                    boxShadow: {
                      duration: 2,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    },
                  } : undefined}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${config.color}20` }}
                    >
                      <span style={{ color: config.color }}>{config.icon}</span>
                    </div>
                    <span className="text-sm text-white/70">{config.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className="text-xl font-bold"
                      style={{ color: config.color }}
                    >
                      {count}
                    </span>
                    {hasChanges && (
                      <Badge
                        variant={isLeft ? 'danger' : 'success'}
                        size="sm"
                      >
                        {isLeft ? '-' : '+'}{changeCount}
                      </Badge>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderChangeItem = (change: ChangeItem, index: number) => {
    const config = changeTypeConfig[change.type];
    const catConfig = categoryConfig[change.category];

    return (
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: index * 0.05 }}
        className={cn(
          'flex items-center gap-4 p-4 rounded-xl border',
          change.type === 'added' && 'bg-accent-green/5 border-accent-green/20',
          change.type === 'removed' && 'bg-accent-red/5 border-accent-red/20',
          change.type === 'modified' && 'bg-accent-yellow/5 border-accent-yellow/20'
        )}
      >
        <div className={cn(
          'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
          change.type === 'added' && 'bg-accent-green/20',
          change.type === 'removed' && 'bg-accent-red/20',
          change.type === 'modified' && 'bg-accent-yellow/20'
        )}>
          <span className={cn(
            change.type === 'added' && 'text-accent-green',
            change.type === 'removed' && 'text-accent-red',
            change.type === 'modified' && 'text-accent-yellow'
          )}>
            {config.icon}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="text-sm font-medium"
              style={{ color: catConfig.color }}
            >
              {catConfig.label}
            </span>
            <Badge variant={config.variant} size="sm">
              {config.label}
            </Badge>
          </div>
          <div className="text-white/80 font-medium truncate">{change.name}</div>
          <div className="text-xs text-white/40 mt-0.5">ID: {change.id}</div>
        </div>

        {change.type === 'modified' && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-accent-red line-through">旧值</span>
            <ArrowRight className="w-4 h-4 text-white/30" />
            <span className="text-accent-green">新值</span>
          </div>
        )}
      </motion.div>
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="版本对比"
      size="full"
    >
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-6">
          {renderSnapshotSelector(oldSnapshotId, setOldSnapshotId, showOldDropdown, setShowOldDropdown, '旧版本', 'left')}

          <div className="flex flex-col items-center">
            <GitCompare className="w-8 h-8 text-accent-cyan" />
            <span className="text-xs text-white/40 mt-1">对比</span>
          </div>

          {renderSnapshotSelector(newSnapshotId, setNewSnapshotId, showNewDropdown, setShowNewDropdown, '新版本', 'right')}
        </div>

        {diffResult && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="flex gap-6">
              {renderDataSummary(oldSnapshot, 'left')}
              {renderDataSummary(newSnapshot, 'right')}
            </div>

            <div className="border-t border-white/10 pt-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-semibold text-white/80">变更记录</h4>
                <div className="flex gap-2">
                  <button
                    onClick={() => setActiveCategory('all')}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                      activeCategory === 'all'
                        ? 'bg-accent-cyan/20 text-accent-cyan'
                        : 'text-white/60 hover:bg-white/5 hover:text-white'
                    )}
                  >
                    全部 ({changes.length})
                  </button>
                  {Object.entries(categoryConfig).map(([key, config]) => {
                    const count = getChangeCount(key);
                    if (count === 0) return null;
                    return (
                      <button
                        key={key}
                        onClick={() => setActiveCategory(key)}
                        className={cn(
                          'px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5',
                          activeCategory === key
                            ? 'bg-accent-cyan/20 text-accent-cyan'
                            : 'text-white/60 hover:bg-white/5 hover:text-white'
                        )}
                      >
                        <span style={{ color: activeCategory === key ? undefined : config.color }}>
                          {config.icon}
                        </span>
                        {config.label} ({count})
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                {filteredChanges.length === 0 ? (
                  <div className="text-center py-12 text-white/40">
                    {activeCategory === 'all' ? '两个版本完全一致，没有变更' : '该分类没有变更'}
                  </div>
                ) : (
                  filteredChanges.map((change, index) =>
                    renderChangeItem(change, index)
                  )
                )}
              </div>
            </div>
          </motion.div>
        )}

        <div className="flex items-center justify-between pt-4 border-t border-white/10">
          <div className="flex items-center gap-3">
            {oldSnapshot && (
              <Button
                variant="secondary"
                onClick={handleLoadOld}
              >
                加载旧版本
              </Button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              onClick={handleClose}
            >
              取消
            </Button>
            <Button
              variant="primary"
              icon={<Check className="w-4 h-4" />}
              onClick={handleApply}
              disabled={!diffResult || changes.length === 0}
            >
              应用变更
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
