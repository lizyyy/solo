import { useMemo, useState } from 'react';
import { Camera, Download, Filter, History, Search, GitCompare } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { encodeSnapshotId, exportToCSV, triggerDownload } from '../utils/reviewEngine';
import { cn } from '../lib/utils';
import type { ExceptionRecord, FilterConditions } from '../types';

export default function Exceptions() {
  const {
    exceptions, snapshots, activeSnapshotId, createSnapshot, applySnapshot, recordExport, updateExceptionStatus
  } = useAppStore();

  const [conditions, setConditions] = useState<FilterConditions>({});
  const [snapshotName, setSnapshotName] = useState('');
  const [snapshotInput, setSnapshotInput] = useState('');
  const [snapshotsOpen, setSnapshotsOpen] = useState(true);

  const setField = <K extends keyof FilterConditions>(k: K, v: FilterConditions[K]) =>
    setConditions((c) => ({ ...c, [k]: v }));

  const applySnapshotById = (id: string) => {
    const snap = snapshots.find((s) => s.id === id);
    if (snap) {
      setConditions(snap.conditions);
      applySnapshot(id);
    }
  };

  const loadFromInput = () => {
    const id = snapshotInput.trim();
    if (!id) return;
    const snap = snapshots.find((s) => s.id === id);
    if (snap) applySnapshotById(id);
    setSnapshotInput('');
  };

  const filtered: ExceptionRecord[] = useMemo(() => {
    return exceptions.filter((e) => {
      if (conditions.status && e.status !== conditions.status) return false;
      if (conditions.severity && e.severity !== conditions.severity) return false;
      if (conditions.paramVersion && String(e.paramVersion) !== conditions.paramVersion) return false;
      if (conditions.baseVersion && String(e.baseVersion) !== conditions.baseVersion) return false;
      if (conditions.targetVersion && String(e.targetVersion) !== conditions.targetVersion) return false;
      if (conditions.keyword) {
        const kw = conditions.keyword.toLowerCase();
        if (
          !e.sampleName.toLowerCase().includes(kw) &&
          !e.reason.toLowerCase().includes(kw) &&
          !(e.impactSummary ?? '').toLowerCase().includes(kw) &&
          !(e.pathBefore ?? '').toLowerCase().includes(kw) &&
          !(e.pathAfter ?? '').toLowerCase().includes(kw)
        ) return false;
      }
      if (conditions.dateFrom && e.createdAt < conditions.dateFrom) return false;
      if (conditions.dateTo && e.createdAt > conditions.dateTo + ' 23:59:59') return false;
      return true;
    });
  }, [exceptions, conditions]);

  const handleCreateSnapshot = () => {
    if (!snapshotName.trim()) return;
    const snap = createSnapshot(snapshotName.trim(), conditions);
    applySnapshot(snap.id);
    setSnapshotName('');
  };

  const handleExport = () => {
    const snapId = activeSnapshotId && snapshots.find((s) => s.id === activeSnapshotId)
      ? activeSnapshotId
      : encodeSnapshotId(conditions as Record<string, unknown>);
    const rows = filtered.map((e) => ({
      ID: e.id,
      样本: e.sampleName,
      原因: e.reason,
      影响摘要: e.impactSummary ?? '',
      base版本: `v${e.baseVersion}`,
      target版本: `v${e.targetVersion}`,
      路径Before: e.pathBefore ?? '',
      路径After: e.pathAfter ?? '',
      状态: e.status,
      严重度: e.severity,
      参数版本: `v${e.paramVersion}`,
      快照ID: e.snapshotId ?? snapId,
      创建时间: e.createdAt,
    }));
    const csv = exportToCSV(rows);
    const fileName = `exceptions_${snapId}_${new Date().toISOString().slice(0, 10)}.csv`;
    triggerDownload(csv, fileName);
    if (activeSnapshotId) recordExport(activeSnapshotId, fileName);
  };

  const severityBadge = (s: ExceptionRecord['severity']) =>
    s === 'high' ? 'badge-amber' : s === 'medium' ? 'badge-navy' : 'badge-emerald';

  const statusBadge = (s: ExceptionRecord['status']) =>
    s === 'pending' ? 'badge-amber' : s === 'reviewing' ? 'badge-navy' : 'badge-emerald';

  const statusText = (s: ExceptionRecord['status']) =>
    s === 'pending' ? '待处理' : s === 'reviewing' ? '处理中' : '已解决';

  const severityText = (s: ExceptionRecord['severity']) =>
    s === 'high' ? '高' : s === 'medium' ? '中' : '低';

  const activeConditions = Object.entries(conditions).filter(([, v]) => v !== undefined && v !== '');

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display text-xl text-navy-800 font-semibold">异常队列</h2>
          <p className="text-sm text-slate-500 mt-1">
            筛选条件保存为快照后导出，文件名自带快照 ID，按 ID 可追回同一批记录
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center border border-slate-300">
            <input
              className="px-2 py-1.5 text-sm w-44 font-mono-data"
              placeholder="输入快照 ID 追回"
              value={snapshotInput}
              onChange={(e) => setSnapshotInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadFromInput()}
            />
            <button className="btn btn-sm !rounded-none !border-0 !border-l" onClick={loadFromInput}>
              <Search className="w-3.5 h-3.5" /> 加载
            </button>
          </div>
          <button className="btn btn-sm btn-primary" onClick={handleExport} disabled={filtered.length === 0}>
            <Download className="w-3.5 h-3.5" /> 导出 ({filtered.length})
          </button>
        </div>
      </div>

      <div className="card p-4">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <Filter className="w-4 h-4 text-navy-700" />
          <h3 className="font-display text-sm text-navy-800 font-semibold">筛选条件</h3>
          {activeSnapshotId && (
            <span className="badge badge-navy font-mono-data">当前快照 {activeSnapshotId}</span>
          )}
          {activeConditions.length > 0 && (
            <div className="flex gap-1.5 ml-2 flex-wrap">
              {activeConditions.map(([k, v]) => (
                <span key={k} className="badge badge-navy bg-white text-xs">
                  {k}: {String(v)}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          <select className="border border-slate-300 px-2 py-1.5 text-sm" value={conditions.status ?? ''} onChange={(e) => setField('status', e.target.value || undefined)}>
            <option value="">全部状态</option>
            <option value="pending">待处理</option>
            <option value="reviewing">处理中</option>
            <option value="resolved">已解决</option>
          </select>
          <select className="border border-slate-300 px-2 py-1.5 text-sm" value={conditions.severity ?? ''} onChange={(e) => setField('severity', e.target.value || undefined)}>
            <option value="">全部严重度</option>
            <option value="high">高</option>
            <option value="medium">中</option>
            <option value="low">低</option>
          </select>
          <select className="border border-slate-300 px-2 py-1.5 text-sm" value={conditions.baseVersion ?? ''} onChange={(e) => setField('baseVersion', e.target.value || undefined)}>
            <option value="">base版本</option>
            <option value="1">v1</option>
            <option value="2">v2</option>
            <option value="3">v3</option>
          </select>
          <select className="border border-slate-300 px-2 py-1.5 text-sm" value={conditions.targetVersion ?? ''} onChange={(e) => setField('targetVersion', e.target.value || undefined)}>
            <option value="">target版本</option>
            <option value="1">v1</option>
            <option value="2">v2</option>
            <option value="3">v3</option>
          </select>
          <select className="border border-slate-300 px-2 py-1.5 text-sm" value={conditions.paramVersion ?? ''} onChange={(e) => setField('paramVersion', e.target.value || undefined)}>
            <option value="">样本绑定版</option>
            <option value="1">v1</option>
            <option value="2">v2</option>
            <option value="3">v3</option>
          </select>
          <input className="border border-slate-300 px-2 py-1.5 text-sm" placeholder="关键词(原因/路径)" value={conditions.keyword ?? ''} onChange={(e) => setField('keyword', e.target.value || undefined)} />
          <input type="date" className="border border-slate-300 px-2 py-1.5 text-sm" value={conditions.dateFrom ?? ''} onChange={(e) => setField('dateFrom', e.target.value || undefined)} />
          <input type="date" className="border border-slate-300 px-2 py-1.5 text-sm" value={conditions.dateTo ?? ''} onChange={(e) => setField('dateTo', e.target.value || undefined)} />
        </div>

        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2">
          <input
            className="border border-slate-300 px-2 py-1.5 text-sm flex-1 max-w-sm"
            placeholder="快照名称（如 v2→v3 高严重度待处理）"
            value={snapshotName}
            onChange={(e) => setSnapshotName(e.target.value)}
          />
          <button className="btn btn-sm" onClick={handleCreateSnapshot}>
            <Camera className="w-3.5 h-3.5" /> 保存筛选快照
          </button>
          <button className="btn btn-sm" onClick={() => { setConditions({}); applySnapshot(null); }}>
            清空
          </button>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="data-table text-[12px]">
          <thead>
            <tr>
              <th>状态</th>
              <th>严重度</th>
              <th>样本</th>
              <th>原因</th>
              <th>影响摘要</th>
              <th><GitCompare className="inline w-3 h-3 mr-0.5" />版本对</th>
              <th>路径变更</th>
              <th>快照 ID</th>
              <th>创建时间</th>
              <th style={{ width: 110 }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={10} className="text-center py-10 text-slate-400 text-sm">暂无符合条件的异常记录</td>
              </tr>
            ) : filtered.map((e) => (
              <tr key={e.id}>
                <td>
                  <span className={`badge ${statusBadge(e.status)}`}>{statusText(e.status)}</span>
                </td>
                <td>
                  <span className={`badge ${severityBadge(e.severity)}`}>{severityText(e.severity)}</span>
                </td>
                <td className="font-medium text-navy-800">{e.sampleName}</td>
                <td className="text-sm text-slate-600 max-w-xs">{e.reason}</td>
                <td className="text-[11px] font-mono-data text-slate-500 max-w-xs truncate" title={e.impactSummary}>
                  {e.impactSummary || '—'}
                </td>
                <td className="font-mono-data text-[11px] whitespace-nowrap">
                  <span className="text-emerald-700">v{e.baseVersion}</span>
                  <span className="text-slate-400">→</span>
                  <span className="text-navy-700">v{e.targetVersion}</span>
                </td>
                <td className="font-mono-data text-[11px] text-slate-600 max-w-[180px]" title={`Before: ${e.pathBefore}\nAfter: ${e.pathAfter}`}>
                  {e.pathBefore !== e.pathAfter ? (
                    <div className="space-y-0.5">
                      <div className="text-emerald-700 truncate">B:{e.pathBefore ?? '—'}</div>
                      <div className="text-amber-700 truncate">T:{e.pathAfter ?? '—'}</div>
                    </div>
                  ) : (
                    <span className="text-slate-400">{e.pathBefore ?? '—'}</span>
                  )}
                </td>
                <td className="font-mono-data text-xs text-slate-500">{e.snapshotId ?? '—'}</td>
                <td className="font-mono-data text-xs text-slate-500">{e.createdAt}</td>
                <td>
                  <select
                    className={cn('text-xs border border-slate-300 px-1.5 py-1', e.status === 'pending' && 'border-amber-400 bg-amber-50')}
                    value={e.status}
                    onChange={(ev) => updateExceptionStatus(e.id, ev.target.value as ExceptionRecord['status'])}
                  >
                    <option value="pending">待处理</option>
                    <option value="reviewing">处理中</option>
                    <option value="resolved">已解决</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card p-4">
        <button
          className="flex items-center gap-2 text-sm font-medium text-navy-800 w-full"
          onClick={() => setSnapshotsOpen((s) => !s)}
        >
          <History className="w-4 h-4" />
          已保存筛选快照（{snapshots.length}）
        </button>
        {snapshotsOpen && (
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {snapshots.map((s) => (
              <div
                key={s.id}
                className={cn(
                  'p-3 border cursor-pointer transition-colors',
                  activeSnapshotId === s.id ? 'border-navy-600 bg-navy-50' : 'border-slate-200 bg-white hover:border-navy-300'
                )}
                onClick={() => applySnapshotById(s.id)}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-navy-800">{s.name}</span>
                  <span className="badge badge-navy font-mono-data text-[10px]">{s.id}</span>
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {Object.entries(s.conditions).filter(([, v]) => v).map(([k, v]) => (
                    <span key={k} className="badge badge-navy bg-white text-[10px]">{k}:{String(v)}</span>
                  ))}
                  {Object.values(s.conditions).every((v) => !v) && (
                    <span className="text-xs text-slate-400">无筛选条件</span>
                  )}
                </div>
                <div className="text-xs text-slate-400 mt-2 font-mono-data flex justify-between">
                  <span>{s.createdAt.slice(0, 16)}</span>
                  {s.exportedAt && <span className="text-emerald-600">✓ 已导出</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
