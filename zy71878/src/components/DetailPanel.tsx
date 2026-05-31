import { useState } from 'react';
import {
  X,
  User,
  Clock,
  Paperclip,
  History,
  AlertTriangle,
  Check,
  Edit3,
  Plus,
} from 'lucide-react';
import { useRecordsStore } from '../store/useRecordsStore';
import { StatusBadge } from './StatusBadge';
import {
  TypeIcon,
  SourceIcon,
  EvidenceIcon,
  AnomalyIcon,
} from './TypeIcon';
import {
  SOURCE_LABELS,
  TYPE_LABELS,
  ANOMALY_LABELS,
  EVIDENCE_TYPE_LABELS,
  STATUS_LABELS,
} from '../types';
import type { RecordStatus, EvidenceType } from '../types';
import {
  formatFullTimestamp,
  formatValue,
  formatTimestamp,
} from '../utils/format';
import {
  buildEvidenceChain,
  formatEvidenceForDisplay,
} from '../logic/evidenceChain';
import { getAllowedTransitions } from '../logic/statusManager';

export const DetailPanel = () => {
  const { selectedRecordId, getSelectedRecord, selectRecord, updateStatus, addEvidence } =
    useRecordsStore();
  const record = getSelectedRecord();

  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [statusReason, setStatusReason] = useState('');
  const [showAddEvidence, setShowAddEvidence] = useState(false);
  const [newEvidence, setNewEvidence] = useState({
    type: 'note' as EvidenceType,
    content: '',
    author: '李教练',
  });

  if (!record || !selectedRecordId) {
    return (
      <div className="w-96 bg-slate-800/50 border-l border-slate-700 flex flex-col">
        <div className="flex-1 flex items-center justify-center text-slate-500">
          <div className="text-center">
            <p className="text-sm mb-1">选择一条记录</p>
            <p className="text-xs text-slate-600">查看完整详情和证据链</p>
          </div>
        </div>
      </div>
    );
  }

  const evidenceChain = buildEvidenceChain(record);
  const allowedTransitions = getAllowedTransitions(record.status);

  const handleStatusChange = (newStatus: RecordStatus) => {
    const reason = statusReason.trim() || '人工审核确认';
    updateStatus(record.id, newStatus, reason, '李教练');
    setShowStatusMenu(false);
    setStatusReason('');
  };

  const handleAddEvidence = () => {
    if (!newEvidence.content.trim()) return;
    addEvidence(record.id, newEvidence);
    setNewEvidence({ type: 'note', content: '', author: '李教练' });
    setShowAddEvidence(false);
  };

  const renderDataTable = () => {
    const entries = Object.entries(record.data).filter(
      ([k]) => !['value', 'unit', 'constraints', 'runId', 'description'].includes(k)
    );
    
    if (entries.length === 0 && record.data.value === undefined && !record.data.constraints) {
      return null;
    }

    return (
      <div className="bg-slate-900/50 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <tbody>
            {record.data.value !== undefined && (
              <tr className="border-b border-slate-700/50">
                <td className="px-3 py-2 text-slate-500 font-mono text-xs">数值</td>
                <td className="px-3 py-2 text-slate-200 font-mono font-medium">
                  {formatValue(record.data.value, record.data.unit)}
                </td>
              </tr>
            )}
            {record.data.runId && (
              <tr className="border-b border-slate-700/50">
                <td className="px-3 py-2 text-slate-500 font-mono text-xs">运行ID</td>
                <td className="px-3 py-2 text-slate-300 font-mono">{record.data.runId}</td>
              </tr>
            )}
            {record.data.description && (
              <tr className="border-b border-slate-700/50">
                <td className="px-3 py-2 text-slate-500 font-mono text-xs">描述</td>
                <td className="px-3 py-2 text-slate-300">{record.data.description}</td>
              </tr>
            )}
            {record.data.constraints && (
              <tr className="border-b border-slate-700/50">
                <td className="px-3 py-2 text-slate-500 font-mono text-xs align-top">约束</td>
                <td className="px-3 py-2">
                  <pre className="text-xs text-slate-300 font-mono whitespace-pre-wrap">
                    {JSON.stringify(record.data.constraints, null, 2)}
                  </pre>
                </td>
              </tr>
            )}
            {entries.map(([key, value]) => (
              <tr key={key} className="border-b border-slate-700/50 last:border-b-0">
                <td className="px-3 py-2 text-slate-500 font-mono text-xs">{key}</td>
                <td className="px-3 py-2 text-slate-300">
                  {typeof value === 'object'
                    ? JSON.stringify(value)
                    : String(value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="w-96 bg-slate-800 border-l border-slate-700 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
        <h2 className="text-sm font-medium text-slate-200">记录详情</h2>
        <button
          onClick={() => selectRecord(null)}
          className="p-1 hover:bg-slate-700 rounded transition-colors"
        >
          <X className="w-4 h-4 text-slate-400" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div
                className={`w-6 h-6 rounded flex items-center justify-center ${
                  record.source === 'teammate'
                    ? 'bg-blue-900/50 text-blue-400'
                    : record.source === 'model'
                    ? 'bg-purple-900/50 text-purple-400'
                    : 'bg-green-900/50 text-green-400'
                }`}
              >
                <SourceIcon source={record.source} className="w-4 h-4" />
              </div>
              <span className="text-xs text-slate-500">
                {SOURCE_LABELS[record.source]}
              </span>
              <span className="text-slate-600">·</span>
              <div className="flex items-center gap-1 text-slate-500">
                <TypeIcon type={record.type} className="w-3.5 h-3.5" />
                <span className="text-xs">{TYPE_LABELS[record.type]}</span>
              </div>
            </div>
            <h3 className="text-base font-medium text-slate-100">{record.title}</h3>
          </div>
          <StatusBadge status={record.status} />
        </div>

        <div className="flex items-center gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-1">
            <User className="w-3.5 h-3.5" />
            <span>{record.author}</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            <span className="font-mono">{formatFullTimestamp(record.timestamp)}</span>
          </div>
        </div>

        {record.anomalyReason && (
          <div className="p-3 bg-orange-900/20 border border-orange-800/50 rounded-lg">
            <div className="flex items-center gap-2 text-orange-400 text-sm mb-2">
              <AlertTriangle className="w-4 h-4" />
              <span className="font-medium">异常标记</span>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <AnomalyIcon type={record.anomalyReason.type} />
                <span className="text-xs text-orange-300 font-medium">
                  {ANOMALY_LABELS[record.anomalyReason.type]}
                </span>
              </div>
              <p className="text-xs text-orange-300/80">
                {record.anomalyReason.description}
              </p>
              <div className="mt-2 p-2 bg-slate-900/50 rounded text-[11px] text-orange-200/70 font-mono">
                <div className="text-slate-500 mb-1">详细数据：</div>
                <pre className="whitespace-pre-wrap">
                  {JSON.stringify(record.anomalyReason.details, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        )}

        {record.status === 'pending' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">处理状态</span>
              <button
                onClick={() => setShowStatusMenu(!showStatusMenu)}
                className="flex items-center gap-1 px-2 py-1 bg-slate-700/50 hover:bg-slate-700 rounded text-xs text-slate-300 transition-colors"
              >
                <Edit3 className="w-3 h-3" />
                <span>变更状态</span>
              </button>
            </div>

            {showStatusMenu && (
              <div className="p-3 bg-slate-900/50 rounded-lg space-y-2">
                <input
                  type="text"
                  placeholder="输入变更原因..."
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-industrial-500"
                />
                <div className="flex flex-wrap gap-1">
                  {allowedTransitions.map((status) => (
                    <button
                      key={status}
                      onClick={() => handleStatusChange(status)}
                      className="flex items-center gap-1 px-2 py-1 bg-slate-700/50 hover:bg-slate-700 rounded text-xs text-slate-300 transition-colors"
                    >
                      <Check className="w-3 h-3" />
                      <span>标记为 {STATUS_LABELS[status]}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div>
          <h4 className="text-xs font-medium text-slate-400 mb-2 flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-industrial-500 rounded-full" />
            数据详情
          </h4>
          {renderDataTable()}
        </div>

        {record.attachments.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-slate-400 mb-2 flex items-center gap-1">
              <Paperclip className="w-3 h-3" />
              附件 ({record.attachments.length})
            </h4>
            <div className="space-y-1">
              {record.attachments.map((att) => (
                <div
                  key={att.id}
                  className={`flex items-center justify-between px-3 py-2 rounded text-xs ${
                    att.arrivedLate
                      ? 'bg-orange-900/20 border border-orange-800/30'
                      : 'bg-slate-900/50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Paperclip
                      className={`w-3 h-3 ${att.arrivedLate ? 'text-orange-400' : 'text-slate-500'}`}
                    />
                    <span className={att.arrivedLate ? 'text-orange-300' : 'text-slate-300'}>
                      {att.name}
                    </span>
                  </div>
                  {att.arrivedLate && (
                    <span className="text-[10px] text-orange-400 font-mono">
                      晚到 {att.delayedHours}h
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-medium text-slate-400 flex items-center gap-1">
              <History className="w-3 h-3" />
              证据链 ({evidenceChain.length})
            </h4>
            <button
              onClick={() => setShowAddEvidence(!showAddEvidence)}
              className="flex items-center gap-1 text-xs text-industrial-400 hover:text-industrial-300 transition-colors"
            >
              <Plus className="w-3 h-3" />
              <span>添加</span>
            </button>
          </div>

          {showAddEvidence && (
            <div className="p-3 bg-slate-900/50 rounded-lg space-y-2 mb-3">
              <select
                value={newEvidence.type}
                onChange={(e) =>
                  setNewEvidence({ ...newEvidence, type: e.target.value as EvidenceType })
                }
                className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-xs text-slate-200 focus:outline-none focus:border-industrial-500"
              >
                {(['note', 'confirmation', 'model'] as EvidenceType[]).map((t) => (
                  <option key={t} value={t}>
                    {EVIDENCE_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
              <textarea
                placeholder="输入证据内容..."
                value={newEvidence.content}
                onChange={(e) =>
                  setNewEvidence({ ...newEvidence, content: e.target.value })
                }
                className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-industrial-500 resize-none h-16"
              />
              <input
                type="text"
                placeholder="作者"
                value={newEvidence.author}
                onChange={(e) =>
                  setNewEvidence({ ...newEvidence, author: e.target.value })
                }
                className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-industrial-500"
              />
              <button
                onClick={handleAddEvidence}
                disabled={!newEvidence.content.trim()}
                className="w-full px-3 py-1.5 bg-industrial-600 hover:bg-industrial-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded text-xs transition-colors"
              >
                添加证据
              </button>
            </div>
          )}

          <div className="space-y-2">
            {evidenceChain.map((ev, idx) => {
              const display = formatEvidenceForDisplay(ev);
              const isLast = idx === evidenceChain.length - 1;
              return (
                <div key={ev.id} className="relative pl-6">
                  {!isLast && (
                    <div className="absolute left-2 top-4 bottom-0 w-px bg-slate-700" />
                  )}
                  <div className="absolute left-0 top-0 w-5 h-5 rounded-full bg-slate-700 border-2 border-slate-900 flex items-center justify-center">
                    <EvidenceIcon type={ev.type} className="w-3 h-3" />
                  </div>
                  <div className="bg-slate-900/50 rounded p-2 ml-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-medium text-slate-400">
                        {display.typeLabel} · {ev.author}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {display.timestampLabel}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">{ev.content}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {record.statusHistory.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-slate-400 mb-2">状态变更历史</h4>
            <div className="space-y-2">
              {record.statusHistory.map((change) => (
                <div
                  key={change.id}
                  className="p-2 bg-slate-900/50 rounded text-xs"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1">
                      <StatusBadge status={change.fromStatus} size="sm" />
                      <span className="text-slate-600">→</span>
                      <StatusBadge status={change.toStatus} size="sm" />
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {formatTimestamp(change.timestamp)}
                    </span>
                  </div>
                  <p className="text-slate-400">{change.reason}</p>
                  <p className="text-[10px] text-slate-500 mt-1">操作人：{change.operator}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="h-8" />
      </div>
    </div>
  );
};
