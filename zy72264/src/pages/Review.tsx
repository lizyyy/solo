import { useState, useMemo, useRef, useEffect } from 'react';
import {
  ClipboardCheck, Eye, Edit3, Save, X, AlertTriangle,
  MapPin, ChevronRight, ChevronLeft, Search, Filter, ShieldAlert,
} from 'lucide-react';
import { useStore } from '@/store/useStore';
import { canEdit, detectLengthMismatch } from '@/utils/boundaryRules';
import type { SafetyRadiusRow, RowStatus } from '@/types';
import { StatusBadge } from '@/components/StatusBadge';
import { cn } from '@/lib/utils';

const STATUS_OPTIONS: { label: string; value: RowStatus | 'all' }[] = [
  { label: '全部', value: 'all' },
  { label: '待处理', value: 'pending' },
  { label: '已修改', value: 'modified' },
  { label: '待审核', value: 'review' },
  { label: '已归档', value: 'archived' },
];

const CHANGE_TYPE_BADGE: Record<string, string> = {
  edit: 'bg-tunnel-accent/20 text-tunnel-accent',
  rollback: 'bg-tunnel-info/20 text-tunnel-info',
  auto_detect: 'bg-tunnel-danger/20 text-tunnel-danger',
};

const CHANGE_TYPE_LABEL: Record<string, string> = {
  edit: '编辑',
  rollback: '回滚',
  auto_detect: '自动检测',
};

