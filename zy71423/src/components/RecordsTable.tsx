import { useState } from 'react';
import { GameRecord } from '../types';
import {
  formatRecordTimestamp,
  getRecordTypeLabel,
  getRecordStatusLabel,
} from '../utils/recordManager';
import { getFunctionCardById } from '../data/functionCards';
import { Edit3, Trash2, CheckCircle, Clock, Copy, AlertTriangle } from 'lucide-react';

interface RecordsTableProps {
  records: GameRecord[];
  onWithdraw: (recordId: string) => void;
  onMarkDuplicate: (recordId: string, originalId: string) => void;
  onUpdateNotes: (recordId: string, notes: string) => void;
  onConfirm: (recordId: string) => void;
}

export const RecordsTable = ({
  records,
  onWithdraw,
  onMarkDuplicate,
  onUpdateNotes,
  onConfirm,
}: RecordsTableProps) => {
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [notesText, setNotesText] = useState('');
  const [duplicateMode, setDuplicateMode] = useState<string | null>(null);

  const statusColors: Record<string, string> = {
    normal: 'bg-green-500/20 text-green-400 border-green-500/50',
    pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
    exception: 'bg-red-500/20 text-red-400 border-red-500/50',
  };

  const typeColors: Record<string, string> = {
    normal: 'bg-slate-500/20 text-slate-400',
    late: 'bg-orange-500/20 text-orange-400',
    withdrawn: 'bg-purple-500/20 text-purple-400',
    duplicate: 'bg-pink-500/20 text-pink-400',
  };

  const handleEditNotes = (record: GameRecord) => {
    setEditingNotes(record.id);
    setNotesText(record.notes);
  };

  const handleSaveNotes = (recordId: string) => {
    onUpdateNotes(recordId, notesText);
    setEditingNotes(null);
    setNotesText('');
  };

  const handleDuplicateSelect = (recordId: string, originalId: string) => {
    onMarkDuplicate(recordId, originalId);
    setDuplicateMode(null);
  };

  return (
    <div className="bg-slate-800/90 backdrop-blur-md rounded-xl border border-slate-700/50 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-900/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                时间
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                函数卡
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                坐标
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                斜率
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                可导
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                状态
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                类型
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                备注
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {records.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                  暂无记录
                </td>
              </tr>
            ) : (
              records.map((record) => {
                const card = getFunctionCardById(record.functionCardId);
                const hasMissingFields = record.missingFields.length > 0;

                return (
                  <tr
                    key={record.id}
                    className={`
                      hover:bg-slate-700/30 transition-colors
                      ${record.status === 'exception' ? 'bg-red-500/5' : ''}
                      ${record.recordType === 'late' ? 'bg-orange-500/5' : ''}
                      ${record.recordType === 'withdrawn' ? 'opacity-60' : ''}
                    `}
                  >
                    <td className="px-4 py-3 text-sm text-slate-300 whitespace-nowrap">
                      {formatRecordTimestamp(record.timestamp)}
                      {record.recordType === 'late' && (
                        <span className="ml-2 text-xs text-orange-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> 晚补
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-cyan-400">
                      {card?.name || record.functionCardId}
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-slate-300">
                      ({record.playerPosition.x.toFixed(2)},{' '}
                      {record.playerPosition.y.toFixed(2)})
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-slate-300">
                      {isFinite(record.slope) ? record.slope.toFixed(2) : '∞'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          record.isDifferentiable
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-red-500/20 text-red-400'
                        }`}
                      >
                        {record.isDifferentiable ? '是' : '否'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`px-2 py-1 rounded text-xs border ${statusColors[record.status]}`}
                      >
                        {hasMissingFields && (
                          <AlertTriangle className="w-3 h-3 inline mr-1 text-yellow-400" />
                        )}
                        {getRecordStatusLabel(record.status)}
                        {hasMissingFields && ` (缺: ${record.missingFields.join(',')})`}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 rounded text-xs ${typeColors[record.recordType]}`}>
                        {getRecordTypeLabel(record.recordType)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400 max-w-xs">
                      {editingNotes === record.id ? (
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={notesText}
                            onChange={(e) => setNotesText(e.target.value)}
                            className="flex-1 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-sm text-white"
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveNotes(record.id)}
                            className="px-2 py-1 bg-cyan-600 text-white rounded text-xs hover:bg-cyan-500"
                          >
                            保存
                          </button>
                          <button
                            onClick={() => setEditingNotes(null)}
                            className="px-2 py-1 bg-slate-600 text-white rounded text-xs hover:bg-slate-500"
                          >
                            取消
                          </button>
                        </div>
                      ) : (
                        <div className="whitespace-pre-wrap">{record.notes || '-'}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {duplicateMode === record.id ? (
                        <div className="flex flex-col gap-1">
                          <span className="text-xs text-cyan-400">选择原始记录:</span>
                          <select
                            onChange={(e) => handleDuplicateSelect(record.id, e.target.value)}
                            className="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-xs text-white"
                            autoFocus
                          >
                            <option value="">-- 请选择 --</option>
                            {records
                              .filter((r) => r.id !== record.id)
                              .map((r) => (
                                <option key={r.id} value={r.id}>
                                  {formatRecordTimestamp(r.timestamp)}
                                </option>
                              ))}
                          </select>
                          <button
                            onClick={() => setDuplicateMode(null)}
                            className="text-xs text-slate-400 hover:text-white"
                          >
                            取消
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-2">
                          {record.status === 'pending' && (
                            <button
                              onClick={() => onConfirm(record.id)}
                              className="p-1.5 bg-green-600/20 text-green-400 rounded hover:bg-green-600/40 transition-colors"
                              title="确认记录"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                          )}
                          {record.recordType !== 'withdrawn' && (
                            <>
                              <button
                                onClick={() => handleEditNotes(record)}
                                className="p-1.5 bg-blue-600/20 text-blue-400 rounded hover:bg-blue-600/40 transition-colors"
                                title="编辑备注"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setDuplicateMode(record.id)}
                                className="p-1.5 bg-pink-600/20 text-pink-400 rounded hover:bg-pink-600/40 transition-colors"
                                title="标记重复"
                              >
                                <Copy className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => onWithdraw(record.id)}
                                className="p-1.5 bg-red-600/20 text-red-400 rounded hover:bg-red-600/40 transition-colors"
                                title="撤回记录"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
