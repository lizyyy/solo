import { useState, useMemo } from 'react';
import { useStore } from '@/store/useStore';
import type { ChangeRecord } from '@/types';
import {
  History,
  RotateCcw,
  ArrowRight,
  User,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

const CHANGE_TYPE_MAP: Record<string, { label: string; color: string }> = {
  edit: { label: '手动编辑', color: 'bg-tunnel-accent/20 text-tunnel-accent' },
  rollback: { label: '回滚', color: 'bg-tunnel-info/20 text-tunnel-info' },
  auto_detect: { label: '自动检测', color: 'bg-tunnel-danger/20 text-tunnel-danger' },
};

const BORDER_COLOR_MAP: Record<string, string> = {
  edit: 'border-l-tunnel-accent',
  rollback: 'border-l-tunnel-info',
  auto_detect: 'border-l-tunnel-danger',
};

export default function HistoryPage() {
  const { rows, changeRecords, currentUser, rollbackChange } = useStore();

  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [selectedChangeType, setSelectedChangeType] = useState<'all' | 'edit' | 'rollback' | 'auto_detect'>('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [rollbackTarget, setRollbackTarget] = useState<ChangeRecord | null>(null);
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());

  const rowsWithChanges = useMemo(() => {
    const rowIds = new Set(changeRecords.map((c) => c.rowId));
    return rows.filter((r) => rowIds.has(r.id));
  }, [rows, changeRecords]);

  const filteredRecords = useMemo(() => {
    let result = [...changeRecords];
    if (selectedRowId) {
      result = result.filter((c) => c.rowId === selectedRowId);
    }
    if (selectedChangeType !== 'all') {
      result = result.filter((c) => c.changeType === selectedChangeType);
    }
    result.sort((a, b) => {
      const diff = new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime();
      return sortOrder === 'newest' ? -diff : diff;
    });
    return result;
  }, [changeRecords, selectedRowId, selectedChangeType, sortOrder]);

  const toggleExpand = (id: string) => {
    setExpandedEntries((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleRollbackConfirm = () => {
    if (!rollbackTarget) return;
    rollbackChange(rollbackTarget.id, currentUser.name);
    setRollbackTarget(null);
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
  };

  const getRowInfo = (rowId: string) => {
    const row = rows.find((r) => r.id === rowId);
    return row ? `${row.originalRowNumber}-${row.tunnelName}` : '';
  };

  return (
    <div className="min-h-screen bg-tunnel-bg p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-tunnel-fg flex items-center gap-2">
            <History className="w-6 h-6 text-tunnel-accent" />
            变更历史
          </h1>
          <p className="text-tunnel-muted mt-1">改前改后对比 · 按字段差异高亮 · 回滚操作</p>
        </div>

        <div className="bg-tunnel-surface rounded-lg border border-tunnel-border p-4 flex flex-wrap gap-4 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-tunnel-muted">筛选行</label>
            <select
              value={selectedRowId ?? ''}
              onChange={(e) => setSelectedRowId(e.target.value || null)}
              className="bg-tunnel-card border border-tunnel-border rounded px-3 py-1.5 text-sm text-tunnel-fg focus:outline-none focus:border-tunnel-accent"
            >
              <option value="">全部行</option>
              {rowsWithChanges.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.originalRowNumber}-{r.tunnelName}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-tunnel-muted">变更类型</label>
            <select
              value={selectedChangeType}
              onChange={(e) => setSelectedChangeType(e.target.value as typeof selectedChangeType)}
              className="bg-tunnel-card border border-tunnel-border rounded px-3 py-1.5 text-sm text-tunnel-fg focus:outline-none focus:border-tunnel-accent"
            >
              <option value="all">全部</option>
              <option value="edit">手动编辑</option>
              <option value="rollback">回滚</option>
              <option value="auto_detect">自动检测</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-tunnel-muted">排序</label>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as typeof sortOrder)}
              className="bg-tunnel-card border border-tunnel-border rounded px-3 py-1.5 text-sm text-tunnel-fg focus:outline-none focus:border-tunnel-accent"
            >
              <option value="newest">最新优先</option>
              <option value="oldest">最早优先</option>
            </select>
          </div>
        </div>

        {filteredRecords.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-tunnel-muted">
            <History className="w-12 h-12 mb-4 opacity-30" />
            <p className="text-lg">暂无变更记录</p>
          </div>
        ) : (
          <div className="relative space-y-0">
            <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-tunnel-border" />
            {filteredRecords.map((record) => {
              const isExpanded = expandedEntries.has(record.id);
              const typeInfo = CHANGE_TYPE_MAP[record.changeType] ?? CHANGE_TYPE_MAP.edit;
              const borderColor = BORDER_COLOR_MAP[record.changeType] ?? BORDER_COLOR_MAP.edit;

              return (
                <div key={record.id} className="relative pl-12 pb-4">
                  <div className={`absolute left-3.5 top-3 w-3 h-3 rounded-full border-2 border-tunnel-bg ${record.changeType === 'edit' ? 'bg-tunnel-accent' : record.changeType === 'rollback' ? 'bg-tunnel-info' : 'bg-tunnel-danger'}`} />
                  <div className={`bg-tunnel-card rounded-lg border border-tunnel-border border-l-4 ${borderColor} p-4`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-tunnel-muted">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{formatTime(record.changedAt)}</span>
                        <span className={`px-2 py-0.5 rounded text-xs ${typeInfo.color}`}>
                          {typeInfo.label}
                        </span>
                        <User className="w-3.5 h-3.5 ml-1" />
                        <span>{record.changedBy}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {record.changeType === 'edit' && (
                          <button
                            onClick={() => setRollbackTarget(record)}
                            className="p-1.5 rounded hover:bg-tunnel-surface text-tunnel-muted hover:text-tunnel-info transition-colors"
                            title="回滚"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => toggleExpand(record.id)}
                          className="p-1.5 rounded hover:bg-tunnel-surface text-tunnel-muted transition-colors"
                        >
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center gap-2 flex-wrap">
                      <span className="text-tunnel-fg font-medium">{record.fieldName}</span>
                      <span className="line-through text-red-400 font-mono text-sm">{record.oldValue}</span>
                      <ArrowRight className="w-4 h-4 text-tunnel-muted shrink-0" />
                      <span className="text-green-400 font-mono text-sm">{record.newValue}</span>
                    </div>

                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-tunnel-border text-sm text-tunnel-muted space-y-1">
                        <div className="flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>关联行：{getRowInfo(record.rowId)}</span>
                        </div>
                        <div>记录ID：{record.id}</div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {rollbackTarget && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-tunnel-surface rounded-lg border border-tunnel-border p-6 w-full max-w-md space-y-4">
            <h2 className="text-lg font-bold text-tunnel-fg">确认回滚</h2>
            <p className="text-sm text-tunnel-muted">
              将字段 <span className="text-tunnel-fg font-medium">{rollbackTarget.fieldName}</span> 从{' '}
              <span className="text-green-400 font-mono">{rollbackTarget.newValue}</span> 恢复为{' '}
              <span className="text-red-400 font-mono">{rollbackTarget.oldValue}</span>，此操作会生成一条回滚记录
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setRollbackTarget(null)}
                className="px-4 py-2 rounded border border-tunnel-border text-tunnel-muted hover:text-tunnel-fg transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleRollbackConfirm}
                className="px-4 py-2 rounded bg-tunnel-info text-white hover:bg-tunnel-info/80 transition-colors"
              >
                确认回滚
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
