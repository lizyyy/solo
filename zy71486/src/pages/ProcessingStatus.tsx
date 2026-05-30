import { useState, useMemo } from 'react';
import { useStore } from '@/store/useStore';
import type { ProcessingStatusType } from '@/types';
import { STATUS_LABELS, CONFLICT_LABELS, DECIBEL_THRESHOLD } from '@/types';
import { downloadFile } from '@/utils/csvParser';
import {
  Download, FileJson, FileSpreadsheet, Clock, CheckCircle,
  AlertCircle, ChevronDown, ChevronUp, History, Edit3,
} from 'lucide-react';

const STATUS_BADGE: Record<ProcessingStatusType, string> = {
  PENDING: 'bg-warning-muted text-warning',
  PROCESSING: 'bg-amber-muted text-amber',
  RESOLVED: 'bg-success-muted text-success',
};

const STATUS_ICON: Record<ProcessingStatusType, typeof Clock> = {
  PENDING: Clock,
  PROCESSING: Edit3,
  RESOLVED: CheckCircle,
};

export default function ProcessingStatus() {
  const noiseRecords = useStore((s) => s.noiseRecords);
  const rooms = useStore((s) => s.rooms);
  const conflicts = useStore((s) => s.conflicts);
  const processingStatuses = useStore((s) => s.processingStatuses);
  const updateProcessingStatus = useStore((s) => s.updateProcessingStatus);
  const exportReport = useStore((s) => s.exportReport);

  const [filterStatus, setFilterStatus] = useState<ProcessingStatusType | ''>('');
  const [filterRoom, setFilterRoom] = useState('');
  const [filterConflict, setFilterConflict] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState<ProcessingStatusType>('PENDING');
  const [editHandler, setEditHandler] = useState('');
  const [editResult, setEditResult] = useState('');
  const [exportFormat, setExportFormat] = useState<'csv' | 'json'>('csv');

  const activeRecords = useMemo(() => noiseRecords.filter((r) => !r.isDuplicate), [noiseRecords]);
  const roomNameMap = useMemo(() => Object.fromEntries(rooms.map((r) => [r.roomId, r.name])), [rooms]);
  const uniqueRooms = useMemo(() => [...new Set(activeRecords.map((r) => r.roomId))].sort(), [activeRecords]);

  const statusMap = useMemo(() => new Map(processingStatuses.map((p) => [p.noiseRecordId, p])), [processingStatuses]);
  const conflictMap = useMemo(() => {
    const m = new Map<string, typeof conflicts>();
    for (const c of conflicts) {
      const arr = m.get(c.noiseRecordId) || [];
      arr.push(c);
      m.set(c.noiseRecordId, arr);
    }
    return m;
  }, [conflicts]);

  const filtered = useMemo(() => {
    return activeRecords.filter((r) => {
      const ps = statusMap.get(r.id);
      if (filterStatus && ps?.status !== filterStatus) return false;
      if (filterRoom && r.roomId !== filterRoom) return false;
      if (filterConflict === 'yes' && !conflictMap.has(r.id)) return false;
      if (filterConflict === 'no' && conflictMap.has(r.id)) return false;
      return true;
    });
  }, [activeRecords, filterStatus, filterRoom, filterConflict, statusMap, conflictMap]);

  const stats = useMemo(() => {
    const s = { pending: 0, processing: 0, resolved: 0, unresolvedConflicts: 0, updateCount: 0 };
    for (const ps of processingStatuses) {
      if (ps.status === 'PENDING') s.pending++;
      else if (ps.status === 'PROCESSING') s.processing++;
      else s.resolved++;
    }
    s.unresolvedConflicts = conflicts.filter((c) => !c.isResolved).length;
    s.updateCount = noiseRecords.filter((r) => r.isUpdate).length;
    return s;
  }, [processingStatuses, conflicts, noiseRecords]);

  const reportSummary = useMemo(() => ({
    total: activeRecords.length,
    withConflicts: activeRecords.filter((r) => conflictMap.has(r.id)).length,
    abnormal: activeRecords.filter((r) => r.decibel > DECIBEL_THRESHOLD).length,
    pending: stats.pending,
    resolved: stats.resolved,
    updateCount: stats.updateCount,
  }), [activeRecords, conflictMap, stats]);

  const startEdit = (id: string) => {
    const ps = statusMap.get(id);
    setEditingId(id);
    setEditStatus(ps?.status || 'PENDING');
    setEditHandler(ps?.handler || '');
    setEditResult(ps?.result || '');
  };

  const submitEdit = () => {
    if (!editingId) return;
    updateProcessingStatus(editingId, editStatus, editHandler, editResult);
    setEditingId(null);
  };

  const handleExport = () => {
    const content = exportReport(exportFormat);
    const date = new Date().toISOString().slice(0, 10);
    const ext = exportFormat === 'csv' ? 'csv' : 'json';
    const mime = exportFormat === 'csv' ? 'text/csv;charset=utf-8' : 'application/json;charset=utf-8';
    downloadFile(content, `噪声投诉报告_${date}.${ext}`, mime);
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="grid grid-cols-5 gap-4">
        {[
          { label: '待处理', value: stats.pending, icon: Clock, color: 'text-warning' },
          { label: '处理中', value: stats.processing, icon: Edit3, color: 'text-amber' },
          { label: '已处理', value: stats.resolved, icon: CheckCircle, color: 'text-success' },
          { label: '冲突未解决', value: stats.unresolvedConflicts, icon: AlertCircle, color: 'text-danger' },
          { label: '更新记录', value: stats.updateCount, icon: History, color: 'text-amber-light' },
        ].map((s) => (
          <div key={s.label} className="card-base p-4 flex items-center gap-3">
            <s.icon size={24} className={s.color} />
            <div>
              <div className="text-2xl font-mono font-bold text-gray-200">{s.value}</div>
              <div className="text-xs text-gray-500">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <section className="card-base p-5">
        <h2 className="text-amber font-mono font-bold text-lg mb-4 flex items-center gap-2">
          <Edit3 size={20} /> 处理跟踪
        </h2>
        <div className="flex gap-3 flex-wrap mb-4">
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as ProcessingStatusType | '')} className="bg-base-700 border border-base-600/50 rounded-lg px-3 py-1.5 text-sm text-gray-300">
            <option value="">全部状态</option>
            <option value="PENDING">{STATUS_LABELS.PENDING}</option>
            <option value="PROCESSING">{STATUS_LABELS.PROCESSING}</option>
            <option value="RESOLVED">{STATUS_LABELS.RESOLVED}</option>
          </select>
          <select value={filterRoom} onChange={(e) => setFilterRoom(e.target.value)} className="bg-base-700 border border-base-600/50 rounded-lg px-3 py-1.5 text-sm text-gray-300">
            <option value="">全部房间</option>
            {uniqueRooms.map((r) => <option key={r} value={r}>{roomNameMap[r] || r}</option>)}
          </select>
          <select value={filterConflict} onChange={(e) => setFilterConflict(e.target.value)} className="bg-base-700 border border-base-600/50 rounded-lg px-3 py-1.5 text-sm text-gray-300">
            <option value="">全部冲突</option>
            <option value="yes">有冲突</option>
            <option value="no">无冲突</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-base-600/50">
                <th className="pb-2 pr-3" />
                <th className="pb-2 pr-3">房间</th>
                <th className="pb-2 pr-3">日期</th>
                <th className="pb-2 pr-3">分贝</th>
                <th className="pb-2 pr-3">处理状态</th>
                <th className="pb-2 pr-3">处理人</th>
                <th className="pb-2 pr-3">处理结果</th>
                <th className="pb-2 pr-3">冲突</th>
                <th className="pb-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const ps = statusMap.get(r.id);
                const recConflicts = conflictMap.get(r.id) || [];
                const hasConflict = recConflicts.length > 0;
                const isExpanded = expandedId === r.id;
                const StatusIcon = ps ? STATUS_ICON[ps.status] : Clock;

                return (
                  <tr key={r.id} className="border-b border-base-600/30">
                    <td className="py-2.5 pr-1">
                      <button onClick={() => setExpandedId(isExpanded ? null : r.id)} className="text-gray-500 hover:text-amber transition-colors">
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                    </td>
                    <td className="py-2.5 pr-3 font-mono text-amber">{roomNameMap[r.roomId] || r.roomId}</td>
                    <td className="py-2.5 pr-3">{r.date}</td>
                    <td className="py-2.5 pr-3 font-mono text-xs">{r.decibel} dB</td>
                    <td className="py-2.5 pr-3">
                      {ps && (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${STATUS_BADGE[ps.status]}`}>
                          <StatusIcon size={12} /> {STATUS_LABELS[ps.status]}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 text-gray-400">{ps?.handler || '-'}</td>
                    <td className="py-2.5 pr-3 text-gray-400 max-w-[120px] truncate">{ps?.result || '-'}</td>
                    <td className="py-2.5 pr-3">
                      {hasConflict ? (
                        <span className="text-warning"><AlertCircle size={16} /></span>
                      ) : '-'}
                    </td>
                    <td className="py-2.5">
                      <button onClick={() => startEdit(r.id)} className="text-xs px-2 py-1 bg-amber-muted text-amber rounded hover:bg-amber/25 transition-colors">
                        更新
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="py-8 text-center text-gray-500">暂无数据</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {editingId && (
          <div className="mt-4 p-4 bg-base-900 rounded-lg border border-amber/20 space-y-3">
            <h3 className="text-amber font-mono text-sm font-bold">更新处理状态</h3>
            <div className="flex gap-3 flex-wrap">
              <select value={editStatus} onChange={(e) => setEditStatus(e.target.value as ProcessingStatusType)} className="bg-base-700 border border-base-600/50 rounded-lg px-3 py-1.5 text-sm text-gray-300">
                <option value="PENDING">{STATUS_LABELS.PENDING}</option>
                <option value="PROCESSING">{STATUS_LABELS.PROCESSING}</option>
                <option value="RESOLVED">{STATUS_LABELS.RESOLVED}</option>
              </select>
              <input value={editHandler} onChange={(e) => setEditHandler(e.target.value)} placeholder="处理人" className="bg-base-700 border border-base-600/50 rounded-lg px-3 py-1.5 text-sm text-gray-300 w-32" />
            </div>
            <textarea value={editResult} onChange={(e) => setEditResult(e.target.value)} placeholder="处理结果" rows={2} className="w-full bg-base-700 border border-base-600/50 rounded-lg px-3 py-1.5 text-sm text-gray-300" />
            <div className="flex gap-2">
              <button onClick={submitEdit} className="px-4 py-1.5 bg-amber text-base-900 rounded-lg text-sm font-bold hover:bg-amber-light transition-colors">提交</button>
              <button onClick={() => setEditingId(null)} className="px-4 py-1.5 bg-base-700 text-gray-400 rounded-lg text-sm hover:bg-base-600 transition-colors">取消</button>
            </div>
          </div>
        )}

        {expandedId && (() => {
          const r = activeRecords.find((rec) => rec.id === expandedId);
          if (!r) return null;
          const ps = statusMap.get(r.id);
          const recConflicts = conflictMap.get(r.id) || [];
          return (
            <div className="mt-4 p-4 bg-base-900 rounded-lg border border-base-600/50 space-y-3 text-sm">
              <div>
                <span className="text-gray-500">描述：</span>
                <span className="text-gray-300">{r.description || '无'}</span>
              </div>
              <div className="flex gap-3">
                {r.isUpdate && <span className="px-1.5 py-0.5 bg-amber-muted text-amber text-xs rounded">更新</span>}
                {r.isDuplicate && <span className="px-1.5 py-0.5 bg-base-700 text-gray-500 text-xs rounded">重复</span>}
              </div>
              {recConflicts.length > 0 && (
                <div>
                  <span className="text-gray-500">冲突详情：</span>
                  <div className="mt-1 space-y-1">
                    {recConflicts.map((c) => (
                      <div key={c.id} className={`pl-3 border-l-2 ${c.isResolved ? 'border-success text-success' : 'border-warning text-warning'}`}>
                        {CONFLICT_LABELS[c.type]}：{c.description}
                        {c.isResolved && <span className="ml-2 text-xs text-success">已解决</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {ps && ps.history.length > 0 && (
                <div>
                  <span className="text-gray-500 flex items-center gap-1"><History size={12} /> 处理历史：</span>
                  <div className="mt-1 space-y-1">
                    {ps.history.map((h, i) => (
                      <div key={i} className="pl-3 border-l-2 border-base-500 text-gray-400 text-xs">
                        <span className="text-gray-500">{new Date(h.updatedAt).toLocaleString()}</span>
                        {' '}
                        <span className={STATUS_BADGE[h.status].split(' ')[1]}>{STATUS_LABELS[h.status]}</span>
                        {h.handler && <span> - {h.handler}</span>}
                        {h.result && <span> - {h.result}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </section>

      <section className="card-base p-5">
        <h2 className="text-amber font-mono font-bold text-lg mb-4 flex items-center gap-2">
          <Download size={20} /> 报告导出
        </h2>
        <div className="flex gap-4 items-start flex-wrap">
          <div className="space-y-3">
            <div className="flex gap-2">
              <button
                onClick={() => setExportFormat('csv')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${
                  exportFormat === 'csv' ? 'bg-amber-muted text-amber' : 'bg-base-700 text-gray-400 hover:bg-base-600'
                }`}
              >
                <FileSpreadsheet size={16} /> CSV
              </button>
              <button
                onClick={() => setExportFormat('json')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${
                  exportFormat === 'json' ? 'bg-amber-muted text-amber' : 'bg-base-700 text-gray-400 hover:bg-base-600'
                }`}
              >
                <FileJson size={16} /> JSON
              </button>
            </div>
            <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2.5 bg-amber text-base-900 rounded-lg text-sm font-bold hover:bg-amber-light transition-colors">
              <Download size={16} /> 导出报告
            </button>
          </div>
          <div className="card-base p-4 flex-1 min-w-[240px]">
            <h3 className="text-xs text-gray-500 mb-2 font-mono">预览摘要</h3>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div><span className="text-gray-500">总记录</span> <span className="text-gray-200 font-mono">{reportSummary.total}</span></div>
              <div><span className="text-gray-500">冲突记录</span> <span className="text-warning font-mono">{reportSummary.withConflicts}</span></div>
              <div><span className="text-gray-500">超标记录</span> <span className="text-danger font-mono">{reportSummary.abnormal}</span></div>
              <div><span className="text-gray-500">待处理</span> <span className="text-warning font-mono">{reportSummary.pending}</span></div>
              <div><span className="text-gray-500">已处理</span> <span className="text-success font-mono">{reportSummary.resolved}</span></div>
              <div><span className="text-gray-500">更新记录</span> <span className="text-amber-light font-mono">{reportSummary.updateCount}</span></div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