export default function Review() {
  const { rows, changeRecords, currentUser, updateRow, coordinateDocs } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<RowStatus | 'all'>('all');
  const [editingRow, setEditingRow] = useState<SafetyRadiusRow | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [showCoordDrawer, setShowCoordDrawer] = useState(false);
  const [historyRowId, setHistoryRowId] = useState<string | null>(null);
  const historyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (historyRef.current && !historyRef.current.contains(e.target as Node)) {
        setHistoryRowId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: rows.length };
    for (const r of rows) counts[r.status] = (counts[r.status] || 0) + 1;
    return counts;
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        return r.tunnelName.toLowerCase().includes(s) || r.remark.toLowerCase().includes(s);
      }
      return true;
    });
  }, [rows, statusFilter, searchTerm]);

  const rowChanges = useMemo(() => {
    const map: Record<string, typeof changeRecords> = {};
    for (const cr of changeRecords) {
      if (!map[cr.rowId]) map[cr.rowId] = [];
      map[cr.rowId].push(cr);
    }
    return map;
  }, [changeRecords]);

  const openEdit = (row: SafetyRadiusRow) => {
    if (!canEdit(row)) return;
    setEditingRow(row);
    setEditValues({ remark: row.remark, length: String(row.length), calculatedLength: String(row.calculatedLength) });
  };

  const handleSave = () => {
    if (!editingRow) return;
    const fields = ['remark', 'length', 'calculatedLength'] as const;
    for (const f of fields) {
      const old = String(editingRow[f as keyof SafetyRadiusRow] ?? '');
      if (editValues[f] !== old) {
        updateRow(editingRow.id, f, editValues[f], currentUser.name);
      }
    }
    setEditingRow(null);
    setEditValues({});
  };

  const coordLines = coordinateDocs[0]?.content.split('\n') || [];

  return (
    <div className="min-h-screen bg-tunnel-bg text-tunnel-fg p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardCheck className="w-6 h-6 text-tunnel-accent" />
            审阅工作台
          </h1>
          <p className="text-tunnel-muted text-sm mt-1">安全半径表逐行审阅 · 原始行号 · 改动标注</p>
        </div>
        <button
          onClick={() => setShowCoordDrawer(!showCoordDrawer)}
          className="flex items-center gap-1 px-3 py-1.5 rounded bg-tunnel-surface border border-tunnel-border text-sm hover:bg-tunnel-card transition-colors"
        >
          <MapPin className="w-4 h-4 text-tunnel-accent" />
          坐标原点说明
          {showCoordDrawer ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-tunnel-muted" />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="搜索隧道名称或备注"
            className="w-full pl-8 pr-3 py-1.5 rounded bg-tunnel-surface border border-tunnel-border text-sm focus:outline-none focus:border-tunnel-accent"
          />
        </div>
        <div className="flex items-center gap-1">
          <Filter className="w-4 h-4 text-tunnel-muted mr-1" />
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={cn(
                'px-2.5 py-1 rounded text-xs font-medium transition-colors',
                statusFilter === opt.value
                  ? 'bg-tunnel-accent text-white'
                  : 'bg-tunnel-surface text-tunnel-muted hover:bg-tunnel-card'
              )}
            >
              {opt.label}
              <span className="ml-1 px-1 py-0.5 rounded bg-tunnel-card text-tunnel-muted text-[10px]">
                {statusCounts[opt.value] || 0}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto border border-tunnel-border rounded-lg">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-tunnel-surface text-tunnel-muted text-left">
              <th className="px-3 py-2 sticky left-0 bg-tunnel-surface z-10">原始行号</th>
              <th className="px-3 py-2">隧道名称</th>
              <th className="px-3 py-2">坐标原点</th>
              <th className="px-3 py-2">安全半径</th>
              <th className="px-3 py-2">长度</th>
              <th className="px-3 py-2">计算长度</th>
              <th className="px-3 py-2">备注</th>
              <th className="px-3 py-2">改动标记</th>
              <th className="px-3 py-2">状态</th>
              <th className="px-3 py-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => {
              const mismatch = detectLengthMismatch(row).isAbnormal;
              const changes = rowChanges[row.id] || [];
              const borderClass = row.status === 'review'
                ? 'border-l-2 border-tunnel-danger'
                : changes.length > 0
                  ? 'border-l-2 border-tunnel-accent'
                  : '';
              return (
                <tr
                  key={row.id}
                  className={cn('hover:bg-tunnel-card transition-colors', borderClass)}
                >
                  <td className="px-3 py-2 font-mono sticky left-0 bg-tunnel-surface z-10">{row.originalRowNumber}</td>
                  <td className="px-3 py-2">{row.tunnelName}</td>
                  <td className="px-3 py-2">{row.coordinateOrigin}</td>
                  <td className="px-3 py-2 font-mono">{row.radius}</td>
                  <td className={cn('px-3 py-2 font-mono', mismatch && 'text-tunnel-danger')}>{row.length}</td>
                  <td className="px-3 py-2 font-mono">{row.calculatedLength}</td>
                  <td className="px-3 py-2 max-w-[200px] truncate">{row.remark}</td>
                  <td className="px-3 py-2">
                    {changes.length > 0 && <span className="inline-block w-2.5 h-2.5 rounded-full bg-tunnel-accent" />}
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge status={row.status} />
                    {row.status === 'review' && currentUser.role === 'engineer' && (
                      <span className="flex items-center gap-0.5 mt-0.5 text-[10px] text-tunnel-danger opacity-80">
                        <ShieldAlert className="w-2.5 h-2.5" />
                        需展陈客户确认
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1 relative">
                      <button
                        onClick={() => openEdit(row)}
                        className="p-1 rounded hover:bg-tunnel-card transition-colors"
                        title={canEdit(row) ? '编辑' : '已归档，不可编辑'}
                      >
                        <Edit3 className="w-4 h-4 text-tunnel-accent" />
                      </button>
                      <button
                        onClick={() => setHistoryRowId(historyRowId === row.id ? null : row.id)}
                        className="p-1 rounded hover:bg-tunnel-card transition-colors"
                        title="查看历史"
                      >
                        <Eye className="w-4 h-4 text-tunnel-info" />
                      </button>
                      {historyRowId === row.id && (
                        <div ref={historyRef} className="absolute top-full right-0 mt-1 w-80 max-h-64 overflow-y-auto bg-tunnel-surface border border-tunnel-border rounded-lg shadow-xl z-50 p-3">
                          <p className="text-xs font-semibold text-tunnel-muted mb-2">变更历史</p>
                          {changes.length === 0 ? (
                            <p className="text-xs text-tunnel-muted">暂无变更记录</p>
                          ) : (
                            [...changes].sort((a, b) => b.changedAt.localeCompare(a.changedAt)).map((cr) => (
                              <div key={cr.id} className="mb-2 pb-2 border-b border-tunnel-border last:border-0">
                                <div className="flex items-center gap-2 text-xs text-tunnel-muted mb-0.5">
                                  <span>{new Date(cr.changedAt).toLocaleString()}</span>
                                  <span className={cn('px-1.5 py-0.5 rounded text-[10px]', CHANGE_TYPE_BADGE[cr.changeType])}>
                                    {CHANGE_TYPE_LABEL[cr.changeType]}
                                  </span>
                                </div>
                                <div className="text-xs">
                                  <span className="text-tunnel-muted">{cr.fieldName}：</span>
                                  <span className="line-through text-tunnel-muted">{cr.oldValue}</span>
                                  <span className="mx-1 text-tunnel-muted">→</span>
                                  <span className="text-tunnel-fg">{cr.newValue}</span>
                                </div>
                                <div className="text-[10px] text-tunnel-muted">操作人：{cr.changedBy}</div>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={10} className="text-center py-8 text-tunnel-muted">无匹配数据</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editingRow && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50" onClick={() => setEditingRow(null)}>
          <div className="bg-tunnel-surface border border-tunnel-border rounded-lg shadow-xl w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">编辑行 {editingRow.originalRowNumber}</h2>
              <button onClick={() => setEditingRow(null)} className="p-1 rounded hover:bg-tunnel-card"><X className="w-5 h-5" /></button>
            </div>
            {editingRow.status === 'archived' ? (
              <div className="flex items-center gap-2 text-tunnel-danger">
                <AlertTriangle className="w-5 h-5" />
                <span>该行已归档，无法编辑</span>
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><span className="text-tunnel-muted">隧道名称</span><p className="font-medium">{editingRow.tunnelName}</p></div>
                    <div><span className="text-tunnel-muted">坐标原点</span><p className="font-medium">{editingRow.coordinateOrigin}</p></div>
                    <div><span className="text-tunnel-muted">安全半径</span><p className="font-mono font-medium">{editingRow.radius}</p></div>
                    <div><span className="text-tunnel-muted">原始行号</span><p className="font-mono font-medium">{editingRow.originalRowNumber}</p></div>
                  </div>
                  <div>
                    <label className="text-xs text-tunnel-muted">备注</label>
                    <p className="text-xs text-tunnel-muted line-through mb-1">改前值：{editingRow.remark}</p>
                    <textarea
                      value={editValues.remark || ''}
                      onChange={(e) => setEditValues({ ...editValues, remark: e.target.value })}
                      className="w-full px-2 py-1.5 rounded bg-tunnel-bg border border-tunnel-border text-sm focus:outline-none focus:border-tunnel-accent"
                      rows={2}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-tunnel-muted">长度</label>
                      <p className="text-xs text-tunnel-muted line-through mb-1">改前值：{editingRow.length}</p>
                      <input
                        type="number"
                        value={editValues.length || ''}
                        onChange={(e) => setEditValues({ ...editValues, length: e.target.value })}
                        className="w-full px-2 py-1.5 rounded bg-tunnel-bg border border-tunnel-border text-sm font-mono focus:outline-none focus:border-tunnel-accent"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-tunnel-muted">计算长度</label>
                      <p className="text-xs text-tunnel-muted line-through mb-1">改前值：{editingRow.calculatedLength}</p>
                      <input
                        type="number"
                        value={editValues.calculatedLength || ''}
                        onChange={(e) => setEditValues({ ...editValues, calculatedLength: e.target.value })}
                        className="w-full px-2 py-1.5 rounded bg-tunnel-bg border border-tunnel-border text-sm font-mono focus:outline-none focus:border-tunnel-accent"
                      />
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-6">
                  <button onClick={() => setEditingRow(null)} className="px-4 py-1.5 rounded bg-tunnel-card border border-tunnel-border text-sm hover:bg-tunnel-bg transition-colors flex items-center gap-1">
                    <X className="w-4 h-4" />取消
                  </button>
                  <button onClick={handleSave} className="px-4 py-1.5 rounded bg-tunnel-accent text-white text-sm hover:opacity-90 transition-colors flex items-center gap-1">
                    <Save className="w-4 h-4" />保存
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div
        className={cn(
          'fixed top-0 right-0 h-full w-96 bg-tunnel-surface shadow-xl z-50 transform transition-transform duration-300 p-6 overflow-y-auto',
          showCoordDrawer ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <MapPin className="w-5 h-5 text-tunnel-accent" />
            {coordinateDocs[0]?.title || '坐标原点说明'}
          </h2>
          <button onClick={() => setShowCoordDrawer(false)} className="p-1 rounded hover:bg-tunnel-card"><X className="w-5 h-5" /></button>
        </div>
        <ol className="space-y-2">
          {coordLines.map((line, i) => (
            <li
              key={i}
              className={cn(
                'text-sm pl-3 py-1 border-l-2',
                i === 5
                  ? 'bg-tunnel-accent/10 border-l-tunnel-accent text-tunnel-fg font-medium'
                  : 'border-l-transparent text-tunnel-muted'
              )}
            >
              {line}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
